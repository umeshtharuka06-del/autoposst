"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBot = createBot;
exports.setBotCommands = setBotCommands;
const grammy_1 = require("grammy");
const env_1 = require("../config/env");
const logger_1 = require("../lib/logger");
const auth_1 = require("./middleware/auth");
const audit_1 = require("./middleware/audit");
const media_1 = require("./handlers/media");
const callbacks_1 = require("./handlers/callbacks");
const basic_1 = require("./commands/basic");
const posting_1 = require("./commands/posting");
const platforms_1 = require("./commands/platforms");
const preferences_1 = require("./commands/preferences");
const notifier_1 = require("./notifier");
function createBot() {
    const bot = new grammy_1.Bot(env_1.env.TELEGRAM_BOT_TOKEN);
    bot.use(auth_1.authMiddleware);
    bot.use(audit_1.auditMiddleware);
    (0, basic_1.registerBasicCommands)(bot);
    (0, posting_1.registerPostingCommands)(bot);
    (0, platforms_1.registerPlatformCommands)(bot);
    (0, preferences_1.registerPreferenceCommands)(bot);
    bot.on('callback_query:data', callbacks_1.handleCallback);
    bot.on([':photo', ':video', ':document'], media_1.handleIncomingMedia);
    bot.on('message:text', async (ctx) => {
        if (ctx.message.text.startsWith('/')) {
            await ctx.reply('Unknown command. Try /help.');
        }
        else {
            await ctx.reply('Send me a photo, video or album (with a caption) to create a post — or /help for commands.');
        }
    });
    bot.catch((err) => {
        const e = err.error;
        if (e instanceof grammy_1.GrammyError) {
            logger_1.logger.error({ description: e.description }, 'telegram api error');
        }
        else if (e instanceof grammy_1.HttpError) {
            logger_1.logger.error({ err: e.message }, 'telegram network error');
        }
        else {
            logger_1.logger.error({ err: e }, 'unhandled bot error');
        }
    });
    (0, notifier_1.registerBotApi)(bot.api);
    return bot;
}
async function setBotCommands(bot) {
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
//# sourceMappingURL=bot.js.map