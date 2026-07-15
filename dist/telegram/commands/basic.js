"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerBasicCommands = registerBasicCommands;
const facebook_repository_1 = require("../../repositories/facebook.repository");
const pinterest_repository_1 = require("../../repositories/pinterest.repository");
const post_repository_1 = require("../../repositories/post.repository");
const reddit_repository_1 = require("../../repositories/reddit.repository");
const queues_1 = require("../../queues/queues");
const reddit_client_1 = require("../../services/publishers/reddit.client");
const settings_service_1 = require("../../services/settings.service");
const types_1 = require("../../types");
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
function registerBasicCommands(bot) {
    bot.command('start', async (ctx) => {
        await ctx.reply(`👋 Hi ${ctx.dbUser.firstName ?? 'there'}! I turn your Telegram media into multilingual social posts.\n\n` +
            `Send me a photo, video or album with a caption to begin — or /help for everything I can do.`);
    });
    bot.command('help', async (ctx) => {
        await ctx.reply(HELP_TEXT, { parse_mode: 'HTML' });
    });
    bot.command('status', async (ctx) => {
        const [queues, statuses, pages, boards, pendingDrafts, autoPublish] = await Promise.all([
            (0, queues_1.queueCounts)(),
            post_repository_1.postRepository.countByStatus(),
            facebook_repository_1.facebookRepository.listActive(),
            pinterest_repository_1.pinterestRepository.listActive(),
            reddit_repository_1.redditRepository.findPending(100),
            settings_service_1.settingsService.getBool(settings_service_1.SETTING_KEYS.defaultAutoPublish, true),
        ]);
        const queueLines = Object.entries(queues)
            .map(([name, c]) => `  ${name}: ${c.active} active, ${c.waiting} waiting, ${c.delayed} delayed, ${c.failed} failed`)
            .join('\n');
        const statusLines = statuses.map((s) => `  ${s.status}: ${s._count}`).join('\n') || '  (no posts yet)';
        await ctx.reply(`<b>📊 System status</b>\n\n` +
            `<b>Queues</b>\n${queueLines}\n\n` +
            `<b>Posts</b>\n${statusLines}\n\n` +
            `<b>Platforms</b>\n` +
            `  Facebook pages: ${pages.length}\n` +
            `  Pinterest boards: ${boards.length}\n` +
            `  Reddit: ${reddit_client_1.redditClient.isConfigured() ? 'configured' : 'not configured'} — ${pendingDrafts.length} draft(s) awaiting review\n\n` +
            `<b>Your defaults</b>\n` +
            `  Language: ${types_1.LANGUAGE_LABELS[ctx.dbUser.language]}\n` +
            `  Tone: ${types_1.TONE_LABELS[ctx.dbUser.tone]}\n` +
            `  Auto-publish: ${autoPublish ? 'on' : 'off'}`, { parse_mode: 'HTML' });
    });
}
//# sourceMappingURL=basic.js.map