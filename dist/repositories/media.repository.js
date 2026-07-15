"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mediaRepository = exports.MediaRepository = void 0;
const prisma_1 = require("../lib/prisma");
class MediaRepository {
    create(params) {
        return prisma_1.prisma.media.create({ data: params });
    }
    findByPost(postId) {
        return prisma_1.prisma.media.findMany({ where: { postId }, orderBy: { sortOrder: 'asc' } });
    }
    update(id, data) {
        return prisma_1.prisma.media.update({ where: { id }, data });
    }
}
exports.MediaRepository = MediaRepository;
exports.mediaRepository = new MediaRepository();
//# sourceMappingURL=media.repository.js.map