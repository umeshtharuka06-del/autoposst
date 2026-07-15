import { Bot, GrammyError, HttpError } from 'grammy';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import type { BotContext } from './context';
import { authMiddleware } from './middleware/auth';
import { auditMiddleware } from './middleware/audit';
import { handleIncomingMedia } from './handlers/media';
import { handleCallback } from './handlers/callbacks';
import { registerBasicCommands } from './commands/basic';
import { registerPostingCommands } from './commands/posting';
import { registerPlatformCommands } from './commands/platforms';
import { registerPreferenceCommands } from './commands/preferences';
import { registerBotApi } from './notifier';

export function createBot(): Bot<BotContext> {
  const bot = new Bot<BotContext>(env.TELEGRAM_BOT_TOKEN);

  bot.use(authMiddleware);
  bot.use(auditMiddleware);

  registerBasicCommands(bot);
  registerPostingCommands(bot);
  registerPlatformCommands(bot);
  registerPreferenceCommands(bot);

  bot.on('callback_query:data', handleCallback);
  bot.on([':photo', ':video', ':document'], handleIncomingMedia);

  bot.on('message:text', async (ctx) => {
    if (ctx.message.text.startsWith('/')) {
      await ctx.reply('Unknown command. Try /help.');
    } else {
      await ctx.reply('Send me a photo, video or album (with a caption) to create a post — or /help for commands.');
    }
  });

  bot.catch((err) => {
    const e = err.error;
    if (e instanceof GrammyError) {
      logger.error({ description: e.description }, 'telegram api error');
    } else if (e instanceof HttpError) {
      logger.error({ err: e.message }, 'telegram network error');
    } else {
      logger.error({ err: e }, 'unhandled bot error');
    }
  });

  registerBotApi(bot.api);
  return bot;
}

export async function setBotCommands(bot: Bot<BotContext>): Promise<void> {
  await bot.api.setMyCommands([
    { command: 'start', description: 'Introduction' },
    { command: 'help', description: 'All commands' },
    { command: 'status', description: 'System & queue status' },
    { command: 'post', description: 'Show latest post & actions' },
    { command: 'publish', description: 'Publish a ready post now' },
    { command: 'schedule', description: 'Schedule a post (+2h / date)' },
    { command: 'retry', description: 'Retry failed publishes' },
    { command: 'cancel', description: 'Cancel a pending post' },
    { command: 'language', description: 'Default publish language' },
    { command: 'facebook', description: 'Manage Facebook Pages' },
    { command: 'pinterest', description: 'Manage Pinterest boards' },
    { command: 'reddit', description: 'Review Reddit drafts' },
    { command: 'settings', description: 'Tone, auto-publish, settings' },
    { command: 'logs', description: 'Recent job logs & failures' },
  ]);
}
