import type { Api } from 'grammy';
import type { InlineKeyboardMarkup } from 'grammy/types';
import { logger } from '../lib/logger';

/**
 * Decouples workers from the bot instance: the bot registers its Api at
 * startup and workers push user notifications through this module.
 */
let api: Api | null = null;

export function registerBotApi(botApi: Api): void {
  api = botApi;
}

export async function notifyUser(
  telegramId: bigint,
  text: string,
  keyboard?: InlineKeyboardMarkup,
): Promise<void> {
  if (!api) {
    logger.warn({ telegramId: telegramId.toString() }, 'notifier used before bot registration');
    return;
  }
  try {
    await api.sendMessage(Number(telegramId), text, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
      link_preview_options: { is_disabled: true },
    });
  } catch (err) {
    logger.error({ telegramId: telegramId.toString(), err }, 'failed to notify user');
  }
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
