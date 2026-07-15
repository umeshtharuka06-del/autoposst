"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRepository = exports.UserRepository = void 0;
const prisma_1 = require("../lib/prisma");
class UserRepository {
    findByTelegramId(telegramId) {
        return prisma_1.prisma.user.findUnique({ where: { telegramId } });
    }
    findById(id) {
        return prisma_1.prisma.user.findUnique({ where: { id } });
    }
    upsertFromTelegram(params) {
        return prisma_1.prisma.user.upsert({
            where: { telegramId: params.telegramId },
            update: {
                username: params.username ?? undefined,
                firstName: params.firstName ?? undefined,
            },
            create: {
                telegramId: params.telegramId,
                username: params.username ?? null,
                firstName: params.firstName ?? null,
                role: params.role,
            },
        });
    }
    setLanguage(id, language) {
        return prisma_1.prisma.user.update({ where: { id }, data: { language } });
    }
    setTone(id, tone) {
        return prisma_1.prisma.user.update({ where: { id }, data: { tone } });
    }
    countUsers() {
        return prisma_1.prisma.user.count();
    }
}
exports.UserRepository = UserRepository;
exports.userRepository = new UserRepository();
//# sourceMappingURL=user.repository.js.map