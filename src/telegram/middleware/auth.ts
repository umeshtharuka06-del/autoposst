import type { NextFunction } from 'grammy';
import { UserRole } from '@prisma/client';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { userRepository } from '../../repositories/user.repository';
import type { BotContext } from '../context';

/**
 * Request validation for a long-polling bot: updates already come
 * authenticated from Telegram over the bot token; authorization is enforced
 * here via a strict user-ID allowlist. Everyone else is silently ignored.
 * The first ID in TELEGRAM_ALLOWED_USER_IDS becomes OWNER.
 */
export async function authMiddleware(ctx: BotContext, next: NextFunction): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const telegramId = BigInt(from.id);
  const allowed = env.TELEGRAM_ALLOWED_USER_IDS;
  if (!allowed.includes(telegramId)) {
    logger.warn({ telegramId: from.id, username: from.username }, 'unauthorized access attempt');
    return; // no reply: don't advertise the bot's purpose to strangers
  }

  const role = allowed[0] === telegramId ? UserRole.OWNER : UserRole.EDITOR;
  const user = await userRepository.upsertFromTelegram({
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
export function requireAdmin(ctx: BotContext): boolean {
  return ctx.dbUser.role === UserRole.OWNER || ctx.dbUser.role === UserRole.ADMIN;
}
