"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postService = exports.PostService = void 0;
const client_1 = require("@prisma/client");
const logger_1 = require("../lib/logger");
const errors_1 = require("../lib/errors");
const audit_repository_1 = require("../repositories/audit.repository");
const facebook_repository_1 = require("../repositories/facebook.repository");
const job_repository_1 = require("../repositories/job.repository");
const media_repository_1 = require("../repositories/media.repository");
const message_repository_1 = require("../repositories/message.repository");
const pinterest_repository_1 = require("../repositories/pinterest.repository");
const post_repository_1 = require("../repositories/post.repository");
const queues_1 = require("../queues/queues");
class PostService {
    /**
     * Creates a post from an incoming Telegram message/album and starts the
     * pipeline: media download -> AI generation -> (auto)publish.
     */
    async createFromTelegram(params) {
        if (params.mediaItems.length === 0) {
            throw new errors_1.ValidationError('A post needs at least one photo, video or document');
        }
        const post = await post_repository_1.postRepository.create({
            userId: params.user.id,
            caption: params.caption,
            tone: params.tone,
            autoPublish: params.autoPublish,
        });
        for (const [i, item] of params.mediaItems.entries()) {
            await media_repository_1.mediaRepository.create({
                postId: post.id,
                telegramFileId: item.telegramFileId,
                type: item.type,
                mimeType: item.mimeType ?? null,
                fileSize: item.fileSize ?? null,
                width: item.width ?? null,
                height: item.height ?? null,
                duration: item.duration ?? null,
                sortOrder: i,
            });
        }
        await message_repository_1.messageRepository.linkToPost(params.messageDbIds, post.id);
        await post_repository_1.postRepository.updateStatus(post.id, client_1.PostStatus.PROCESSING_MEDIA);
        await (0, queues_1.enqueueMediaProcessing)(post.id);
        await audit_repository_1.auditRepository.record({
            userId: params.user.id,
            action: 'post.created',
            entity: 'Post',
            entityId: post.id,
            details: { mediaCount: params.mediaItems.length, autoPublish: params.autoPublish },
        });
        logger_1.logger.info({ postId: post.id, media: params.mediaItems.length }, 'post created, pipeline started');
        return post.id;
    }
    /**
     * Fans a READY post out to Facebook + Pinterest platform jobs in the given
     * language. Reddit is intentionally excluded — it goes through drafts.
     */
    async dispatchPublish(postId, language) {
        const post = await post_repository_1.postRepository.findWithRelations(postId);
        if (!post)
            throw new errors_1.NotFoundError('Post', postId);
        if (post.translations.length === 0) {
            throw new errors_1.ValidationError('Content has not been generated yet for this post');
        }
        const skipped = [];
        let created = 0;
        // Facebook: default page if set, otherwise every active page.
        const pages = await facebook_repository_1.facebookRepository.listActive();
        const fbTargets = pages.some((p) => p.isDefault) ? pages.filter((p) => p.isDefault) : pages;
        if (fbTargets.length === 0) {
            skipped.push('Facebook (no pages configured — /facebook add)');
        }
        for (const page of fbTargets) {
            const job = await job_repository_1.jobRepository.createPlatformJob({
                postId,
                platform: client_1.Platform.FACEBOOK,
                targetId: page.pageId,
                language,
            });
            await (0, queues_1.enqueuePublish)(job.id);
            created++;
        }
        // Pinterest: default board if set, otherwise first active board.
        const boards = await pinterest_repository_1.pinterestRepository.listActive();
        const board = boards.find((b) => b.isDefault) ?? boards[0];
        if (!board) {
            skipped.push('Pinterest (no boards configured — /pinterest boards)');
        }
        else {
            const job = await job_repository_1.jobRepository.createPlatformJob({
                postId,
                platform: client_1.Platform.PINTEREST,
                targetId: board.boardId,
                language,
            });
            await (0, queues_1.enqueuePublish)(job.id);
            created++;
        }
        if (created > 0) {
            await post_repository_1.postRepository.updateStatus(postId, client_1.PostStatus.PUBLISHING);
        }
        return { created, skipped };
    }
    async schedulePost(postId, runAt) {
        const post = await post_repository_1.postRepository.findById(postId);
        if (!post)
            throw new errors_1.NotFoundError('Post', postId);
        if (runAt.getTime() <= Date.now()) {
            throw new errors_1.ValidationError('Scheduled time must be in the future');
        }
        const scheduled = await job_repository_1.jobRepository.createScheduledJob({ postId, runAt });
        const bullJobId = await (0, queues_1.enqueueScheduled)(scheduled.id, postId, runAt);
        await job_repository_1.jobRepository.updateScheduledJob(scheduled.id, { bullJobId });
        await post_repository_1.postRepository.update(postId, { status: client_1.PostStatus.SCHEDULED, scheduledAt: runAt });
    }
    async cancelPost(postId, userId) {
        const post = await post_repository_1.postRepository.findById(postId);
        if (!post)
            throw new errors_1.NotFoundError('Post', postId);
        if (post.status === client_1.PostStatus.PUBLISHED) {
            throw new errors_1.ValidationError('Post is already published and cannot be cancelled');
        }
        const pending = await job_repository_1.jobRepository.findPendingScheduled();
        for (const s of pending.filter((p) => p.postId === postId)) {
            if (s.bullJobId)
                await (0, queues_1.removeScheduledBullJob)(s.bullJobId);
        }
        await job_repository_1.jobRepository.cancelScheduledForPost(postId);
        await post_repository_1.postRepository.updateStatus(postId, client_1.PostStatus.CANCELLED);
        await audit_repository_1.auditRepository.record({ userId, action: 'post.cancelled', entity: 'Post', entityId: postId });
    }
    /** Re-enqueues failed platform jobs. Returns how many were retried. */
    async retryFailed(postId) {
        const failed = postId
            ? (await job_repository_1.jobRepository.findPlatformJobsByPost(postId)).filter((j) => j.status === client_1.PlatformJobStatus.FAILED || j.status === client_1.PlatformJobStatus.DEAD)
            : await job_repository_1.jobRepository.findFailedPlatformJobs(20);
        for (const job of failed) {
            await job_repository_1.jobRepository.updatePlatformJob(job.id, {
                status: client_1.PlatformJobStatus.PENDING,
                errorMessage: null,
            });
            await (0, queues_1.enqueuePublish)(job.id);
        }
        return failed.length;
    }
    /** Called by the publish worker after each platform job settles to roll up post status. */
    async refreshPostStatus(postId) {
        const jobs = await job_repository_1.jobRepository.findPlatformJobsByPost(postId);
        if (jobs.length === 0)
            return;
        const done = jobs.filter((j) => j.status === client_1.PlatformJobStatus.COMPLETED).length;
        const dead = jobs.filter((j) => j.status === client_1.PlatformJobStatus.DEAD || j.status === client_1.PlatformJobStatus.FAILED).length;
        const settled = done + dead;
        if (settled < jobs.length)
            return;
        if (dead === 0) {
            await post_repository_1.postRepository.updateStatus(postId, client_1.PostStatus.PUBLISHED);
        }
        else if (done > 0) {
            await post_repository_1.postRepository.updateStatus(postId, client_1.PostStatus.PARTIALLY_PUBLISHED);
        }
        else {
            await post_repository_1.postRepository.updateStatus(postId, client_1.PostStatus.FAILED, 'All platform publishes failed');
        }
    }
    findLatestForUser(userId) {
        return post_repository_1.postRepository.findLatestForUser(userId);
    }
    findWithRelations(postId) {
        return post_repository_1.postRepository.findWithRelations(postId);
    }
    async markScheduledDispatched(scheduledJobId) {
        await job_repository_1.jobRepository.updateScheduledJob(scheduledJobId, { status: client_1.ScheduledJobStatus.DISPATCHED });
    }
}
exports.PostService = PostService;
exports.postService = new PostService();
//# sourceMappingURL=post.service.js.map