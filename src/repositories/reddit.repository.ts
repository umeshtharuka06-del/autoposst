import { DraftStatus, Language, Prisma, RedditDraft } from '@prisma/client';
import { prisma } from '../lib/prisma';

export class RedditRepository {
  create(params: {
    postId: string;
    subreddit: string;
    title: string;
    body: string;
    language: Language;
  }): Promise<RedditDraft> {
    return prisma.redditDraft.create({ data: params });
  }

  findById(id: string): Promise<RedditDraft | null> {
    return prisma.redditDraft.findUnique({ where: { id } });
  }

  findPending(limit: number): Promise<RedditDraft[]> {
    return prisma.redditDraft.findMany({
      where: { status: DraftStatus.PENDING_REVIEW },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  findByPost(postId: string): Promise<RedditDraft[]> {
    return prisma.redditDraft.findMany({ where: { postId }, orderBy: { createdAt: 'asc' } });
  }

  update(id: string, data: Prisma.RedditDraftUpdateInput): Promise<RedditDraft> {
    return prisma.redditDraft.update({ where: { id }, data });
  }
}

export const redditRepository = new RedditRepository();
