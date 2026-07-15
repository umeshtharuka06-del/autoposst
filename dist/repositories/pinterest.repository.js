"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pinterestRepository = exports.PinterestRepository = void 0;
const prisma_1 = require("../lib/prisma");
class PinterestRepository {
    listActive() {
        return prisma_1.prisma.pinterestBoard.findMany({ where: { isActive: true }, orderBy: { createdAt: 'asc' } });
    }
    listAll() {
        return prisma_1.prisma.pinterestBoard.findMany({ orderBy: { createdAt: 'asc' } });
    }
    findByBoardId(boardId) {
        return prisma_1.prisma.pinterestBoard.findUnique({ where: { boardId } });
    }
    async upsert(params) {
        const count = await prisma_1.prisma.pinterestBoard.count();
        return prisma_1.prisma.pinterestBoard.upsert({
            where: { boardId: params.boardId },
            update: { name: params.name, isActive: true },
            create: { ...params, isDefault: count === 0 },
        });
    }
    async setDefault(boardId) {
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.pinterestBoard.updateMany({ data: { isDefault: false } }),
            prisma_1.prisma.pinterestBoard.update({ where: { boardId }, data: { isDefault: true } }),
        ]);
    }
    deactivate(boardId) {
        return prisma_1.prisma.pinterestBoard.update({ where: { boardId }, data: { isActive: false, isDefault: false } });
    }
}
exports.PinterestRepository = PinterestRepository;
exports.pinterestRepository = new PinterestRepository();
//# sourceMappingURL=pinterest.repository.js.map