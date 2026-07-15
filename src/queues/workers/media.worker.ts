import { PostStatus } from '@prisma/client';
import { QUEUE_NAMES, type MediaJobData } from '../../types';
import { mediaService } from '../../services/media/media.service';
import { postRepository } from '../../repositories/post.repository';
import { enqueueAiGeneration } from '../queues';
import { createWorker } from '../worker-utils';

export function startMediaWorker() {
  return createWorker<MediaJobData>(QUEUE_NAMES.media, async (job) => {
    const { postId } = job.data;
    await mediaService.processPostMedia(postId);
    await postRepository.updateStatus(postId, PostStatus.GENERATING);
    await enqueueAiGeneration(postId);
  });
}
