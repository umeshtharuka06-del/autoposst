import { env } from '../config/env';

/**
 * Plain connection options shared by all BullMQ queues/workers. BullMQ
 * instantiates its own ioredis clients from these (it bundles its own
 * ioredis, so passing options avoids duplicate-client type conflicts).
 * maxRetriesPerRequest must be null for BullMQ blocking commands.
 */
export const redisConnectionOptions = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null as null,
  enableReadyCheck: true,
};
