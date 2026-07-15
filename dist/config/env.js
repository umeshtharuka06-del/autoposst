"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
require("dotenv/config");
const zod_1 = require("zod");
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('production'),
    LOG_LEVEL: zod_1.z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
    TELEGRAM_BOT_TOKEN: zod_1.z.string().min(20),
    TELEGRAM_ALLOWED_USER_IDS: zod_1.z
        .string()
        .min(1)
        .transform((s) => s
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v.length > 0)
        .map((v) => BigInt(v))),
    DATABASE_URL: zod_1.z.string().url(),
    REDIS_HOST: zod_1.z.string().default('redis'),
    REDIS_PORT: zod_1.z.coerce.number().int().positive().default(6379),
    REDIS_PASSWORD: zod_1.z.string().optional(),
    ENCRYPTION_KEY: zod_1.z
        .string()
        .regex(/^[0-9a-fA-F]{64}$/, 'ENCRYPTION_KEY must be 64 hex chars (32 bytes). Generate with: openssl rand -hex 32'),
    OPENAI_API_KEY: zod_1.z.string().min(10),
    OPENAI_MODEL: zod_1.z.string().default('gpt-4o'),
    OPENAI_MAX_OUTPUT_TOKENS: zod_1.z.coerce.number().int().positive().default(4096),
    FACEBOOK_GRAPH_VERSION: zod_1.z.string().default('v21.0'),
    PINTEREST_API_BASE: zod_1.z.string().url().default('https://api.pinterest.com/v5'),
    REDDIT_CLIENT_ID: zod_1.z.string().optional().default(''),
    REDDIT_CLIENT_SECRET: zod_1.z.string().optional().default(''),
    REDDIT_REFRESH_TOKEN: zod_1.z.string().optional().default(''),
    REDDIT_USER_AGENT: zod_1.z.string().default('autopost/1.0'),
    MEDIA_STORAGE_PATH: zod_1.z.string().default('/app/storage/media'),
    MEDIA_COMPRESS_THRESHOLD_BYTES: zod_1.z.coerce.number().int().positive().default(4 * 1024 * 1024),
    THUMBNAIL_WIDTH: zod_1.z.coerce.number().int().positive().default(512),
    JOB_ATTEMPTS: zod_1.z.coerce.number().int().min(1).max(20).default(5),
    JOB_BACKOFF_MS: zod_1.z.coerce.number().int().positive().default(15000),
    WORKER_CONCURRENCY: zod_1.z.coerce.number().int().min(1).max(20).default(3),
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('Invalid environment configuration:');
    for (const issue of parsed.error.issues) {
        // eslint-disable-next-line no-console
        console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
}
exports.env = parsed.data;
//# sourceMappingURL=env.js.map