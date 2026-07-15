"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = require("fs/promises");
const env_1 = require("./config/env");
const logger_1 = require("./lib/logger");
const prisma_1 = require("./lib/prisma");
const bot_1 = require("./telegram/bot");
const workers_1 = require("./queues/workers");
const queues_1 = require("./queues/queues");
async function main() {
    logger_1.logger.info({ nodeEnv: env_1.env.NODE_ENV }, 'autopost starting');
    await (0, promises_1.mkdir)(env_1.env.MEDIA_STORAGE_PATH, { recursive: true });
    await prisma_1.prisma.$queryRaw `SELECT 1`;
    logger_1.logger.info('database connection OK');
    const workers = (0, workers_1.startAllWorkers)();
    const bot = (0, bot_1.createBot)();
    await (0, bot_1.setBotCommands)(bot);
    let shuttingDown = false;
    const shutdown = async (signal) => {
        if (shuttingDown)
            return;
        shuttingDown = true;
        logger_1.logger.info({ signal }, 'shutting down');
        try {
            await bot.stop();
            await (0, workers_1.stopWorkers)(workers);
            await (0, queues_1.closeQueues)();
            await (0, prisma_1.disconnectPrisma)();
            logger_1.logger.info('shutdown complete');
            process.exit(0);
        }
        catch (err) {
            logger_1.logger.error({ err }, 'error during shutdown');
            process.exit(1);
        }
    };
    process.once('SIGINT', () => void shutdown('SIGINT'));
    process.once('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('unhandledRejection', (reason) => logger_1.logger.error({ reason }, 'unhandled rejection'));
    logger_1.logger.info('starting Telegram long polling');
    await bot.start({
        onStart: (me) => logger_1.logger.info({ username: me.username }, 'bot online'),
        allowed_updates: ['message', 'callback_query'],
    });
}
main().catch((err) => {
    logger_1.logger.fatal({ err }, 'fatal startup error');
    process.exit(1);
});
//# sourceMappingURL=index.js.map