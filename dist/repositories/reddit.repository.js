"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redditRepository = exports.RedditRepository = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = require("../lib/prisma");
class RedditRepository {
    create(params) {
        return prisma_1.prisma.redditDraft.create({ data: params });
    }
    findById(id) {
        return prisma_1.prisma.redditDraft.findUnique({ where: { id } });
    }
    findPending(limit) {
        return prisma_1.prisma.redditDraft.findMany({
            where: { status: client_1.DraftStatus.PENDING_REVIEW },
            orderBy: { createdAt: 'asc' },
            take: limit,
        });
    }
    findByPost(postId) {
        return prisma_1.prisma.redditDraft.findMany({ where: { postId }, orderBy: { createdAt: 'asc' } });
    }
    update(id, data) {
        return prisma_1.prisma.redditDraft.update({ where: { id }, data });
    }
}
exports.RedditRepository = RedditRepository;
exports.redditRepository = new RedditRepository();
//# sourceMappingURL=reddit.repository.js.map