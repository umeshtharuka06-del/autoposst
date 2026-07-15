import { Media, MediaType, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

export class MediaRepository {
  create(params: {
    postId: string;
    telegramFileId: string;
    type: MediaType;
    mimeType?: string | null;
    fileSize?: number | null;
    width?: number | null;
    height?: number | null;
    duration?: number | null;
    sortOrder: number;
  }): Promise<Media> {
    return prisma.media.create({ data: params });
  }

  findByPost(postId: string): Promise<Media[]> {
    return prisma.media.findMany({ where: { postId }, orderBy: { sortOrder: 'asc' } });
  }

  update(id: string, data: Prisma.MediaUpdateInput): Promise<Media> {
    return prisma.media.update({ where: { id }, data });
  }
}

export const mediaRepository = new MediaRepository();
