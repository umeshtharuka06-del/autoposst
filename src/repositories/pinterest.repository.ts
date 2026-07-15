import { PinterestBoard } from '@prisma/client';
import { prisma } from '../lib/prisma';

export class PinterestRepository {
  listActive(): Promise<PinterestBoard[]> {
    return prisma.pinterestBoard.findMany({ where: { isActive: true }, orderBy: { createdAt: 'asc' } });
  }

  listAll(): Promise<PinterestBoard[]> {
    return prisma.pinterestBoard.findMany({ orderBy: { createdAt: 'asc' } });
  }

  findByBoardId(boardId: string): Promise<PinterestBoard | null> {
    return prisma.pinterestBoard.findUnique({ where: { boardId } });
  }

  async upsert(params: { boardId: string; name: string }): Promise<PinterestBoard> {
    const count = await prisma.pinterestBoard.count();
    return prisma.pinterestBoard.upsert({
      where: { boardId: params.boardId },
      update: { name: params.name, isActive: true },
      create: { ...params, isDefault: count === 0 },
    });
  }

  async setDefault(boardId: string): Promise<void> {
    await prisma.$transaction([
      prisma.pinterestBoard.updateMany({ data: { isDefault: false } }),
      prisma.pinterestBoard.update({ where: { boardId }, data: { isDefault: true } }),
    ]);
  }

  deactivate(boardId: string): Promise<PinterestBoard> {
    return prisma.pinterestBoard.update({ where: { boardId }, data: { isActive: false, isDefault: false } });
  }
}

export const pinterestRepository = new PinterestRepository();
