import type { Bot } from 'grammy';
import { facebookRepository } from '../../repositories/facebook.repository';
import { pinterestRepository } from '../../repositories/pinterest.repository';
import { postRepository } from '../../repositories/post.repository';
import { redditRepository } from '../../repositories/reddit.repository';
import { queueCounts } from '../../queues/queues';
import { redditClient } from '../../services/publishers/reddit.client';
import { SETTING_KEYS, settingsService } from '../../services/settings.service';
import { LANGUAGE_LABELS, TONE_LABELS } from '../../types';
import type { BotContext } from '../context';

const HELP_TEXT = `<b>📤 AutoPost — Telegram social media automation</b>

<b>Posting</b>
Send a photo, video or album with a caption → I generate platform-ready content in English, Sinhala and Tamil, then publish to Facebook &amp; Pinterest. Reddit always gets a draft you approve first.

<b>Commands</b>
/post — show your latest post &amp; its actions
/publish [postId] — publish a ready post now
/schedule &lt;+2h | YYYY-MM-DD HH:mm&gt; [postId] — schedule
/retry [postId] — retry failed publishes
/cancel [postId] — cancel a pending/scheduled post
/status — pipeline &amp; queue health
/logs — recent job logs and failures

<b>Preferences</b>
/language — default publish language
/settings — tone, auto-publish, stored settings

<b>Platforms</b>
/facebook — manage Pages (list | add | default | remove)
/pinterest — token &amp; boards (token | boards | list | default | remove)
/reddit — review drafts (list | show | sub)

<i>Tip: captions support Telegram formatting; I use the plain text as the source of meaning.</i>`;

export function registerBasicCommands(bot: Bot<BotContext>): void {
  bot.command('start', async (ctx) => {
    await ctx.reply(
      `👋 Hi ${ctx.dbUser.firstName ?? 'there'}! I turn your Telegram media into multilingual social posts.\n\n` +
        `Send me a photo, video or album with a caption to begin — or /help for everything I can do.`,
    );
  });

  bot.command('help', async (ctx) => {
    await ctx.reply(HELP_TEXT, { parse_mode: 'HTML' });
  });

  bot.command('status', async (ctx) => {
    const [queues, statuses, pages, boards, pendingDrafts, autoPublish] = await Promise.all([
      queueCounts(),
      postRepository.countByStatus(),
      facebookRepository.listActive(),
      pinterestRepository.listActive(),
      redditRepository.findPending(100),
      settingsService.getBool(SETTING_KEYS.defaultAutoPublish, true),
    ]);

    const queueLines = Object.entries(queues)
      .map(([name, c]) => `  ${name}: ${c.active} active, ${c.waiting} waiting, ${c.delayed} delayed, ${c.failed} failed`)
      .join('\n');
    const statusLines = statuses.map((s) => `  ${s.status}: ${s._count}`).join('\n') || '  (no posts yet)';

    await ctx.reply(
      `<b>📊 System status</b>\n\n` +
        `<b>Queues</b>\n${queueLines}\n\n` +
        `<b>Posts</b>\n${statusLines}\n\n` +
        `<b>Platforms</b>\n` +
        `  Facebook pages: ${pages.length}\n` +
        `  Pinterest boards: ${boards.length}\n` +
        `  Reddit: ${redditClient.isConfigured() ? 'configured' : 'not configured'} — ${pendingDrafts.length} draft(s) awaiting review\n\n` +
        `<b>Your defaults</b>\n` +
        `  Language: ${LANGUAGE_LABELS[ctx.dbUser.language]}\n` +
        `  Tone: ${TONE_LABELS[ctx.dbUser.tone]}\n` +
        `  Auto-publish: ${autoPublish ? 'on' : 'off'}`,
      { parse_mode: 'HTML' },
    );
  });
}
