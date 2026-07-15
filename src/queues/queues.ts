import { JobsOptions, Queue } from 'bullmq';
import { env } from '../config/env';
import { redisConnectionOptions } from '../lib/redis';
import {
  AiJobData,
  DeadLetterData,
  MediaJobData,
  PublishJobData,
  QUEUE_NAMES,
  ScheduleJobData,
} from '../types';

const connection = redisConnectionOptions;

export const defaultJobOptions: JobsOptions = {
  attempts: env.JOB_ATTEMPTS,
  backoff: { type: 'exponential', delay: env.JOB_BACKOFF_MS },
  removeOnComplete: { age: 7 * 24 * 3600, count: 500 },
  removeOnFail: false,
};

export const mediaQueue = new Queue<MediaJobData>(QUEUE_NAMES.media, { connection, defaultJobOptions });
export const aiQueue = new Queue<AiJobData>(QUEUE_NAMES.ai, { connection, defaultJobOptions });
export const publishQueue = new Queue<PublishJobData>(QUEUE_NAMES.publish, { connection, defaultJobOptions });
export const scheduleQueue = new Queue<ScheduleJobData>(QUEUE_NAMES.schedule, { connection, defaultJobOptions });
export const deadLetterQueue = new Queue<DeadLetterData>(QUEUE_NAMES.deadLetter, {
  connection,
  defaultJobOptions: { attempts: 1, removeOnComplete: false, removeOnFail: false },
});

export async function enqueueMediaProcessing(postId: string): Promise<string> {
  const job = await mediaQueue.add('process-media', { postId });
  return job.id ?? '';
}

export async function enqueueAiGeneration(postId: string): Promise<string> {
  const job = await aiQueue.add('generate-content', { postId });
  return job.id ?? '';
}

export async function enqueuePublish(platformJobId: string): Promise<string> {
  const job = await publishQueue.add('publish', { platformJobId });
  return job.id ?? '';
}

export async function enqueueScheduled(scheduledJobId: string, postId: string, runAt: Date): Promise<string> {
  const delay = Math.max(0, runAt.getTime() - Date.now());
  const job = await scheduleQueue.add('dispatch-scheduled', { scheduledJobId, postId }, { delay });
  return job.id ?? '';
}

export async function removeScheduledBullJob(bullJobId: string): Promise<void> {
  const job = await scheduleQueue.getJob(bullJobId);
  if (job) await job.remove();
}

export async function queueCounts(): Promise<Record<string, { waiting: number; active: number; failed: number; delayed: number }>> {
  const out: Record<string, { waiting: number; active: number; failed: number; delayed: number }> = {};
  for (const q of [mediaQueue, aiQueue, publishQueue, scheduleQueue, deadLetterQueue]) {
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

export async function closeQueues(): Promise<void> {
  await Promise.all([mediaQueue.close(), aiQueue.close(), publishQueue.close(), scheduleQueue.close(), deadLetterQueue.close()]);
}
