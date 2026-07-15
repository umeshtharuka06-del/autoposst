import { Language, Platform, Translation } from '@prisma/client';
import { prisma } from '../lib/prisma';
import type { GeneratedPlatformContent } from '../types';

export class TranslationRepository {
  upsert(postId: string, platform: Platform, language: Language, content: GeneratedPlatformContent): Promise<Translation> {
    const data = {
      title: content.title,
      body: content.body,
      description: content.description,
      keywords: content.keywords,
      hashtags: content.hashtags,
      altText: content.altText,
      cta: content.cta,
    };
    return prisma.translation.upsert({
      where: { postId_platform_language: { postId, platform, language } },
      update: data,
      create: { postId, platform, language, ...data },
    });
  }

  find(postId: string, platform: Platform, language: Language): Promise<Translation | null> {
    return prisma.translation.findUnique({
      where: { postId_platform_language: { postId, platform, language } },
    });
  }

  findByPost(postId: string): Promise<Translation[]> {
    return prisma.translation.findMany({ where: { postId } });
  }
}

export const translationRepository = new TranslationRepository();
