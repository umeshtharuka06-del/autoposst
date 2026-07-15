import { Platform, PlatformJobStatus } from '@prisma/client';
import { QUEUE_NAMES, type PublishJobData } from '../../types';
import { jobRepository } from '../../repositories/job.repository';
import { postRepository } from '../../repositories/post.repository';
import { translationRepository } from '../../repositories/translation.repository';
import { mediaRepository } from '../../repositories/media.repository';
import { facebookPublisher } from '../../services/publishers/facebook.publisher';
import { pinterestPublisher } from '../../services/publishers/pinterest.publisher';
import type { Publisher } from '../../services/publishers/publisher.types';
import { postService } from '../../services/post.service';
import { NonRetryableError, errorMessage } from '../../lib/errors';
import { notifyUser, escapeHtml } from '../../telegram/notifier';
import { retryKeyboard } from '../../telegram/keyboards';
import { createWorker } from '../worker-utils';

const publishers: Record<Exclude<Platform, 'REDDIT'>, Publisher> = {
  [Platform.FACEBOOK]: facebookPublisher,
  [Platform.PINTEREST]: pinterestPublisher,
};

export function startPublishWorker() {
  const worker = createWorker<PublishJobData>(QUEUE_NAMES.publish, async (job) => {
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
        message: `published to ${platformJob.platform}: ${result.externalUrl ?? result.externalPostId}`,
      });

      await postService.refreshPostStatus(platformJob.postId);
      const post = await postRepository.findWithRelations(platformJob.postId);
      if (post) {
        await notifyUser(
          post.user.telegramId,
          `✅ Published to <b>${platformJob.platform}</b>${
            result.externalUrl ? `\n${escapeHtml(result.externalUrl)}` : ''
          }`,
        );
      }
    } catch (err) {
      const isFinal = err instanceof NonRetryableError || (job.attemptsMade + 1) >= (job.opts.attempts ?? 1);
      await jobRepository.updatePlatformJob(platformJob.id, {
        status: isFinal ? PlatformJobStatus.DEAD : PlatformJobStatus.FAILED,
        errorMessage: errorMessage(err),
      });
      if (isFinal) {
        await postService.refreshPostStatus(platformJob.postId);
        const post = await postRepository.findWithRelations(platformJob.postId);
        if (post) {
          await notifyUser(
            post.user.telegramId,
            `❌ <b>${platformJob.platform}</b> publish failed permanently:\n<code>${escapeHtml(
              errorMessage(err).slice(0, 500),
            )}</code>`,
            retryKeyboard(platformJob.postId),
          );
        }
      }
      throw err;
    }
  });
  return worker;
}
