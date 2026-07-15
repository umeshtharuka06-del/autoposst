import {
  Language,
  MediaType,
  Platform,
  PlatformJobStatus,
  PostStatus,
  ScheduledJobStatus,
  Tone,
  User,
} from '@prisma/client';
import { logger } from '../lib/logger';
import { NotFoundError, ValidationError } from '../lib/errors';
import { auditRepository } from '../repositories/audit.repository';
import { facebookRepository } from '../repositories/facebook.repository';
import { jobRepository } from '../repositories/job.repository';
import { mediaRepository } from '../repositories/media.repository';
import { messageRepository } from '../repositories/message.repository';
import { pinterestRepository } from '../repositories/pinterest.repository';
import { postRepository, PostWithRelations } from '../repositories/post.repository';
import {
  enqueueMediaProcessing,
  enqueuePublish,
  enqueueScheduled,
  removeScheduledBullJob,
} from '../queues/queues';

export interface IncomingMediaItem {
  telegramFileId: string;
  type: MediaType;
  mimeType?: string | null;
  fileSize?: number | null;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
}

export class PostService {
  /**
   * Creates a post from an incoming Telegram message/album and starts the
   * pipeline: media download -> AI generation -> (auto)publish.
   */
  async createFromTelegram(params: {
    user: User;
    caption: string | null;
    tone: Tone;
    autoPublish: boolean;
    mediaItems: IncomingMediaItem[];
    messageDbIds: string[];
  }): Promise<string> {
    if (params.mediaItems.length === 0) {
      throw new ValidationError('A post needs at least one photo, video or document');
    }

    const post = await postRepository.create({
      userId: params.user.id,
      caption: params.caption,
      tone: params.tone,
      autoPublish: params.autoPublish,
    });

    for (const [i, item] of params.mediaItems.entries()) {
      await mediaRepository.create({
        postId: post.id,
        telegramFileId: item.telegramFileId,
        type: item.type,
        mimeType: item.mimeType ?? null,
        fileSize: item.fileSize ?? null,
        width: item.width ?? null,
        height: item.height ?? null,
        duration: item.duration ?? null,
        sortOrder: i,
      });
    }

    await messageRepository.linkToPost(params.messageDbIds, post.id);
    await postRepository.updateStatus(post.id, PostStatus.PROCESSING_MEDIA);
    await enqueueMediaProcessing(post.id);
    await auditRepository.record({
      userId: params.user.id,
      action: 'post.created',
      entity: 'Post',
      entityId: post.id,
      details: { mediaCount: params.mediaItems.length, autoPublish: params.autoPublish },
    });

    logger.info({ postId: post.id, media: params.mediaItems.length }, 'post created, pipeline started');
    return post.id;
  }

  /**
   * Fans a READY post out to Facebook + Pinterest platform jobs in the given
   * language. Reddit is intentionally excluded — it goes through drafts.
   */
  async dispatchPublish(postId: string, language: Language): Promise<{ created: number; skipped: string[] }> {
    const post = await postRepository.findWithRelations(postId);
    if (!post) throw new NotFoundError('Post', postId);
    if (post.translations.length === 0) {
      throw new ValidationError('Content has not been generated yet for this post');
    }

    const skipped: string[] = [];
    let created = 0;

    // Facebook: default page if set, otherwise every active page.
    const pages = await facebookRepository.listActive();
    const fbTargets = pages.some((p) => p.isDefault) ? pages.filter((p) => p.isDefault) : pages;
    if (fbTargets.length === 0) {
      skipped.push('Facebook (no pages configured — /facebook add)');
    }
    for (const page of fbTargets) {
      const job = await jobRepository.createPlatformJob({
        postId,
        platform: Platform.FACEBOOK,
        targetId: page.pageId,
        language,
      });
      await enqueuePublish(job.id);
      created++;
    }

    // Pinterest: default board if set, otherwise first active board.
    const boards = await pinterestRepository.listActive();
    const board = boards.find((b) => b.isDefault) ?? boards[0];
    if (!board) {
      skipped.push('Pinterest (no boards configured — /pinterest boards)');
    } else {
      const job = await jobRepository.createPlatformJob({
        postId,
        platform: Platform.PINTEREST,
        targetId: board.boardId,
        language,
      });
      await enqueuePublish(job.id);
      created++;
    }

    if (created > 0) {
      await postRepository.updateStatus(postId, PostStatus.PUBLISHING);
    }
    return { created, skipped };
  }

