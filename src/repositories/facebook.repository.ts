import { FacebookPage } from '@prisma/client';
import { prisma } from '../lib/prisma';

export class FacebookRepository {
  listActive(): Promise<FacebookPage[]> {
    return prisma.facebookPage.findMany({ where: { isActive: true }, orderBy: { createdAt: 'asc' } });
  }

  listAll(): Promise<FacebookPage[]> {
    return prisma.facebookPage.findMany({ orderBy: { createdAt: 'asc' } });
  }

  findByPageId(pageId: string): Promise<FacebookPage | null> {
    return prisma.facebookPage.findUnique({ where: { pageId } });
  }

  async upsert(params: { pageId: string; name: string; encryptedToken: string }): Promise<FacebookPage> {
    const count = await prisma.facebookPage.count();
    return prisma.facebookPage.upsert({
      where: { pageId: params.pageId },
      update: { name: params.name, encryptedToken: params.encryptedToken, isActive: true },
      create: { ...params, isDefault: count === 0 },
    });
  }

  async setDefault(pageId: string): Promise<void> {
    await prisma.$transaction([
      prisma.facebookPage.updateMany({ data: { isDefault: false } }),
      prisma.facebookPage.update({ where: { pageId }, data: { isDefault: true } }),
    ]);
  }

  deactivate(pageId: string): Promise<FacebookPage> {
    return prisma.facebookPage.update({ where: { pageId }, data: { isActive: false, isDefault: false } });
  }
}

export const facebookRepository = new FacebookRepository();
