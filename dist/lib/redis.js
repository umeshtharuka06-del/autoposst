"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisConnectionOptions = void 0;
const env_1 = require("../config/env");
/**
 * Plain connection options shared by all BullMQ queues/workers. BullMQ
 * instantiates its own ioredis clients from these (it bundles its own
 * ioredis, so passing options avoids duplicate-client type conflicts).
 * maxRetriesPerRequest must be null for BullMQ blocking commands.
 */
exports.redisConnectionOptions = {
    host: env_1.env.REDIS_HOST,
    port: env_1.env.REDIS_PORT,
    password: env_1.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
};
//# sourceMappingURL=redis.js.map