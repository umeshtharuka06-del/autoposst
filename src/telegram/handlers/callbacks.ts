import { DraftStatus, Language, Tone } from '@prisma/client';
import { logger } from '../../lib/logger';
import { errorMessage } from '../../lib/errors';
import { userRepository } from '../../repositories/user.repository';
import { postService } from '../../services/post.service';
import { redditDraftService } from '../../services/publishers/reddit.draft.service';
import { LANGUAGE_LABELS, TONE_LABELS } from '../../types';
import type { BotContext } from '../context';
import { escapeHtml } from '../notifier';

/** Routes inline-keyboard callback data (see keyboards.ts for the format). */
export async function handleCallback(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  const [action, ...rest] = data.split(':');

  try {
    switch (action) {
      case 'pub': {
        const [postId, lang] = rest;
        if (!postId || !lang) break;
        const { created, skipped } = await postService.dispatchPublish(postId, lang as Language);
        await ctx.answerCallbackQuery({ text: `Publishing to ${created} target(s)` });
        await ctx.reply(
          `🚀 Publishing post <code>${postId}</code> in ${LANGUAGE_LABELS[lang as Language]} to ${created} target(s).` +
            (skipped.length > 0 ? `\n⚠️ Skipped: ${skipped.join(', ')}` : ''),
          { parse_mode: 'HTML' },
        );
        break;
      }
      case 'sch': {
        const [postId] = rest;
        await ctx.answerCallbackQuery();
        await ctx.reply(
          `To schedule this post, send:\n<code>/schedule +2h ${postId}</code>\nor <code>/schedule 2026-07-16 09:00 ${postId}</code>`,
          { parse_mode: 'HTML' },
        );
        break;
      }
      case 'cxl': {
        const [postId] = rest;
        if (!postId) break;
        await postService.cancelPost(postId, ctx.dbUser.id);
        await ctx.answerCallbackQuery({ text: 'Post cancelled' });
        await ctx.reply(`🚫 Post <code>${postId}</code> cancelled.`, { parse_mode: 'HTML' });
        break;
      }
      case 'rty': {
        const [postId] = rest;
        const count = await postService.retryFailed(postId);
        await ctx.answerCallbackQuery({ text: `Retrying ${count} job(s)` });
        await ctx.reply(`🔁 Re-queued ${count} failed platform job(s).`);
        break;
      }
      case 'rda': {
        const [draftId] = rest;
        if (!draftId) break;
        await ctx.answerCallbackQuery({ text: 'Publishing to Reddit…' });
        const draft = await redditDraftService.approveAndPublish(draftId, ctx.dbUser.id);
        if (draft.status === DraftStatus.PUBLISHED) {
          await ctx.reply(`✅ Posted to r/${escapeHtml(draft.subreddit)}\n${escapeHtml(draft.externalUrl ?? '')}`, {
            parse_mode: 'HTML',
          });
        } else {
          await ctx.reply(
            `❌ Reddit rejected the post:\n<code>${escapeHtml(draft.errorMessage ?? 'unknown error')}</code>\n` +
              `You can change the subreddit with /reddit sub ${draft.id} &lt;name&gt; and approve again.`,
            { parse_mode: 'HTML' },
          );
        }
        break;
      }
      case 'rdr': {
        const [draftId] = rest;
        if (!draftId) break;
        await redditDraftService.reject(draftId, ctx.dbUser.id);
        await ctx.answerCallbackQuery({ text: 'Draft rejected' });
        await ctx.reply('🗑 Reddit draft rejected. Nothing was posted.');
        break;
      }
      case 'lng': {
        const [lang] = rest;
        if (!lang) break;
        await userRepository.setLanguage(ctx.dbUser.id, lang as Language);
        await ctx.answerCallbackQuery({ text: `Language: ${LANGUAGE_LABELS[lang as Language]}` });
        await ctx.reply(`🌐 Default publish language set to ${LANGUAGE_LABELS[lang as Language]}.`);
        break;
      }
      case 'ton': {
        const [tone] = rest;
        if (!tone) break;
        await userRepository.setTone(ctx.dbUser.id, tone as Tone);
        await ctx.answerCallbackQuery({ text: `Tone: ${TONE_LABELS[tone as Tone]}` });
        await ctx.reply(`🎨 Content tone set to ${TONE_LABELS[tone as Tone]}. Applies to your next posts.`);
        break;
      }
      default:
        await ctx.answerCallbackQuery({ text: 'Unknown action' });
    }
  } catch (err) {
    logger.error({ data, err: errorMessage(err) }, 'callback failed');
    await ctx.answerCallbackQuery({ text: 'Error — see chat', show_alert: false }).catch(() => undefined);
    await ctx.reply(`❌ ${escapeHtml(errorMessage(err))}`, { parse_mode: 'HTML' }).catch(() => undefined);
  }
}
