import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

export const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
  ],
});

prisma.$on('error', (e) => logger.error({ prisma: e }, 'prisma error'));
prisma.$on('warn', (e) => logger.warn({ prisma: e }, 'prisma warning'));

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
