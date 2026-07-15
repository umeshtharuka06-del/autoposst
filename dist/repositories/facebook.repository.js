"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.facebookRepository = exports.FacebookRepository = void 0;
const prisma_1 = require("../lib/prisma");
class FacebookRepository {
    listActive() {
        return prisma_1.prisma.facebookPage.findMany({ where: { isActive: true }, orderBy: { createdAt: 'asc' } });
    }
    listAll() {
        return prisma_1.prisma.facebookPage.findMany({ orderBy: { createdAt: 'asc' } });
    }
    findByPageId(pageId) {
        return prisma_1.prisma.facebookPage.findUnique({ where: { pageId } });
    }
    async upsert(params) {
        const count = await prisma_1.prisma.facebookPage.count();
        return prisma_1.prisma.facebookPage.upsert({
            where: { pageId: params.pageId },
            update: { name: params.name, encryptedToken: params.encryptedToken, isActive: true },
            create: { ...params, isDefault: count === 0 },
        });
    }
    async setDefault(pageId) {
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.facebookPage.updateMany({ data: { isDefault: false } }),
            prisma_1.prisma.facebookPage.update({ where: { pageId }, data: { isDefault: true } }),
        ]);
    }
    deactivate(pageId) {
        return prisma_1.prisma.facebookPage.update({ where: { pageId }, data: { isActive: false, isDefault: false } });
    }
}
exports.FacebookRepository = FacebookRepository;
exports.facebookRepository = new FacebookRepository();
//# sourceMappingURL=facebook.repository.js.map