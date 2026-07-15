import { Prisma, TelegramMessage } from '@prisma/client';
import { prisma } from '../lib/prisma';

export class MessageRepository {
  create(params: {
    userId: string;
    messageId: bigint;
    chatId: bigint;
    mediaGroupId?: string | null;
    caption?: string | null;
    raw: Prisma.InputJsonValue;
    postId?: string | null;
  }): Promise<TelegramMessage> {
    return prisma.telegramMessage.create({ data: params });
  }

  linkToPost(ids: string[], postId: string): Promise<Prisma.BatchPayload> {
    return prisma.telegramMessage.updateMany({ where: { id: { in: ids } }, data: { postId } });
  }
}

export const messageRepository = new MessageRepository();
