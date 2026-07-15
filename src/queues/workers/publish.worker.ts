import { Platform, PlatformJobStatus } from '@prisma/client';
import { env } from '../../config/env';
import { QUEUE_NAMES, type PublishJobData } from '../../types';
import { jobRepository } from '../../repositories/job.repository';
import { translationRepository } from '../../repositories/translation.repository';
import { mediaRepository } from '../../repositories/media.repository';
import { facebookPublisher } from '../../services/publishers/facebook.publisher';
import { pinterestPublisher } from '../../services/publishers/pinterest.publisher';
import type { Publisher } from '../../services/publishers/publisher.types';
import { postService } from '../../services/post.service';
import { NonRetryableError, errorMessage } from '../../lib/errors';
import { createWorker } from '../worker-utils';

const publishers: Record<Exclude<Platform, 'REDDIT'>, Publisher> = {
  [Platform.FACEBOOK]: facebookPublisher,
  [Platform.PINTEREST]: pinterestPublisher,
};

/**
 * One platform job = one target (a single Facebook Page or Pinterest board),
 * so every target publishes and fails independently; a failing page never
 * blocks the others. Concurrency is capped (default 3 at a time) and results
 * are stored per job. The aggregated success/failure report is sent by
 * postService.refreshPostStatus once the last job for a post settles.
 */
export function startPublishWorker() {
  return createWorker<PublishJobData>(
    QUEUE_NAMES.publish,
    async (job) => {
      const platformJob = await jobRepository.findPlatformJob(job.data.platformJobId);
      if (!platformJob) throw new NonRetryableError(`PlatformJob ${job.data.platformJobId} not found`);
      if (platformJob.status === PlatformJobStatus.COMPLETED || platformJob.status === PlatformJobStatus.CANCELLED) {
        return; // idempotency: already settled
      }
      if (platformJob.platform === Platform.REDDIT) {
        throw new NonRetryableError('Reddit publishes only through the draft-approval flow');
      }

      await jobRepository.updatePlatformJob(platformJob.id, {
        status: PlatformJobStatus.ACTIVE,
        attempts: { increment: 1 },
        bullJobId: job.id ?? null,
      });

      try {
        const translation = await translationRepository.find(
          platformJob.postId,
          platformJob.platform,
          platformJob.language,
        );
        if (!translation) {
          throw new NonRetryableError(
            `No ${platformJob.platform}/${platformJob.language} translation for post ${platformJob.postId}`,
          );
        }
        const media = await mediaRepository.findByPost(platformJob.postId);
        const publisher = publishers[platformJob.platform as Exclude<Platform, 'REDDIT'>];

        const result = await publisher.publish({
          postId: platformJob.postId,
          targetId: platformJob.targetId ?? '',
          translation,
          media,
        });

        await jobRepository.updatePlatformJob(platformJob.id, {
          status: PlatformJobStatus.COMPLETED,
          externalPostId: result.externalPostId,
          externalUrl: result.externalUrl,
          publishedAt: new Date(),
          errorMessage: null,
        });
        await jobRepository.log({
          queue: QUEUE_NAMES.publish,
          bullJobId: job.id ?? null,
          platformJobId: platformJob.id,
          level: 'INFO',
          message: `published to ${platformJob.platform} target ${platformJob.targetId ?? '?'}: ${result.externalUrl ?? result.externalPostId}`,
        });

        await postService.refreshPostStatus(platformJob.postId);
      } catch (err) {
        const isFinal = err instanceof NonRetryableError || job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
        // FAILED = retries pending (keeps existing BullMQ backoff/retry);
        // DEAD = final. Only DEAD counts as settled for the report.
        await jobRepository.updatePlatformJob(platformJob.id, {
          status: isFinal ? PlatformJobStatus.DEAD : PlatformJobStatus.FAILED,
          errorMessage: errorMessage(err),
        });
        if (isFinal) {
          await postService.refreshPostStatus(platformJob.postId);
        }
        throw err;
      }
    },
    { concurrency: env.PUBLISH_CONCURRENCY },
  );
}
