"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startPublishWorker = startPublishWorker;
const client_1 = require("@prisma/client");
const types_1 = require("../../types");
const job_repository_1 = require("../../repositories/job.repository");
const post_repository_1 = require("../../repositories/post.repository");
const translation_repository_1 = require("../../repositories/translation.repository");
const media_repository_1 = require("../../repositories/media.repository");
const facebook_publisher_1 = require("../../services/publishers/facebook.publisher");
const pinterest_publisher_1 = require("../../services/publishers/pinterest.publisher");
const post_service_1 = require("../../services/post.service");
const errors_1 = require("../../lib/errors");
const notifier_1 = require("../../telegram/notifier");
const keyboards_1 = require("../../telegram/keyboards");
const worker_utils_1 = require("../worker-utils");
const publishers = {
    [client_1.Platform.FACEBOOK]: facebook_publisher_1.facebookPublisher,
    [client_1.Platform.PINTEREST]: pinterest_publisher_1.pinterestPublisher,
};
function startPublishWorker() {
    const worker = (0, worker_utils_1.createWorker)(types_1.QUEUE_NAMES.publish, async (job) => {
        const platformJob = await job_repository_1.jobRepository.findPlatformJob(job.data.platformJobId);
        if (!platformJob)
            throw new errors_1.NonRetryableError(`PlatformJob ${job.data.platformJobId} not found`);
        if (platformJob.status === client_1.PlatformJobStatus.COMPLETED || platformJob.status === client_1.PlatformJobStatus.CANCELLED) {
            return; // idempotency: already settled
        }
        if (platformJob.platform === client_1.Platform.REDDIT) {
            throw new errors_1.NonRetryableError('Reddit publishes only through the draft-approval flow');
        }
        await job_repository_1.jobRepository.updatePlatformJob(platformJob.id, {
            status: client_1.PlatformJobStatus.ACTIVE,
            attempts: { increment: 1 },
            bullJobId: job.id ?? null,
        });
        try {
            const translation = await translation_repository_1.translationRepository.find(platformJob.postId, platformJob.platform, platformJob.language);
            if (!translation) {
                throw new errors_1.NonRetryableError(`No ${platformJob.platform}/${platformJob.language} translation for post ${platformJob.postId}`);
            }
            const media = await media_repository_1.mediaRepository.findByPost(platformJob.postId);
            const publisher = publishers[platformJob.platform];
            const result = await publisher.publish({
                postId: platformJob.postId,
                targetId: platformJob.targetId ?? '',
                translation,
                media,
            });
            await job_repository_1.jobRepository.updatePlatformJob(platformJob.id, {
                status: client_1.PlatformJobStatus.COMPLETED,
                externalPostId: result.externalPostId,
                externalUrl: result.externalUrl,
                publishedAt: new Date(),
                errorMessage: null,
            });
            await job_repository_1.jobRepository.log({
                queue: types_1.QUEUE_NAMES.publish,
                bullJobId: job.id ?? null,
                platformJobId: platformJob.id,
                level: 'INFO',
                message: `published to ${platformJob.platform}: ${result.externalUrl ?? result.externalPostId}`,
            });
            await post_service_1.postService.refreshPostStatus(platformJob.postId);
            const post = await post_repository_1.postRepository.findWithRelations(platformJob.postId);
            if (post) {
                await (0, notifier_1.notifyUser)(post.user.telegramId, `✅ Published to <b>${platformJob.platform}</b>${result.externalUrl ? `\n${(0, notifier_1.escapeHtml)(result.externalUrl)}` : ''}`);
            }
        }
        catch (err) {
            const isFinal = err instanceof errors_1.NonRetryableError || (job.attemptsMade + 1) >= (job.opts.attempts ?? 1);
            await job_repository_1.jobRepository.updatePlatformJob(platformJob.id, {
                status: isFinal ? client_1.PlatformJobStatus.DEAD : client_1.PlatformJobStatus.FAILED,
                errorMessage: (0, errors_1.errorMessage)(err),
            });
            if (isFinal) {
                await post_service_1.postService.refreshPostStatus(platformJob.postId);
                const post = await post_repository_1.postRepository.findWithRelations(platformJob.postId);
                if (post) {
                    await (0, notifier_1.notifyUser)(post.user.telegramId, `❌ <b>${platformJob.platform}</b> publish failed permanently:\n<code>${(0, notifier_1.escapeHtml)((0, errors_1.errorMessage)(err).slice(0, 500))}</code>`, (0, keyboards_1.retryKeyboard)(platformJob.postId));
                }
            }
            throw err;
        }
    });
    return worker;
}
//# sourceMappingURL=publish.worker.js.map