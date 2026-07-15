import { readFile } from 'fs/promises';
import { Language, MediaType, Platform, Tone } from '@prisma/client';
import { z } from 'zod';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { ExternalApiError } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { translationRepository } from '../../repositories/translation.repository';
import type { GeneratedContent, GeneratedPlatformContent } from '../../types';
import { LANGUAGES } from '../../types';
import { openai } from './openai.client';
import { buildSystemPrompt, buildUserPrompt, contentJsonSchema } from './prompts';

const platformContentSchema = z.object({
  title: z.string().nullable(),
  body: z.string(),
  description: z.string().nullable(),
  keywords: z.array(z.string()),
  hashtags: z.array(z.string()),
  altText: z.string().nullable(),
  cta: z.string().nullable(),
});

const languageSetSchema = z.object({
  EN: platformContentSchema,
  SI: platformContentSchema,
  TA: platformContentSchema,
});

const generatedContentSchema = z.object({
  FACEBOOK: languageSetSchema,
  PINTEREST: languageSetSchema,
  REDDIT: languageSetSchema,
  redditSubredditSuggestion: z.string(),
});

type UserContentPart =
  | { type: 'input_text'; text: string }
  | { type: 'input_image'; image_url: string; detail: 'auto' };

export class ContentService {
  /**
   * Generates the full multi-platform / multi-language content package for a post,
   * persists ai_outputs + translations, and returns the parsed content.
   */
  async generateForPost(postId: string): Promise<GeneratedContent> {
    const post = await prisma.post.findUniqueOrThrow({
      where: { id: postId },
      include: { media: { orderBy: { sortOrder: 'asc' } } },
    });

    const mediaSummary = post.media
      .map((m, i) => `#${i + 1} ${m.type.toLowerCase()}${m.mimeType ? ` (${m.mimeType})` : ''}`)
      .join(', ');

    const userParts: UserContentPart[] = [
      { type: 'input_text', text: buildUserPrompt({ caption: post.caption, mediaSummary: mediaSummary || 'none' }) },
    ];

    // Attach up to 3 image thumbnails so the model can see what it is captioning.
    const photos = post.media.filter((m) => m.type === MediaType.PHOTO && m.thumbnailPath).slice(0, 3);
    for (const photo of photos) {
      try {
        const buf = await readFile(photo.thumbnailPath as string);
        userParts.push({
          type: 'input_image',
          image_url: `data:image/jpeg;base64,${buf.toString('base64')}`,
          detail: 'auto',
        });
      } catch (err) {
        logger.warn({ mediaId: photo.id, err }, 'could not read thumbnail for AI input, skipping');
      }
    }

    const response = await openai.responses
      .create({
        model: env.OPENAI_MODEL,
        max_output_tokens: env.OPENAI_MAX_OUTPUT_TOKENS,
        input: [
          { role: 'system', content: buildSystemPrompt(post.tone as Tone) },
          { role: 'user', content: userParts },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'social_content',
            strict: true,
            schema: contentJsonSchema(),
          },
        },
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        throw new ExternalApiError('openai', message);
      });

    const rawText = response.output_text;
    if (!rawText) {
      throw new ExternalApiError('openai', 'Empty response from model');
    }

    let parsed: GeneratedContent;
    try {
      parsed = generatedContentSchema.parse(JSON.parse(rawText)) as GeneratedContent;
    } catch (err) {
      throw new ExternalApiError('openai', `Model returned invalid content JSON: ${err instanceof Error ? err.message : err}`);
    }

    await prisma.aiOutput.create({
      data: {
        postId,
        model: env.OPENAI_MODEL,
        promptTokens: response.usage?.input_tokens ?? null,
        completionTokens: response.usage?.output_tokens ?? null,
        rawResponse: JSON.parse(rawText),
      },
    });

    for (const platform of [Platform.FACEBOOK, Platform.PINTEREST, Platform.REDDIT]) {
      for (const language of LANGUAGES) {
        const content: GeneratedPlatformContent = parsed[platform][language as Language];
        await translationRepository.upsert(postId, platform, language, content);
      }
    }

    logger.info({ postId, tokens: response.usage }, 'AI content generated');
    return parsed;
  }
}

export const contentService = new ContentService();
