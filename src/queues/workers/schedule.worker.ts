import { ScheduledJobStatus } from '@prisma/client';
import { QUEUE_NAMES, type ScheduleJobData } from '../../types';
import { jobRepository } from '../../repositories/job.repository';
import { postRepository } from '../../repositories/post.repository';
import { postService } from '../../services/post.service';
import { NonRetryableError } from '../../lib/errors';
import { notifyUser } from '../../telegram/notifier';
import { createWorker } from '../worker-utils';

export function startScheduleWorker() {
  return createWorker<ScheduleJobData>(QUEUE_NAMES.schedule, async (job) => {
    const { scheduledJobId, postId } = job.data;

    const scheduled = await jobRepository.findScheduledJob(scheduledJobId);
    if (!scheduled) throw new NonRetryableError(`ScheduledJob ${scheduledJobId} not found`);
    if (scheduled.status !== ScheduledJobStatus.PENDING) {
      return; // cancelled or already dispatched
    }

    const post = await postRepository.findWithRelations(postId);
    if (!post) throw new NonRetryableError(`Post ${postId} not found`);
    if (post.status === 'CANCELLED') return;

    await postService.markScheduledDispatched(scheduledJobId);
    const { created, skipped } = await postService.dispatchPublish(postId, post.user.language);
    await notifyUser(
      post.user.telegramId,
      `🕒 Scheduled post is going out now (${created} target(s)).${
        skipped.length > 0 ? `\n⚠️ Skipped: ${skipped.join(', ')}` : ''
      }`,
    );
  });
}
