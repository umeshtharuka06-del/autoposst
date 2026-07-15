import { PostStatus } from '@prisma/client';
import { QUEUE_NAMES, type AiJobData, LANGUAGE_LABELS } from '../../types';
import { contentService } from '../../services/ai/content.service';
import { redditDraftService } from '../../services/publishers/reddit.draft.service';
import { postService } from '../../services/post.service';
import { postRepository } from '../../repositories/post.repository';
import { logger } from '../../lib/logger';
import { NonRetryableError } from '../../lib/errors';
import { notifyUser, escapeHtml } from '../../telegram/notifier';
import { postReadyKeyboard, redditDraftKeyboard } from '../../telegram/keyboards';
import { createWorker } from '../worker-utils';

export function startAiWorker() {
  return createWorker<AiJobData>(
    QUEUE_NAMES.ai,
    async (job) => {
      const { postId } = job.data;
      const generated = await contentService.generateForPost(postId);

      const post = await postRepository.findWithRelations(postId);
      if (!post) throw new NonRetryableError(`Post ${postId} disappeared during generation`);
      const language = post.user.language;

      // Reddit: draft-for-review, never auto-published.
      const draft = await redditDraftService.createDraftForPost(postId, generated.redditSubredditSuggestion, language);
      const rules = await redditDraftService.rulesFor(draft.subreddit);

      await postRepository.updateStatus(postId, PostStatus.READY);

      const fb = generated.FACEBOOK[language];
      const pin = generated.PINTEREST[language];
      const preview =
        `✨ <b>Content ready</b> (${LANGUAGE_LABELS[language]})\n\n` +
        `<b>Facebook</b>\n${escapeHtml(fb.body.slice(0, 500))}\n` +
        `${escapeHtml(fb.hashtags.join(' '))}\n\n` +
        `<b>Pinterest</b>\n<i>${escapeHtml(pin.title ?? '')}</i>\n${escapeHtml((pin.description ?? '').slice(0, 300))}\n\n` +
        `Post ID: <code>${postId}</code>`;

      if (post.autoPublish && !post.scheduledAt) {
        const { created, skipped } = await postService.dispatchPublish(postId, language);
        const skippedText = skipped.length > 0 ? `\n⚠️ Skipped: ${skipped.join(', ')}` : '';
        await notifyUser(post.user.telegramId, `${preview}\n\n🚀 Auto-publishing to ${created} target(s)…${skippedText}`);
      } else {
        await notifyUser(post.user.telegramId, preview, postReadyKeyboard(postId, language));
      }

      const rulesText =
        rules.length > 0 ? `\n\n📏 <b>r/${draft.subreddit} rules:</b>\n• ${rules.map(escapeHtml).join('\n• ')}` : '';
      await notifyUser(
        post.user.telegramId,
        `📝 <b>Reddit draft for review</b> — r/${escapeHtml(draft.subreddit)}\n\n` +
          `<b>${escapeHtml(draft.title)}</b>\n\n${escapeHtml(draft.body.slice(0, 800))}${rulesText}\n\n` +
          `Reddit is never auto-posted. Review against the subreddit rules, then approve or reject.\n` +
          `Change target: <code>/reddit sub ${draft.id} &lt;subreddit&gt;</code>`,
        redditDraftKeyboard(draft.id),
      );

      logger.info({ postId }, 'AI stage complete');
    },
    { concurrency: 2 },
  );
}
