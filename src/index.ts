import { mkdir } from 'fs/promises';
import { env } from './config/env';
import { logger } from './lib/logger';
import { disconnectPrisma, prisma } from './lib/prisma';
import { createBot, setBotCommands } from './telegram/bot';
import { startAllWorkers, stopWorkers } from './queues/workers';
import { closeQueues } from './queues/queues';

async function main(): Promise<void> {
  logger.info({ nodeEnv: env.NODE_ENV }, 'autopost starting');

  await mkdir(env.MEDIA_STORAGE_PATH, { recursive: true });
  await prisma.$queryRaw`SELECT 1`;
  logger.info('database connection OK');

  const workers = startAllWorkers();

  const bot = createBot();
  await setBotCommands(bot);

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutting down');
    try {
      await bot.stop();
      await stopWorkers(workers);
      await closeQueues();
      await disconnectPrisma();
      logger.info('shutdown complete');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'error during shutdown');
      process.exit(1);
    }
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => logger.error({ reason }, 'unhandled rejection'));

  logger.info('starting Telegram long polling');
  await bot.start({
    onStart: (me) => logger.info({ username: me.username }, 'bot online'),
    allowed_updates: ['message', 'callback_query'],
  });
}

main().catch((err) => {
  logger.fatal({ err }, 'fatal startup error');
  process.exit(1);
});
