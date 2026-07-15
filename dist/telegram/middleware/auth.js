"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
exports.requireAdmin = requireAdmin;
const client_1 = require("@prisma/client");
const env_1 = require("../../config/env");
const logger_1 = require("../../lib/logger");
const user_repository_1 = require("../../repositories/user.repository");
/**
 * Request validation for a long-polling bot: updates already come
 * authenticated from Telegram over the bot token; authorization is enforced
 * here via a strict user-ID allowlist. Everyone else is silently ignored.
 * The first ID in TELEGRAM_ALLOWED_USER_IDS becomes OWNER.
 */
async function authMiddleware(ctx, next) {
    const from = ctx.from;
    if (!from)
        return;
    const telegramId = BigInt(from.id);
    const allowed = env_1.env.TELEGRAM_ALLOWED_USER_IDS;
    if (!allowed.includes(telegramId)) {
        logger_1.logger.warn({ telegramId: from.id, username: from.username }, 'unauthorized access attempt');
        return; // no reply: don't advertise the bot's purpose to strangers
    }
    const role = allowed[0] === telegramId ? client_1.UserRole.OWNER : client_1.UserRole.EDITOR;
    const user = await user_repository_1.userRepository.upsertFromTelegram({
        telegramId,
        username: from.username ?? null,
        firstName: from.first_name ?? null,
        role,
    });
    if (!user.isActive) {
        await ctx.reply('Your account has been deactivated.');
        return;
    }
    ctx.dbUser = user;
    await next();
}
/** Guards admin-level commands (platform credentials, settings). */
function requireAdmin(ctx) {
    return ctx.dbUser.role === client_1.UserRole.OWNER || ctx.dbUser.role === client_1.UserRole.ADMIN;
}
//# sourceMappingURL=auth.js.map