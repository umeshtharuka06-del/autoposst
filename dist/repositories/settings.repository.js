"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.settingsRepository = exports.SettingsRepository = void 0;
const prisma_1 = require("../lib/prisma");
class SettingsRepository {
    get(key) {
        return prisma_1.prisma.setting.findUnique({ where: { key } });
    }
    set(key, value, isSecret = false) {
        return prisma_1.prisma.setting.upsert({
            where: { key },
            update: { value, isSecret },
            create: { key, value, isSecret },
        });
    }
    list() {
        return prisma_1.prisma.setting.findMany({ orderBy: { key: 'asc' } });
    }
    async delete(key) {
        await prisma_1.prisma.setting.deleteMany({ where: { key } });
    }
}
exports.SettingsRepository = SettingsRepository;
exports.settingsRepository = new SettingsRepository();
//# sourceMappingURL=settings.repository.js.map