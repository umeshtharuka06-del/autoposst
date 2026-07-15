import { Language, Tone, User, UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma';

export class UserRepository {
  findByTelegramId(telegramId: bigint): Promise<User | null> {
    return prisma.user.findUnique({ where: { telegramId } });
  }

  findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  }

  upsertFromTelegram(params: {
    telegramId: bigint;
    username?: string | null;
    firstName?: string | null;
    role: UserRole;
  }): Promise<User> {
    return prisma.user.upsert({
      where: { telegramId: params.telegramId },
      update: {
        username: params.username ?? undefined,
        firstName: params.firstName ?? undefined,
      },
      create: {
        telegramId: params.telegramId,
        username: params.username ?? null,
        firstName: params.firstName ?? null,
        role: params.role,
      },
    });
  }

  setLanguage(id: string, language: Language): Promise<User> {
    return prisma.user.update({ where: { id }, data: { language } });
  }

  setTone(id: string, tone: Tone): Promise<User> {
    return prisma.user.update({ where: { id }, data: { tone } });
  }

  countUsers(): Promise<number> {
    return prisma.user.count();
  }
}

export const userRepository = new UserRepository();
