"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.translationRepository = exports.TranslationRepository = void 0;
const prisma_1 = require("../lib/prisma");
class TranslationRepository {
    upsert(postId, platform, language, content) {
        const data = {
            title: content.title,
            body: content.body,
            description: content.description,
            keywords: content.keywords,
            hashtags: content.hashtags,
            altText: content.altText,
            cta: content.cta,
        };
        return prisma_1.prisma.translation.upsert({
            where: { postId_platform_language: { postId, platform, language } },
            update: data,
            create: { postId, platform, language, ...data },
        });
    }
    find(postId, platform, language) {
        return prisma_1.prisma.translation.findUnique({
            where: { postId_platform_language: { postId, platform, language } },
        });
    }
    findByPost(postId) {
        return prisma_1.prisma.translation.findMany({ where: { postId } });
    }
}
exports.TranslationRepository = TranslationRepository;
exports.translationRepository = new TranslationRepository();
//# sourceMappingURL=translation.repository.js.map