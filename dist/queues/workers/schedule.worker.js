"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startScheduleWorker = startScheduleWorker;
const client_1 = require("@prisma/client");
const types_1 = require("../../types");
const job_repository_1 = require("../../repositories/job.repository");
const post_repository_1 = require("../../repositories/post.repository");
const post_service_1 = require("../../services/post.service");
const errors_1 = require("../../lib/errors");
const notifier_1 = require("../../telegram/notifier");
const worker_utils_1 = require("../worker-utils");
function startScheduleWorker() {
    return (0, worker_utils_1.createWorker)(types_1.QUEUE_NAMES.schedule, async (job) => {
        const { scheduledJobId, postId } = job.data;
        const scheduled = await job_repository_1.jobRepository.findScheduledJob(scheduledJobId);
        if (!scheduled)
            throw new errors_1.NonRetryableError(`ScheduledJob ${scheduledJobId} not found`);
        if (scheduled.status !== client_1.ScheduledJobStatus.PENDING) {
            return; // cancelled or already dispatched
        }
        const post = await post_repository_1.postRepository.findWithRelations(postId);
        if (!post)
            throw new errors_1.NonRetryableError(`Post ${postId} not found`);
        if (post.status === 'CANCELLED')
            return;
        await post_service_1.postService.markScheduledDispatched(scheduledJobId);
        const { created, skipped } = await post_service_1.postService.dispatchPublish(postId, post.user.language);
        await (0, notifier_1.notifyUser)(post.user.telegramId, `🕒 Scheduled post is going out now (${created} target(s)).${skipped.length > 0 ? `\n⚠️ Skipped: ${skipped.join(', ')}` : ''}`);
    });
}
//# sourceMappingURL=schedule.worker.js.map