import type { Worker } from 'bullmq';
import { startAiWorker } from './ai.worker';
import { startMediaWorker } from './media.worker';
import { startPublishWorker } from './publish.worker';
import { startScheduleWorker } from './schedule.worker';

export function startAllWorkers(): Worker[] {
  return [startMediaWorker(), startAiWorker(), startPublishWorker(), startScheduleWorker()];
}

export async function stopWorkers(workers: Worker[]): Promise<void> {
  await Promise.all(workers.map((w) => w.close()));
}
