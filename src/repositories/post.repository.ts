import { Post, PostStatus, Prisma, Tone } from '@prisma/client';
import { prisma } from '../lib/prisma';

export type PostWithRelations = Prisma.PostGetPayload<{
  include: {
    media: true;
    translations: true;
    platformJobs: true;
    redditDrafts: true;
    user: true;
  };
}>;

export class PostRepository {
  create(params: { userId: string; caption: string | null; tone: Tone; autoPublish: boolean }): Promise<Post> {
    return prisma.post.create({
      data: {
        userId: params.userId,
        caption: params.caption,
        tone: params.tone,
        autoPublish: params.autoPublish,
      },
    });
  }

  findById(id: string): Promise<Post | null> {
    return prisma.post.findUnique({ where: { id } });
  }

  findWithRelations(id: string): Promise<PostWithRelations | null> {
    return prisma.post.findUnique({
      where: { id },
      include: { media: { orderBy: { sortOrder: 'asc' } }, translations: true, platformJobs: true, redditDrafts: true, user: true },
    });
  }

  findLatestForUser(userId: string): Promise<PostWithRelations | null> {
    return prisma.post.findFirst({
      where: { userId, status: { notIn: [PostStatus.CANCELLED] } },
      orderBy: { createdAt: 'desc' },
      include: { media: { orderBy: { sortOrder: 'asc' } }, translations: true, platformJobs: true, redditDrafts: true, user: true },
    });
  }

  findRecent(limit: number): Promise<PostWithRelations[]> {
    return prisma.post.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { media: { orderBy: { sortOrder: 'asc' } }, translations: true, platformJobs: true, redditDrafts: true, user: true },
    });
  }

  updateStatus(id: string, status: PostStatus, error?: string | null): Promise<Post> {
    return prisma.post.update({ where: { id }, data: { status, error: error ?? null } });
  }

  /**
   * Atomically moves a post from `from` to `to`. Returns true only for the
   * caller that actually performed the transition — used so concurrent
   * publish workers settle a post (and send its report) exactly once.
   */
  async transitionStatus(id: string, from: PostStatus, to: PostStatus): Promise<boolean> {
    const res = await prisma.post.updateMany({
      where: { id, status: from },
      data: { status: to },
    });
    return res.count === 1;
  }

  update(id: string, data: Prisma.PostUpdateInput): Promise<Post> {
    return prisma.post.update({ where: { id }, data });
  }

  countByStatus(): Promise<{ status: PostStatus; _count: number }[]> {
    return prisma.post
      .groupBy({ by: ['status'], _count: true })
      .then((rows) => rows.map((r) => ({ status: r.status, _count: r._count })));
  }
}

export const postRepository = new PostRepository();
