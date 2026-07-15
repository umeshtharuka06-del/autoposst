import { DraftStatus, Language, Platform, RedditDraft } from '@prisma/client';
import { logger } from '../../lib/logger';
import { NotFoundError, ValidationError } from '../../lib/errors';
import { redditRepository } from '../../repositories/reddit.repository';
import { translationRepository } from '../../repositories/translation.repository';
import { auditRepository } from '../../repositories/audit.repository';
import { redditClient } from './reddit.client';

/**
 * Reddit is deliberately NOT auto-published. This service creates a
 * subreddit-aware draft per post which a human must review and approve in
 * Telegram before a single submission is made. This keeps usage compliant
 * with Reddit's self-promotion norms and per-subreddit rules.
 */
export class RedditDraftService {
  async createDraftForPost(postId: string, subredditSuggestion: string, language: Language): Promise<RedditDraft> {
    const translation = await translationRepository.find(postId, Platform.REDDIT, language);
    if (!translation) throw new NotFoundError('Reddit translation', `${postId}/${language}`);

    const subreddit = this.normalizeSubreddit(subredditSuggestion);
    const draft = await redditRepository.create({
      postId,
      subreddit,
      title: translation.title ?? translation.body.split('\n')[0]!.slice(0, 300),
      body: translation.body,
      language,
    });
    logger.info({ postId, draftId: draft.id, subreddit }, 'reddit draft created for review');
    return draft;
  }

  /** Returns the subreddit's posted rules (best effort) for the reviewer. */
  async rulesFor(subreddit: string): Promise<string[]> {
    if (!redditClient.isConfigured()) return [];
    return redditClient.fetchSubredditRules(subreddit);
  }

  async updateSubreddit(draftId: string, subreddit: string): Promise<RedditDraft> {
    const draft = await this.requirePendingDraft(draftId);
    return redditRepository.update(draft.id, { subreddit: this.normalizeSubreddit(subreddit) });
  }

  /** Approves the draft and submits it to Reddit — a single, human-approved post. */
  async approveAndPublish(draftId: string, reviewerUserId: string): Promise<RedditDraft> {
    const draft = await this.requirePendingDraft(draftId);

    await redditRepository.update(draft.id, {
      status: DraftStatus.APPROVED,
      reviewedBy: { connect: { id: reviewerUserId } },
    });
    await auditRepository.record({
      userId: reviewerUserId,
      action: 'reddit.draft.approved',
      entity: 'RedditDraft',
      entityId: draft.id,
      details: { subreddit: draft.subreddit },
    });

    try {
      const url = await redditClient.submitSelfPost(draft.subreddit, draft.title, draft.body);
      return await redditRepository.update(draft.id, {
        status: DraftStatus.PUBLISHED,
        externalUrl: url,
        errorMessage: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ draftId, err: message }, 'reddit publish failed');
      return redditRepository.update(draft.id, {
        status: DraftStatus.PUBLISH_FAILED,
        errorMessage: message,
      });
    }
  }

  async reject(draftId: string, reviewerUserId: string, notes?: string): Promise<RedditDraft> {
    const draft = await this.requirePendingDraft(draftId);
    await auditRepository.record({
      userId: reviewerUserId,
      action: 'reddit.draft.rejected',
      entity: 'RedditDraft',
      entityId: draft.id,
    });
    return redditRepository.update(draft.id, {
      status: DraftStatus.REJECTED,
      reviewedBy: { connect: { id: reviewerUserId } },
      reviewNotes: notes ?? null,
    });
  }

  private async requirePendingDraft(draftId: string): Promise<RedditDraft> {
    const draft = await redditRepository.findById(draftId);
    if (!draft) throw new NotFoundError('RedditDraft', draftId);
    if (draft.status !== DraftStatus.PENDING_REVIEW && draft.status !== DraftStatus.PUBLISH_FAILED) {
      throw new ValidationError(`Draft is already ${draft.status.toLowerCase().replace('_', ' ')}`);
    }
    return draft;
  }

  private normalizeSubreddit(input: string): string {
    const cleaned = input.trim().replace(/^\/?(r\/)?/i, '');
    if (!/^[A-Za-z0-9_]{2,21}$/.test(cleaned)) {
      throw new ValidationError(`"${input}" is not a valid subreddit name`);
    }
    return cleaned;
  }
}

export const redditDraftService = new RedditDraftService();