  async schedulePost(postId: string, runAt: Date): Promise<void> {
    const post = await postRepository.findById(postId);
    if (!post) throw new NotFoundError('Post', postId);
    if (runAt.getTime() <= Date.now()) {
      throw new ValidationError('Scheduled time must be in the future');
    }

    const scheduled = await jobRepository.createScheduledJob({ postId, runAt });
    const bullJobId = await enqueueScheduled(scheduled.id, postId, runAt);
    await jobRepository.updateScheduledJob(scheduled.id, { bullJobId });
    await postRepository.update(postId, { status: PostStatus.SCHEDULED, scheduledAt: runAt });
  }

  async cancelPost(postId: string, userId: string): Promise<void> {
    const post = await postRepository.findById(postId);
    if (!post) throw new NotFoundError('Post', postId);
    if (post.status === PostStatus.PUBLISHED) {
      throw new ValidationError('Post is already published and cannot be cancelled');
    }

    const pending = await jobRepository.findPendingScheduled();
    for (const s of pending.filter((p) => p.postId === postId)) {
      if (s.bullJobId) await removeScheduledBullJob(s.bullJobId);
    }
    await jobRepository.cancelScheduledForPost(postId);
    await postRepository.updateStatus(postId, PostStatus.CANCELLED);
    await auditRepository.record({ userId, action: 'post.cancelled', entity: 'Post', entityId: postId });
  }

  /** Re-enqueues failed platform jobs. Returns how many were retried. */
  async retryFailed(postId?: string): Promise<number> {
    const failed = postId
      ? (await jobRepository.findPlatformJobsByPost(postId)).filter(
          (j) => j.status === PlatformJobStatus.FAILED || j.status === PlatformJobStatus.DEAD,
        )
      : await jobRepository.findFailedPlatformJobs(20);

    for (const job of failed) {
      await jobRepository.updatePlatformJob(job.id, {
        status: PlatformJobStatus.PENDING,
        errorMessage: null,
      });
      await enqueuePublish(job.id);
    }
    return failed.length;
  }

  /** Called by the publish worker after each platform job settles to roll up post status. */
  async refreshPostStatus(postId: string): Promise<void> {
    const jobs = await jobRepository.findPlatformJobsByPost(postId);
    if (jobs.length === 0) return;

    const done = jobs.filter((j) => j.status === PlatformJobStatus.COMPLETED).length;
    const dead = jobs.filter((j) => j.status === PlatformJobStatus.DEAD || j.status === PlatformJobStatus.FAILED).length;
    const settled = done + dead;
    if (settled < jobs.length) return;

    if (dead === 0) {
      await postRepository.updateStatus(postId, PostStatus.PUBLISHED);
    } else if (done > 0) {
      await postRepository.updateStatus(postId, PostStatus.PARTIALLY_PUBLISHED);
    } else {
      await postRepository.updateStatus(postId, PostStatus.FAILED, 'All platform publishes failed');
    }
  }

  findLatestForUser(userId: string): Promise<PostWithRelations | null> {
    return postRepository.findLatestForUser(userId);
  }

  findWithRelations(postId: string): Promise<PostWithRelations | null> {
    return postRepository.findWithRelations(postId);
  }

  async markScheduledDispatched(scheduledJobId: string): Promise<void> {
    await jobRepository.updateScheduledJob(scheduledJobId, { status: ScheduledJobStatus.DISPATCHED });
  }
}

export const postService = new PostService();
