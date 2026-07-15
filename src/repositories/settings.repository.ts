import { Setting } from '@prisma/client';
import { prisma } from '../lib/prisma';

export class SettingsRepository {
  get(key: string): Promise<Setting | null> {
    return prisma.setting.findUnique({ where: { key } });
  }

  set(key: string, value: string, isSecret = false): Promise<Setting> {
    return prisma.setting.upsert({
      where: { key },
      update: { value, isSecret },
      create: { key, value, isSecret },
    });
  }

  list(): Promise<Setting[]> {
    return prisma.setting.findMany({ orderBy: { key: 'asc' } });
  }

  async delete(key: string): Promise<void> {
    await prisma.setting.deleteMany({ where: { key } });
  }
}

export const settingsRepository = new SettingsRepository();
