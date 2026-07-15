"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startAiWorker = startAiWorker;
const client_1 = require("@prisma/client");
const types_1 = require("../../types");
const content_service_1 = require("../../services/ai/content.service");
const reddit_draft_service_1 = require("../../services/publishers/reddit.draft.service");
const post_service_1 = require("../../services/post.service");
const post_repository_1 = require("../../repositories/post.repository");
const logger_1 = require("../../lib/logger");
const errors_1 = require("../../lib/errors");
const notifier_1 = require("../../telegram/notifier");
const keyboards_1 = require("../../telegram/keyboards");
const worker_utils_1 = require("../worker-utils");
function startAiWorker() {
    return (0, worker_utils_1.createWorker)(types_1.QUEUE_NAMES.ai, async (job) => {
        const { postId } = job.data;
        const generated = await content_service_1.contentService.generateForPost(postId);
        const post = await post_repository_1.postRepository.findWithRelations(postId);
        if (!post)
            throw new errors_1.NonRetryableError(`Post ${postId} disappeared during generation`);
        const language = post.user.language;
        // Reddit: draft-for-review, never auto-published.
        const draft = await reddit_draft_service_1.redditDraftService.createDraftForPost(postId, generated.redditSubredditSuggestion, language);
        const rules = await reddit_draft_service_1.redditDraftService.rulesFor(draft.subreddit);
        await post_repository_1.postRepository.updateStatus(postId, client_1.PostStatus.READY);
        const fb = generated.FACEBOOK[language];
        const pin = generated.PINTEREST[language];
        const preview = `✨ <b>Content ready</b> (${types_1.LANGUAGE_LABELS[language]})\n\n` +
            `<b>Facebook</b>\n${(0, notifier_1.escapeHtml)(fb.body.slice(0, 500))}\n` +
            `${(0, notifier_1.escapeHtml)(fb.hashtags.join(' '))}\n\n` +
            `<b>Pinterest</b>\n<i>${(0, notifier_1.escapeHtml)(pin.title ?? '')}</i>\n${(0, notifier_1.escapeHtml)((pin.description ?? '').slice(0, 300))}\n\n` +
            `Post ID: <code>${postId}</code>`;
        if (post.autoPublish && !post.scheduledAt) {
            const { created, skipped } = await post_service_1.postService.dispatchPublish(postId, language);
            const skippedText = skipped.length > 0 ? `\n⚠️ Skipped: ${skipped.join(', ')}` : '';
            await (0, notifier_1.notifyUser)(post.user.telegramId, `${preview}\n\n🚀 Auto-publishing to ${created} target(s)…${skippedText}`);
        }
        else {
            await (0, notifier_1.notifyUser)(post.user.telegramId, preview, (0, keyboards_1.postReadyKeyboard)(postId, language));
        }
        const rulesText = rules.length > 0 ? `\n\n📏 <b>r/${draft.subreddit} rules:</b>\n• ${rules.map(notifier_1.escapeHtml).join('\n• ')}` : '';
        await (0, notifier_1.notifyUser)(post.user.telegramId, `📝 <b>Reddit draft for review</b> — r/${(0, notifier_1.escapeHtml)(draft.subreddit)}\n\n` +
            `<b>${(0, notifier_1.escapeHtml)(draft.title)}</b>\n\n${(0, notifier_1.escapeHtml)(draft.body.slice(0, 800))}${rulesText}\n\n` +
            `Reddit is never auto-posted. Review against the subreddit rules, then approve or reject.\n` +
            `Change target: <code>/reddit sub ${draft.id} &lt;subreddit&gt;</code>`, (0, keyboards_1.redditDraftKeyboard)(draft.id));
        logger_1.logger.info({ postId }, 'AI stage complete');
    }, { concurrency: 2 });
}
//# sourceMappingURL=ai.worker.js.map