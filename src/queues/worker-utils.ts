import { Job, Worker } from 'bullmq';
import { Prisma } from '@prisma/client';
import { env } from '../config/env';
import { redisConnectionOptions } from '../lib/redis';
import { logger } from '../lib/logger';
import { NonRetryableError, errorMessage } from '../lib/errors';
import { jobRepository } from '../repositories/job.repository';
import { deadLetterQueue } from './queues';
import { UnrecoverableError } from 'bullmq';

/**
 * Creates a worker with shared behavior:
 *  - job_logs rows on start/complete/fail
 *  - NonRetryableError -> BullMQ UnrecoverableError (skips remaining attempts)
 *  - final failure -> failed_jobs record + dead-letter queue entry
 */
export function createWorker<T>(
  queueName: string,
  processor: (job: Job<T>) => Promise<void>,
  opts?: { concurrency?: number },
): Worker<T> {
  const worker = new Worker<T>(
    queueName,
    async (job) => {
      await jobRepository.log({
        queue: queueName,
        bullJobId: job.id ?? null,
        level: 'INFO',
        message: `started ${job.name} (attempt ${job.attemptsMade + 1}/${job.opts.attempts ?? 1})`,
        data: job.data as Prisma.InputJsonValue,
      });
      try {
        await processor(job);
      } catch (err) {
        if (err instanceof NonRetryableError) {
          throw new UnrecoverableError(err.message);
        }
        throw err;
      }
    },
    {
      connection: redisConnectionOptions,
      concurrency: opts?.concurrency ?? env.WORKER_CONCURRENCY,
    },
  );

  worker.on('completed', (job) => {
    void jobRepository.log({
      queue: queueName,
      bullJobId: job.id ?? null,
      level: 'INFO',
      message: `completed ${job.name}`,
    });
  });

  worker.on('failed', (job, err) => {
    const attemptsMade = job?.attemptsMade ?? 0;
    const maxAttempts = job?.opts.attempts ?? 1;
    const final = !job || attemptsMade >= maxAttempts || err instanceof UnrecoverableError;

    void jobRepository.log({
      queue: queueName,
      bullJobId: job?.id ?? null,
      level: final ? 'ERROR' : 'WARN',
      message: `${final ? 'FINAL failure' : `attempt ${attemptsMade} failed`}: ${err.message}`,
    });

    if (final && job) {
      void (async () => {
        await jobRepository.recordFailedJob({
          queue: queueName,
          bullJobId: job.id ?? null,
          name: job.name,
          data: job.data as Prisma.InputJsonValue,
          failedReason: errorMessage(err),
          stacktrace: err.stack ?? null,
          attemptsMade,
        });
        await deadLetterQueue.add('dead', {
          queue: queueName,
          name: job.name,
          data: job.data,
          failedReason: errorMessage(err),
          attemptsMade,
        });
      })().catch((e) => logger.error({ e }, 'failed to record dead letter'));
    }
  });

  worker.on('error', (err) => logger.error({ queue: queueName, err: err.message }, 'worker error'));
  logger.info({ queue: queueName, concurrency: opts?.concurrency ?? env.WORKER_CONCURRENCY }, 'worker started');
  return worker;
}
