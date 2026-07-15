"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postRepository = exports.PostRepository = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = require("../lib/prisma");
class PostRepository {
    create(params) {
        return prisma_1.prisma.post.create({
            data: {
                userId: params.userId,
                caption: params.caption,
                tone: params.tone,
                autoPublish: params.autoPublish,
            },
        });
    }
    findById(id) {
        return prisma_1.prisma.post.findUnique({ where: { id } });
    }
    findWithRelations(id) {
        return prisma_1.prisma.post.findUnique({
            where: { id },
            include: { media: { orderBy: { sortOrder: 'asc' } }, translations: true, platformJobs: true, redditDrafts: true, user: true },
        });
    }
    findLatestForUser(userId) {
        return prisma_1.prisma.post.findFirst({
            where: { userId, status: { notIn: [client_1.PostStatus.CANCELLED] } },
            orderBy: { createdAt: 'desc' },
            include: { media: { orderBy: { sortOrder: 'asc' } }, translations: true, platformJobs: true, redditDrafts: true, user: true },
        });
    }
    findRecent(limit) {
        return prisma_1.prisma.post.findMany({
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: { media: { orderBy: { sortOrder: 'asc' } }, translations: true, platformJobs: true, redditDrafts: true, user: true },
        });
    }
    updateStatus(id, status, error) {
        return prisma_1.prisma.post.update({ where: { id }, data: { status, error: error ?? null } });
    }
    update(id, data) {
        return prisma_1.prisma.post.update({ where: { id }, data });
    }
    countByStatus() {
        return prisma_1.prisma.post
            .groupBy({ by: ['status'], _count: true })
            .then((rows) => rows.map((r) => ({ status: r.status, _count: r._count })));
    }
}
exports.PostRepository = PostRepository;
exports.postRepository = new PostRepository();
//# sourceMappingURL=post.repository.js.map