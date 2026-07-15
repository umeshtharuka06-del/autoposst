import type { Bot } from 'grammy';
import { jobRepository } from '../../repositories/job.repository';
import { SETTING_KEYS, settingsService } from '../../services/settings.service';
import { TONE_LABELS, LANGUAGE_LABELS } from '../../types';
import type { BotContext } from '../context';
import { languageKeyboard, toneKeyboard } from '../keyboards';
import { requireAdmin } from '../middleware/auth';
import { escapeHtml } from '../notifier';

export function registerPreferenceCommands(bot: Bot<BotContext>): void {
  bot.command('language', async (ctx) => {
    await ctx.reply(
      `🌐 Current default publish language: <b>${LANGUAGE_LABELS[ctx.dbUser.language]}</b>\nPick a new one:`,
      { parse_mode: 'HTML', reply_markup: languageKeyboard() },
    );
  });

  bot.command('settings', async (ctx) => {
    const parts = String(ctx.match ?? '').trim().split(/\s+/).filter(Boolean);
    const [sub, value] = parts;

    if (sub === 'autopublish') {
      if (!requireAdmin(ctx)) {
        await ctx.reply('⛔ Only the owner/admin can change auto-publish.');
        return;
      }
      if (value !== 'on' && value !== 'off') {
        await ctx.reply('Usage: /settings autopublish on|off');
        return;
      }
      await settingsService.set(SETTING_KEYS.defaultAutoPublish, value === 'on' ? 'true' : 'false');
      await ctx.reply(
        value === 'on'
          ? '⚡ Auto-publish ON: new posts go straight to Facebook & Pinterest after generation (Reddit still needs approval).'
          : '✋ Auto-publish OFF: new posts wait for /publish after generation.',
      );
      return;
    }

    if (sub === 'tone') {
      await ctx.reply(`🎨 Current tone: <b>${TONE_LABELS[ctx.dbUser.tone]}</b>. Pick one:`, {
        parse_mode: 'HTML',
        reply_markup: toneKeyboard(),
      });
      return;
    }

    const autoPublish = await settingsService.getBool(SETTING_KEYS.defaultAutoPublish, true);
    const stored = await settingsService.listForDisplay();
    const storedLines = stored.length > 0 ? stored.map((s) => `  ${escapeHtml(s.key)} = ${escapeHtml(s.value)}`).join('\n') : '  (none)';

    await ctx.reply(
      `<b>⚙️ Settings</b>\n\n` +
        `Tone: <b>${TONE_LABELS[ctx.dbUser.tone]}</b> — /settings tone\n` +
        `Language: <b>${LANGUAGE_LABELS[ctx.dbUser.language]}</b> — /language\n` +
        `Auto-publish: <b>${autoPublish ? 'on' : 'off'}</b> — /settings autopublish on|off\n\n` +
        `<b>Stored settings</b>\n${storedLines}`,
      { parse_mode: 'HTML' },
    );
  });

  bot.command('logs', async (ctx) => {
    const [logs, failed] = await Promise.all([jobRepository.recentLogs(15), jobRepository.unresolvedFailedJobs(5)]);

    const logLines =
      logs.length > 0
        ? logs
            .map((l) => `  <code>${l.createdAt.toISOString().slice(11, 19)}</code> [${l.queue}] ${l.level}: ${escapeHtml(l.message.slice(0, 120))}`)
            .join('\n')
        : '  (no logs yet)';
    const failedLines =
      failed.length > 0
        ? failed.map((f) => `  [${f.queue}] ${escapeHtml(f.failedReason.slice(0, 150))}`).join('\n')
        : '  (none 🎉)';

    await ctx.reply(`<b>🧾 Recent job logs</b>\n${logLines}\n\n<b>💀 Unresolved dead-letter jobs</b>\n${failedLines}\n\nUse /retry to re-queue failed publishes.`, {
      parse_mode: 'HTML',
    });
  });
}
