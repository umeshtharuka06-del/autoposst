"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseWhen = parseWhen;
exports.registerPostingCommands = registerPostingCommands;
const client_1 = require("@prisma/client");
const errors_1 = require("../../lib/errors");
const post_service_1 = require("../../services/post.service");
const types_1 = require("../../types");
const keyboards_1 = require("../keyboards");
const notifier_1 = require("../notifier");
/** Parses "+30m", "+2h", "+1d" or "YYYY-MM-DD HH:mm" (server time). */
function parseWhen(parts) {
    const first = parts[0];
    if (!first)
        return null;
    const rel = first.match(/^\+(\d+)([mhd])$/i);
    if (rel) {
        const n = parseInt(rel[1], 10);
        const unitMs = rel[2].toLowerCase() === 'm' ? 60_000 : rel[2].toLowerCase() === 'h' ? 3_600_000 : 86_400_000;
        return { runAt: new Date(Date.now() + n * unitMs), consumed: 1 };
    }
    const second = parts[1];
    if (/^\d{4}-\d{2}-\d{2}$/.test(first) && second && /^\d{1,2}:\d{2}$/.test(second)) {
        const dt = new Date(`${first}T${second.padStart(5, '0')}:00`);
        if (!isNaN(dt.getTime()))
            return { runAt: dt, consumed: 2 };
    }
    return null;
}
async function resolvePostId(ctx, explicit) {
    if (explicit)
        return explicit;
    const latest = await post_service_1.postService.findLatestForUser(ctx.dbUser.id);
    return latest?.id ?? null;
}
function registerPostingCommands(bot) {
    bot.command('post', async (ctx) => {
        const post = await post_service_1.postService.findLatestForUser(ctx.dbUser.id);
        if (!post) {
            await ctx.reply('No posts yet. Send me a photo, video or album with a caption to create one.');
            return;
        }
        const jobs = post.platformJobs
            .map((j) => `  ${j.platform} [${j.language}]: ${j.status}${j.externalUrl ? ` — ${j.externalUrl}` : ''}`)
            .join('\n');
        const drafts = post.redditDrafts.map((d) => `  r/${d.subreddit}: ${d.status}`).join('\n');
        const text = `<b>📄 Latest post</b> <code>${post.id}</code>\n` +
            `Status: <b>${post.status}</b>\n` +
            `Media: ${post.media.length} item(s)\n` +
            (post.caption ? `Caption: ${(0, notifier_1.escapeHtml)(post.caption.slice(0, 200))}\n` : '') +
            (post.scheduledAt ? `Scheduled: ${post.scheduledAt.toISOString()}\n` : '') +
            (jobs ? `\n<b>Platform jobs</b>\n${jobs}\n` : '') +
            (drafts ? `\n<b>Reddit drafts</b>\n${drafts}` : '');
        const keyboard = post.status === client_1.PostStatus.READY
            ? (0, keyboards_1.postReadyKeyboard)(post.id, ctx.dbUser.language)
            : post.status === client_1.PostStatus.FAILED || post.status === client_1.PostStatus.PARTIALLY_PUBLISHED
                ? (0, keyboards_1.retryKeyboard)(post.id)
                : undefined;
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
    });
    bot.command('publish', async (ctx) => {
        const arg = ctx.match.trim() || undefined;
        const postId = await resolvePostId(ctx, arg);
        if (!postId) {
            await ctx.reply('Nothing to publish. Send media first, or pass a post ID: /publish <postId>');
            return;
        }
        try {
            const { created, skipped } = await post_service_1.postService.dispatchPublish(postId, ctx.dbUser.language);
            await ctx.reply(`🚀 Publishing <code>${postId}</code> in ${types_1.LANGUAGE_LABELS[ctx.dbUser.language]} to ${created} target(s).` +
                (skipped.length > 0 ? `\n⚠️ Skipped: ${skipped.join(', ')}` : ''), { parse_mode: 'HTML' });
        }
        catch (err) {
            await ctx.reply(`❌ ${(0, notifier_1.escapeHtml)((0, errors_1.errorMessage)(err))}`, { parse_mode: 'HTML' });
        }
    });
    bot.command('schedule', async (ctx) => {
        const parts = ctx.match.trim().split(/\s+/).filter(Boolean);
        const when = parseWhen(parts);
        if (!when) {
            await ctx.reply('Usage:\n/schedule +2h [postId]\n/schedule +30m [postId]\n/schedule 2026-07-16 09:00 [postId]\n(times are server time)');
            return;
        }
        const postId = await resolvePostId(ctx, parts[when.consumed]);
        if (!postId) {
            await ctx.reply('No post found to schedule. Send media first.');
            return;
        }
        try {
            await post_service_1.postService.schedulePost(postId, when.runAt);
            await ctx.reply(`🕒 Post <code>${postId}</code> scheduled for ${when.runAt.toISOString()}.`, {
                parse_mode: 'HTML',
            });
        }
        catch (err) {
            await ctx.reply(`❌ ${(0, notifier_1.escapeHtml)((0, errors_1.errorMessage)(err))}`, { parse_mode: 'HTML' });
        }
    });
    bot.command('retry', async (ctx) => {
        const arg = ctx.match.trim() || undefined;
        const count = await post_service_1.postService.retryFailed(arg);
        await ctx.reply(count > 0 ? `🔁 Re-queued ${count} failed job(s).` : 'No failed jobs to retry. ✨');
    });
    bot.command('cancel', async (ctx) => {
        const arg = ctx.match.trim() || undefined;
        const postId = await resolvePostId(ctx, arg);
        if (!postId) {
            await ctx.reply('No post to cancel.');
            return;
        }
        try {
            await post_service_1.postService.cancelPost(postId, ctx.dbUser.id);
            await ctx.reply(`🚫 Post <code>${postId}</code> cancelled.`, { parse_mode: 'HTML' });
        }
        catch (err) {
            await ctx.reply(`❌ ${(0, notifier_1.escapeHtml)((0, errors_1.errorMessage)(err))}`, { parse_mode: 'HTML' });
        }
    });
}
//# sourceMappingURL=posting.js.map