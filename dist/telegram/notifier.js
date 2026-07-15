"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerBotApi = registerBotApi;
exports.notifyUser = notifyUser;
exports.escapeHtml = escapeHtml;
const logger_1 = require("../lib/logger");
/**
 * Decouples workers from the bot instance: the bot registers its Api at
 * startup and workers push user notifications through this module.
 */
let api = null;
function registerBotApi(botApi) {
    api = botApi;
}
async function notifyUser(telegramId, text, keyboard) {
    if (!api) {
        logger_1.logger.warn({ telegramId: telegramId.toString() }, 'notifier used before bot registration');
        return;
    }
    try {
        await api.sendMessage(Number(telegramId), text, {
            parse_mode: 'HTML',
            reply_markup: keyboard,
            link_preview_options: { is_disabled: true },
        });
    }
    catch (err) {
        logger_1.logger.error({ telegramId: telegramId.toString(), err }, 'failed to notify user');
    }
}
function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
//# sourceMappingURL=notifier.js.map