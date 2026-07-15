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
import { escapeHtml, notifyUser } from '../telegram/notifier';
import { retryKeyboard as retryKeyboardMarkup } from '../telegram/keyboards';

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

    // Facebook: fan out to EVERY active page — one platform job per page so
    // each page's result (success/failure/retries) is tracked independently.
    const pages = await facebookRepository.listActive();
    if (pages.length === 0) {
      skipped.push('Facebook (no pages configured — /facebook add)');
    }
    for (const page of pages) {
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

    const postIds = new Set<string>();
    for (const job of failed) {
      await jobRepository.updatePlatformJob(job.id, {
        status: PlatformJobStatus.PENDING,
        errorMessage: null,
      });
      await enqueuePublish(job.id);
      postIds.add(job.postId);
    }
    // Back to PUBLISHING so the settle-transition (and its report) fires again.
    for (const id of postIds) {
      await postRepository.updateStatus(id, PostStatus.PUBLISHING);
    }
    return failed.length;
  }

  /**
   * Called by the publish worker after each platform job settles. When the
   * LAST job settles, rolls up the post status and sends ONE aggregated
   * publish report. The status transition is atomic (updateMany with a
   * status guard), so concurrent workers can't send duplicate reports.
   */
  async refreshPostStatus(postId: string): Promise<void> {
    const jobs = await jobRepository.findPlatformJobsByPost(postId);
    if (jobs.length === 0) return;

    const done = jobs.filter((j) => j.status === PlatformJobStatus.COMPLETED).length;
    const dead = jobs.filter((j) => j.status === PlatformJobStatus.DEAD).length;
    const cancelled = jobs.filter((j) => j.status === PlatformJobStatus.CANCELLED).length;
    // FAILED = attempt failed but BullMQ retries are still pending → not settled.
    if (done + dead + cancelled < jobs.length) return;

    const terminal =
      dead === 0
        ? PostStatus.PUBLISHED
        : done > 0
          ? PostStatus.PARTIALLY_PUBLISHED
          : PostStatus.FAILED;

    const won = await postRepository.transitionStatus(postId, PostStatus.PUBLISHING, terminal);
    if (won) {
      await this.sendPublishReport(postId);
    }
  }

  /** Aggregated per-target publish report, sent once per publish round. */
  private async sendPublishReport(postId: string): Promise<void> {
    const post = await postRepository.findWithRelations(postId);
    if (!post) return;

    const successes: string[] = [];
    const failures: string[] = [];
    for (const job of post.platformJobs) {
      if (job.status === PlatformJobStatus.CANCELLED) continue;
      const name = await this.targetLabel(job.platform, job.targetId);
      if (job.status === PlatformJobStatus.COMPLETED) {
        successes.push(`- ${escapeHtml(name)}${job.externalUrl ? `\n  ${escapeHtml(job.externalUrl)}` : ''}`);
      } else if (job.status === PlatformJobStatus.DEAD) {
        failures.push(`- ${escapeHtml(name)}\n  ${escapeHtml((job.errorMessage ?? 'unknown error').slice(0, 300))}`);
      }
    }

    let text = `📣 <b>Publish report</b> — post <code>${postId}</code>\n`;
    if (successes.length > 0) text += `\n✅ <b>Success:</b>\n${successes.join('\n')}\n`;
    if (failures.length > 0) text += `\n❌ <b>Failed:</b>\n${failures.join('\n')}\n`;
    if (successes.length === 0 && failures.length === 0) text += '\n(no publish targets)';

    await notifyUser(
      post.user.telegramId,
      text,
      failures.length > 0 ? retryKeyboardMarkup(postId) : undefined,
    );
  }

  private async targetLabel(platform: Platform, targetId: string | null): Promise<string> {
    if (!targetId) return platform;
    if (platform === Platform.FACEBOOK) {
      const page = await facebookRepository.findByPageId(targetId);
      return `Facebook: ${page?.name ?? targetId}`;
    }
    if (platform === Platform.PINTEREST) {
      const board = await pinterestRepository.findByBoardId(targetId);
      return `Pinterest: ${board?.name ?? targetId}`;
    }
    return `${platform}: ${targetId}`;
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
