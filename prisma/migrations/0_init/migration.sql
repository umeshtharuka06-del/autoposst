-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN', 'EDITOR');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('EN', 'SI', 'TA');

-- CreateEnum
CREATE TYPE "Tone" AS ENUM ('PROFESSIONAL', 'FRIENDLY', 'GAMING', 'LUXURY', 'CASUAL');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('PHOTO', 'VIDEO', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('RECEIVED', 'PROCESSING_MEDIA', 'GENERATING', 'READY', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'PARTIALLY_PUBLISHED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('FACEBOOK', 'PINTEREST', 'REDDIT');

-- CreateEnum
CREATE TYPE "PlatformJobStatus" AS ENUM ('PENDING', 'QUEUED', 'ACTIVE', 'COMPLETED', 'FAILED', 'DEAD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ScheduledJobStatus" AS ENUM ('PENDING', 'DISPATCHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'PUBLISHED', 'PUBLISH_FAILED');

-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('DEBUG', 'INFO', 'WARN', 'ERROR');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "telegram_id" BIGINT NOT NULL,
    "username" TEXT,
    "first_name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'EDITOR',
    "language" "Language" NOT NULL DEFAULT 'EN',
    "tone" "Tone" NOT NULL DEFAULT 'FRIENDLY',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_messages" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "message_id" BIGINT NOT NULL,
    "chat_id" BIGINT NOT NULL,
    "media_group_id" TEXT,
    "caption" TEXT,
    "raw" JSONB NOT NULL,
    "post_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "caption" TEXT,
    "tone" "Tone" NOT NULL DEFAULT 'FRIENDLY',
    "status" "PostStatus" NOT NULL DEFAULT 'RECEIVED',
    "auto_publish" BOOLEAN NOT NULL DEFAULT true,
    "scheduled_at" TIMESTAMP(3),
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "telegram_file_id" TEXT NOT NULL,
    "type" "MediaType" NOT NULL,
    "mime_type" TEXT,
    "file_size" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "duration" INTEGER,
    "local_path" TEXT,
    "thumbnail_path" TEXT,
    "compressed_path" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_outputs" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "prompt_tokens" INTEGER,
    "completion_tokens" INTEGER,
    "raw_response" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_outputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "translations" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "language" "Language" NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "description" TEXT,
    "keywords" TEXT[],
    "hashtags" TEXT[],
    "alt_text" TEXT,
    "cta" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_jobs" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "target_id" TEXT,
    "language" "Language" NOT NULL DEFAULT 'EN',
    "status" "PlatformJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "bull_job_id" TEXT,
    "external_post_id" TEXT,
    "external_url" TEXT,
    "error_message" TEXT,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_jobs" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "run_at" TIMESTAMP(3) NOT NULL,
    "status" "ScheduledJobStatus" NOT NULL DEFAULT 'PENDING',
    "bull_job_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_logs" (
    "id" TEXT NOT NULL,
    "platform_job_id" TEXT,
    "queue" TEXT NOT NULL,
    "bull_job_id" TEXT,
    "level" "LogLevel" NOT NULL DEFAULT 'INFO',
    "message" TEXT NOT NULL,
    "data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "failed_jobs" (
    "id" TEXT NOT NULL,
    "queue" TEXT NOT NULL,
    "bull_job_id" TEXT,
    "name" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "failed_reason" TEXT NOT NULL,
    "stacktrace" TEXT,
    "attempts_made" INTEGER NOT NULL DEFAULT 0,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "failed_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facebook_pages" (
    "id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "encrypted_token" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facebook_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pinterest_boards" (
    "id" TEXT NOT NULL,
    "board_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pinterest_boards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reddit_drafts" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "subreddit" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "language" "Language" NOT NULL DEFAULT 'EN',
    "status" "DraftStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewed_by_id" TEXT,
    "review_notes" TEXT,
    "external_url" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reddit_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "is_secret" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entity_id" TEXT,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_telegram_id_key" ON "users"("telegram_id");

-- CreateIndex
CREATE INDEX "telegram_messages_media_group_id_idx" ON "telegram_messages"("media_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_messages_chat_id_message_id_key" ON "telegram_messages"("chat_id", "message_id");

-- CreateIndex
CREATE INDEX "posts_status_idx" ON "posts"("status");

-- CreateIndex
CREATE INDEX "posts_user_id_created_at_idx" ON "posts"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "media_post_id_idx" ON "media"("post_id");

-- CreateIndex
CREATE INDEX "ai_outputs_post_id_idx" ON "ai_outputs"("post_id");

-- CreateIndex
CREATE UNIQUE INDEX "translations_post_id_platform_language_key" ON "translations"("post_id", "platform", "language");

-- CreateIndex
CREATE INDEX "platform_jobs_post_id_idx" ON "platform_jobs"("post_id");

-- CreateIndex
CREATE INDEX "platform_jobs_status_idx" ON "platform_jobs"("status");

-- CreateIndex
CREATE INDEX "scheduled_jobs_status_run_at_idx" ON "scheduled_jobs"("status", "run_at");

-- CreateIndex
CREATE INDEX "job_logs_platform_job_id_idx" ON "job_logs"("platform_job_id");

-- CreateIndex
CREATE INDEX "job_logs_created_at_idx" ON "job_logs"("created_at");

-- CreateIndex
CREATE INDEX "failed_jobs_queue_resolved_idx" ON "failed_jobs"("queue", "resolved");

-- CreateIndex
CREATE UNIQUE INDEX "facebook_pages_page_id_key" ON "facebook_pages"("page_id");

-- CreateIndex
CREATE UNIQUE INDEX "pinterest_boards_board_id_key" ON "pinterest_boards"("board_id");

-- CreateIndex
CREATE INDEX "reddit_drafts_status_idx" ON "reddit_drafts"("status");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "telegram_messages" ADD CONSTRAINT "telegram_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_messages" ADD CONSTRAINT "telegram_messages_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_outputs" ADD CONSTRAINT "ai_outputs_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "translations" ADD CONSTRAINT "translations_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_jobs" ADD CONSTRAINT "platform_jobs_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_jobs" ADD CONSTRAINT "scheduled_jobs_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_logs" ADD CONSTRAINT "job_logs_platform_job_id_fkey" FOREIGN KEY ("platform_job_id") REFERENCES "platform_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reddit_drafts" ADD CONSTRAINT "reddit_drafts_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reddit_drafts" ADD CONSTRAINT "reddit_drafts_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

