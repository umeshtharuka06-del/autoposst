"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWorker = createWorker;
const bullmq_1 = require("bullmq");
const env_1 = require("../config/env");
const redis_1 = require("../lib/redis");
const logger_1 = require("../lib/logger");
const errors_1 = require("../lib/errors");
const job_repository_1 = require("../repositories/job.repository");
const queues_1 = require("./queues");
const bullmq_2 = require("bullmq");
/**
 * Creates a worker with shared behavior:
 *  - job_logs rows on start/complete/fail
 *  - NonRetryableError -> BullMQ UnrecoverableError (skips remaining attempts)
 *  - final failure -> failed_jobs record + dead-letter queue entry
 */
function createWorker(queueName, processor, opts) {
    const worker = new bullmq_1.Worker(queueName, async (job) => {
        await job_repository_1.jobRepository.log({
            queue: queueName,
            bullJobId: job.id ?? null,
            level: 'INFO',
            message: `started ${job.name} (attempt ${job.attemptsMade + 1}/${job.opts.attempts ?? 1})`,
            data: job.data,
        });
        try {
            await processor(job);
        }
        catch (err) {
            if (err instanceof errors_1.NonRetryableError) {
                throw new bullmq_2.UnrecoverableError(err.message);
            }
            throw err;
        }
    }, {
        connection: redis_1.redisConnectionOptions,
        concurrency: opts?.concurrency ?? env_1.env.WORKER_CONCURRENCY,
    });
    worker.on('completed', (job) => {
        void job_repository_1.jobRepository.log({
            queue: queueName,
            bullJobId: job.id ?? null,
            level: 'INFO',
            message: `completed ${job.name}`,
        });
    });
    worker.on('failed', (job, err) => {
        const attemptsMade = job?.attemptsMade ?? 0;
        const maxAttempts = job?.opts.attempts ?? 1;
        const final = !job || attemptsMade >= maxAttempts || err instanceof bullmq_2.UnrecoverableError;
        void job_repository_1.jobRepository.log({
            queue: queueName,
            bullJobId: job?.id ?? null,
            level: final ? 'ERROR' : 'WARN',
            message: `${final ? 'FINAL failure' : `attempt ${attemptsMade} failed`}: ${err.message}`,
        });
        if (final && job) {
            void (async () => {
                await job_repository_1.jobRepository.recordFailedJob({
                    queue: queueName,
                    bullJobId: job.id ?? null,
                    name: job.name,
                    data: job.data,
                    failedReason: (0, errors_1.errorMessage)(err),
                    stacktrace: err.stack ?? null,
                    attemptsMade,
                });
                await queues_1.deadLetterQueue.add('dead', {
                    queue: queueName,
                    name: job.name,
                    data: job.data,
                    failedReason: (0, errors_1.errorMessage)(err),
                    attemptsMade,
                });
            })().catch((e) => logger_1.logger.error({ e }, 'failed to record dead letter'));
        }
    });
    worker.on('error', (err) => logger_1.logger.error({ queue: queueName, err: err.message }, 'worker error'));
    logger_1.logger.info({ queue: queueName, concurrency: opts?.concurrency ?? env_1.env.WORKER_CONCURRENCY }, 'worker started');
    return worker;
}
//# sourceMappingURL=worker-utils.js.map