"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contentService = exports.ContentService = void 0;
const promises_1 = require("fs/promises");
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const env_1 = require("../../config/env");
const logger_1 = require("../../lib/logger");
const errors_1 = require("../../lib/errors");
const prisma_1 = require("../../lib/prisma");
const translation_repository_1 = require("../../repositories/translation.repository");
const types_1 = require("../../types");
const openai_client_1 = require("./openai.client");
const prompts_1 = require("./prompts");
const platformContentSchema = zod_1.z.object({
    title: zod_1.z.string().nullable(),
    body: zod_1.z.string(),
    description: zod_1.z.string().nullable(),
    keywords: zod_1.z.array(zod_1.z.string()),
    hashtags: zod_1.z.array(zod_1.z.string()),
    altText: zod_1.z.string().nullable(),
    cta: zod_1.z.string().nullable(),
});
const languageSetSchema = zod_1.z.object({
    EN: platformContentSchema,
    SI: platformContentSchema,
    TA: platformContentSchema,
});
const generatedContentSchema = zod_1.z.object({
    FACEBOOK: languageSetSchema,
    PINTEREST: languageSetSchema,
    REDDIT: languageSetSchema,
    redditSubredditSuggestion: zod_1.z.string(),
});
class ContentService {
    /**
     * Generates the full multi-platform / multi-language content package for a post,
     * persists ai_outputs + translations, and returns the parsed content.
     */
    async generateForPost(postId) {
        const post = await prisma_1.prisma.post.findUniqueOrThrow({
            where: { id: postId },
            include: { media: { orderBy: { sortOrder: 'asc' } } },
        });
        const mediaSummary = post.media
            .map((m, i) => `#${i + 1} ${m.type.toLowerCase()}${m.mimeType ? ` (${m.mimeType})` : ''}`)
            .join(', ');
        const userParts = [
            { type: 'input_text', text: (0, prompts_1.buildUserPrompt)({ caption: post.caption, mediaSummary: mediaSummary || 'none' }) },
        ];
        // Attach up to 3 image thumbnails so the model can see what it is captioning.
        const photos = post.media.filter((m) => m.type === client_1.MediaType.PHOTO && m.thumbnailPath).slice(0, 3);
        for (const photo of photos) {
            try {
                const buf = await (0, promises_1.readFile)(photo.thumbnailPath);
                userParts.push({
                    type: 'input_image',
                    image_url: `data:image/jpeg;base64,${buf.toString('base64')}`,
                    detail: 'auto',
                });
            }
            catch (err) {
                logger_1.logger.warn({ mediaId: photo.id, err }, 'could not read thumbnail for AI input, skipping');
            }
        }
        const response = await openai_client_1.openai.responses
            .create({
            model: env_1.env.OPENAI_MODEL,
            max_output_tokens: env_1.env.OPENAI_MAX_OUTPUT_TOKENS,
            input: [
                { role: 'system', content: (0, prompts_1.buildSystemPrompt)(post.tone) },
                { role: 'user', content: userParts },
            ],
            text: {
                format: {
                    type: 'json_schema',
                    name: 'social_content',
                    strict: true,
                    schema: (0, prompts_1.contentJsonSchema)(),
                },
            },
        })
            .catch((err) => {
            const message = err instanceof Error ? err.message : String(err);
            throw new errors_1.ExternalApiError('openai', message);
        });
        const rawText = response.output_text;
        if (!rawText) {
            throw new errors_1.ExternalApiError('openai', 'Empty response from model');
        }
        let parsed;
        try {
            parsed = generatedContentSchema.parse(JSON.parse(rawText));
        }
        catch (err) {
            throw new errors_1.ExternalApiError('openai', `Model returned invalid content JSON: ${err instanceof Error ? err.message : err}`);
        }
        await prisma_1.prisma.aiOutput.create({
            data: {
                postId,
                model: env_1.env.OPENAI_MODEL,
                promptTokens: response.usage?.input_tokens ?? null,
                completionTokens: response.usage?.output_tokens ?? null,
                rawResponse: JSON.parse(rawText),
            },
        });
        for (const platform of [client_1.Platform.FACEBOOK, client_1.Platform.PINTEREST, client_1.Platform.REDDIT]) {
            for (const language of types_1.LANGUAGES) {
                const content = parsed[platform][language];
                await translation_repository_1.translationRepository.upsert(postId, platform, language, content);
            }
        }
        logger_1.logger.info({ postId, tokens: response.usage }, 'AI content generated');
        return parsed;
    }
}
exports.ContentService = ContentService;
exports.contentService = new ContentService();
//# sourceMappingURL=content.service.js.map