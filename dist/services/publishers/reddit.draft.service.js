"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redditDraftService = exports.RedditDraftService = void 0;
const client_1 = require("@prisma/client");
const logger_1 = require("../../lib/logger");
const errors_1 = require("../../lib/errors");
const reddit_repository_1 = require("../../repositories/reddit.repository");
const translation_repository_1 = require("../../repositories/translation.repository");
const audit_repository_1 = require("../../repositories/audit.repository");
const reddit_client_1 = require("./reddit.client");
/**
 * Reddit is deliberately NOT auto-published. This service creates a
 * subreddit-aware draft per post which a human must review and approve in
 * Telegram before a single submission is made. This keeps usage compliant
 * with Reddit's self-promotion norms and per-subreddit rules.
 */
class RedditDraftService {
    async createDraftForPost(postId, subredditSuggestion, language) {
        const translation = await translation_repository_1.translationRepository.find(postId, client_1.Platform.REDDIT, language);
        if (!translation)
            throw new errors_1.NotFoundError('Reddit translation', `${postId}/${language}`);
        const subreddit = this.normalizeSubreddit(subredditSuggestion);
        const draft = await reddit_repository_1.redditRepository.create({
            postId,
            subreddit,
            title: translation.title ?? translation.body.split('\n')[0].slice(0, 300),
            body: translation.body,
            language,
        });
        logger_1.logger.info({ postId, draftId: draft.id, subreddit }, 'reddit draft created for review');
        return draft;
    }
    /** Returns the subreddit's posted rules (best effort) for the reviewer. */
    async rulesFor(subreddit) {
        if (!reddit_client_1.redditClient.isConfigured())
            return [];
        return reddit_client_1.redditClient.fetchSubredditRules(subreddit);
    }
    async updateSubreddit(draftId, subreddit) {
        const draft = await this.requirePendingDraft(draftId);
        return reddit_repository_1.redditRepository.update(draft.id, { subreddit: this.normalizeSubreddit(subreddit) });
    }
    /** Approves the draft and submits it to Reddit — a single, human-approved post. */
    async approveAndPublish(draftId, reviewerUserId) {
        const draft = await this.requirePendingDraft(draftId);
        await reddit_repository_1.redditRepository.update(draft.id, {
            status: client_1.DraftStatus.APPROVED,
            reviewedBy: { connect: { id: reviewerUserId } },
        });
        await audit_repository_1.auditRepository.record({
            userId: reviewerUserId,
            action: 'reddit.draft.approved',
            entity: 'RedditDraft',
            entityId: draft.id,
            details: { subreddit: draft.subreddit },
        });
        try {
            const url = await reddit_client_1.redditClient.submitSelfPost(draft.subreddit, draft.title, draft.body);
            return await reddit_repository_1.redditRepository.update(draft.id, {
                status: client_1.DraftStatus.PUBLISHED,
                externalUrl: url,
                errorMessage: null,
            });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            logger_1.logger.error({ draftId, err: message }, 'reddit publish failed');
            return reddit_repository_1.redditRepository.update(draft.id, {
                status: client_1.DraftStatus.PUBLISH_FAILED,
                errorMessage: message,
            });
        }
    }
    async reject(draftId, reviewerUserId, notes) {
        const draft = await this.requirePendingDraft(draftId);
        await audit_repository_1.auditRepository.record({
            userId: reviewerUserId,
            action: 'reddit.draft.rejected',
            entity: 'RedditDraft',
            entityId: draft.id,
        });
        return reddit_repository_1.redditRepository.update(draft.id, {
            status: client_1.DraftStatus.REJECTED,
            reviewedBy: { connect: { id: reviewerUserId } },
            reviewNotes: notes ?? null,
        });
    }
    async requirePendingDraft(draftId) {
        const draft = await reddit_repository_1.redditRepository.findById(draftId);
        if (!draft)
            throw new errors_1.NotFoundError('RedditDraft', draftId);
        if (draft.status !== client_1.DraftStatus.PENDING_REVIEW && draft.status !== client_1.DraftStatus.PUBLISH_FAILED) {
            throw new errors_1.ValidationError(`Draft is already ${draft.status.toLowerCase().replace('_', ' ')}`);
        }
        return draft;
    }
    normalizeSubreddit(input) {
        const cleaned = input.trim().replace(/^\/?(r\/)?/i, '');
        if (!/^[A-Za-z0-9_]{2,21}$/.test(cleaned)) {
            throw new errors_1.ValidationError(`"${input}" is not a valid subreddit name`);
        }
        return cleaned;
    }
}
exports.RedditDraftService = RedditDraftService;
exports.redditDraftService = new RedditDraftService();
//# sourceMappingURL=reddit.draft.service.js.map