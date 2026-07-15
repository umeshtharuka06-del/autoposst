"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deadLetterQueue = exports.scheduleQueue = exports.publishQueue = exports.aiQueue = exports.mediaQueue = exports.defaultJobOptions = void 0;
exports.enqueueMediaProcessing = enqueueMediaProcessing;
exports.enqueueAiGeneration = enqueueAiGeneration;
exports.enqueuePublish = enqueuePublish;
exports.enqueueScheduled = enqueueScheduled;
exports.removeScheduledBullJob = removeScheduledBullJob;
exports.queueCounts = queueCounts;
exports.closeQueues = closeQueues;
const bullmq_1 = require("bullmq");
const env_1 = require("../config/env");
const redis_1 = require("../lib/redis");
const types_1 = require("../types");
const connection = redis_1.redisConnectionOptions;
exports.defaultJobOptions = {
    attempts: env_1.env.JOB_ATTEMPTS,
    backoff: { type: 'exponential', delay: env_1.env.JOB_BACKOFF_MS },
    removeOnComplete: { age: 7 * 24 * 3600, count: 500 },
    removeOnFail: false,
};
exports.mediaQueue = new bullmq_1.Queue(types_1.QUEUE_NAMES.media, { connection, defaultJobOptions: exports.defaultJobOptions });
exports.aiQueue = new bullmq_1.Queue(types_1.QUEUE_NAMES.ai, { connection, defaultJobOptions: exports.defaultJobOptions });
exports.publishQueue = new bullmq_1.Queue(types_1.QUEUE_NAMES.publish, { connection, defaultJobOptions: exports.defaultJobOptions });
exports.scheduleQueue = new bullmq_1.Queue(types_1.QUEUE_NAMES.schedule, { connection, defaultJobOptions: exports.defaultJobOptions });
exports.deadLetterQueue = new bullmq_1.Queue(types_1.QUEUE_NAMES.deadLetter, {
    connection,
    defaultJobOptions: { attempts: 1, removeOnComplete: false, removeOnFail: false },
});
async function enqueueMediaProcessing(postId) {
    const job = await exports.mediaQueue.add('process-media', { postId });
    return job.id ?? '';
}
async function enqueueAiGeneration(postId) {
    const job = await exports.aiQueue.add('generate-content', { postId });
    return job.id ?? '';
}
async function enqueuePublish(platformJobId) {
    const job = await exports.publishQueue.add('publish', { platformJobId });
    return job.id ?? '';
}
async function enqueueScheduled(scheduledJobId, postId, runAt) {
    const delay = Math.max(0, runAt.getTime() - Date.now());
    const job = await exports.scheduleQueue.add('dispatch-scheduled', { scheduledJobId, postId }, { delay });
    return job.id ?? '';
}
async function removeScheduledBullJob(bullJobId) {
    const job = await exports.scheduleQueue.getJob(bullJobId);
    if (job)
        await job.remove();
}
async function queueCounts() {
    const out = {};
    for (const q of [exports.mediaQueue, exports.aiQueue, exports.publishQueue, exports.scheduleQueue, exports.deadLetterQueue]) {
        const counts = await q.getJobCounts('waiting', 'active', 'failed', 'delayed');
        out[q.name] = {
            waiting: counts.waiting ?? 0,
            active: counts.active ?? 0,
            failed: counts.failed ?? 0,
            delayed: counts.delayed ?? 0,
        };
    }
    return out;
}
async function closeQueues() {
    await Promise.all([exports.mediaQueue.close(), exports.aiQueue.close(), exports.publishQueue.close(), exports.scheduleQueue.close(), exports.deadLetterQueue.close()]);
}
//# sourceMappingURL=queues.js.map