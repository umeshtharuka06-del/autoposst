"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleCallback = handleCallback;
const client_1 = require("@prisma/client");
const logger_1 = require("../../lib/logger");
const errors_1 = require("../../lib/errors");
const user_repository_1 = require("../../repositories/user.repository");
const post_service_1 = require("../../services/post.service");
const reddit_draft_service_1 = require("../../services/publishers/reddit.draft.service");
const types_1 = require("../../types");
const notifier_1 = require("../notifier");
/** Routes inline-keyboard callback data (see keyboards.ts for the format). */
async function handleCallback(ctx) {
    const data = ctx.callbackQuery?.data;
    if (!data)
        return;
    const [action, ...rest] = data.split(':');
    try {
        switch (action) {
            case 'pub': {
                const [postId, lang] = rest;
                if (!postId || !lang)
                    break;
                const { created, skipped } = await post_service_1.postService.dispatchPublish(postId, lang);
                await ctx.answerCallbackQuery({ text: `Publishing to ${created} target(s)` });
                await ctx.reply(`🚀 Publishing post <code>${postId}</code> in ${types_1.LANGUAGE_LABELS[lang]} to ${created} target(s).` +
                    (skipped.length > 0 ? `\n⚠️ Skipped: ${skipped.join(', ')}` : ''), { parse_mode: 'HTML' });
                break;
            }
            case 'sch': {
                const [postId] = rest;
                await ctx.answerCallbackQuery();
                await ctx.reply(`To schedule this post, send:\n<code>/schedule +2h ${postId}</code>\nor <code>/schedule 2026-07-16 09:00 ${postId}</code>`, { parse_mode: 'HTML' });
                break;
            }
            case 'cxl': {
                const [postId] = rest;
                if (!postId)
                    break;
                await post_service_1.postService.cancelPost(postId, ctx.dbUser.id);
                await ctx.answerCallbackQuery({ text: 'Post cancelled' });
                await ctx.reply(`🚫 Post <code>${postId}</code> cancelled.`, { parse_mode: 'HTML' });
                break;
            }
            case 'rty': {
                const [postId] = rest;
                const count = await post_service_1.postService.retryFailed(postId);
                await ctx.answerCallbackQuery({ text: `Retrying ${count} job(s)` });
                await ctx.reply(`🔁 Re-queued ${count} failed platform job(s).`);
                break;
            }
            case 'rda': {
                const [draftId] = rest;
                if (!draftId)
                    break;
                await ctx.answerCallbackQuery({ text: 'Publishing to Reddit…' });
                const draft = await reddit_draft_service_1.redditDraftService.approveAndPublish(draftId, ctx.dbUser.id);
                if (draft.status === client_1.DraftStatus.PUBLISHED) {
                    await ctx.reply(`✅ Posted to r/${(0, notifier_1.escapeHtml)(draft.subreddit)}\n${(0, notifier_1.escapeHtml)(draft.externalUrl ?? '')}`, {
                        parse_mode: 'HTML',
                    });
                }
                else {
                    await ctx.reply(`❌ Reddit rejected the post:\n<code>${(0, notifier_1.escapeHtml)(draft.errorMessage ?? 'unknown error')}</code>\n` +
                        `You can change the subreddit with /reddit sub ${draft.id} &lt;name&gt; and approve again.`, { parse_mode: 'HTML' });
                }
                break;
            }
            case 'rdr': {
                const [draftId] = rest;
                if (!draftId)
                    break;
                await reddit_draft_service_1.redditDraftService.reject(draftId, ctx.dbUser.id);
                await ctx.answerCallbackQuery({ text: 'Draft rejected' });
                await ctx.reply('🗑 Reddit draft rejected. Nothing was posted.');
                break;
            }
            case 'lng': {
                const [lang] = rest;
                if (!lang)
                    break;
                await user_repository_1.userRepository.setLanguage(ctx.dbUser.id, lang);
                await ctx.answerCallbackQuery({ text: `Language: ${types_1.LANGUAGE_LABELS[lang]}` });
                await ctx.reply(`🌐 Default publish language set to ${types_1.LANGUAGE_LABELS[lang]}.`);
                break;
            }
            case 'ton': {
                const [tone] = rest;
                if (!tone)
                    break;
                await user_repository_1.userRepository.setTone(ctx.dbUser.id, tone);
                await ctx.answerCallbackQuery({ text: `Tone: ${types_1.TONE_LABELS[tone]}` });
                await ctx.reply(`🎨 Content tone set to ${types_1.TONE_LABELS[tone]}. Applies to your next posts.`);
                break;
            }
            default:
                await ctx.answerCallbackQuery({ text: 'Unknown action' });
        }
    }
    catch (err) {
        logger_1.logger.error({ data, err: (0, errors_1.errorMessage)(err) }, 'callback failed');
        await ctx.answerCallbackQuery({ text: 'Error — see chat', show_alert: false }).catch(() => undefined);
        await ctx.reply(`❌ ${(0, notifier_1.escapeHtml)((0, errors_1.errorMessage)(err))}`, { parse_mode: 'HTML' }).catch(() => undefined);
    }
}
//# sourceMappingURL=callbacks.js.map