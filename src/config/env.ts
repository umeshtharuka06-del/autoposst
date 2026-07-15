import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  TELEGRAM_BOT_TOKEN: z.string().min(20),
  TELEGRAM_ALLOWED_USER_IDS: z
    .string()
    .min(1)
    .transform((s) =>
      s
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v.length > 0)
        .map((v) => BigInt(v)),
    ),

  DATABASE_URL: z.string().url(),

  REDIS_HOST: z.string().default('redis'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'ENCRYPTION_KEY must be 64 hex chars (32 bytes). Generate with: openssl rand -hex 32'),

  OPENAI_API_KEY: z.string().min(10),
  OPENAI_MODEL: z.string().default('gpt-4o'),
  OPENAI_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().default(4096),

  FACEBOOK_GRAPH_VERSION: z.string().default('v21.0'),

  PINTEREST_API_BASE: z.string().url().default('https://api.pinterest.com/v5'),

  REDDIT_CLIENT_ID: z.string().optional().default(''),
  REDDIT_CLIENT_SECRET: z.string().optional().default(''),
  REDDIT_REFRESH_TOKEN: z.string().optional().default(''),
  REDDIT_USER_AGENT: z.string().default('autopost/1.0'),

  MEDIA_STORAGE_PATH: z.string().default('/app/storage/media'),
  MEDIA_COMPRESS_THRESHOLD_BYTES: z.coerce.number().int().positive().default(4 * 1024 * 1024),
  THUMBNAIL_WIDTH: z.coerce.number().int().positive().default(512),

  JOB_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(5),
  JOB_BACKOFF_MS: z.coerce.number().int().positive().default(15000),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(20).default(3),
  PUBLISH_CONCURRENCY: z.coerce.number().int().min(1).max(10).default(3),
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

export const env = parsed.data;
export type Env = typeof env;
