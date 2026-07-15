"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.disconnectPrisma = disconnectPrisma;
const client_1 = require("@prisma/client");
const logger_1 = require("./logger");
exports.prisma = new client_1.PrismaClient({
    log: [
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
    ],
});
exports.prisma.$on('error', (e) => logger_1.logger.error({ prisma: e }, 'prisma error'));
exports.prisma.$on('warn', (e) => logger_1.logger.warn({ prisma: e }, 'prisma warning'));
async function disconnectPrisma() {
    await exports.prisma.$disconnect();
}
//# sourceMappingURL=prisma.js.map