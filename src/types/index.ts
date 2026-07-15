import type { Language, Platform, Tone } from '@prisma/client';

/** Per-platform, per-language generated content coming back from OpenAI. */
export interface GeneratedPlatformContent {
  title: string | null;
  body: string;
  description: string | null;
  keywords: string[];
  hashtags: string[];
  altText: string | null;
  cta: string | null;
}

export type GeneratedContent = Record<
  Platform,
  Record<Language, GeneratedPlatformContent>
> & {
  redditSubredditSuggestion: string;
};

// ===== Queue payloads =====

export interface MediaJobData {
  postId: string;
}

export interface AiJobData {
  postId: string;
}

export interface PublishJobData {
  platformJobId: string;
}

export interface ScheduleJobData {
  scheduledJobId: string;
  postId: string;
}

export type DeadLetterData = {
  queue: string;
  name: string;
  data: unknown;
  failedReason: string;
  attemptsMade: number;
};

export const QUEUE_NAMES = {
  media: 'media',
  ai: 'ai',
  publish: 'publish',
  schedule: 'schedule',
  deadLetter: 'dead-letter',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const LANGUAGES: Language[] = ['EN', 'SI', 'TA'];
export const TONES: Tone[] = ['PROFESSIONAL', 'FRIENDLY', 'GAMING', 'LUXURY', 'CASUAL'];

export const LANGUAGE_LABELS: Record<Language, string> = {
  EN: 'English',
  SI: 'සිංහල (Sinhala)',
  TA: 'தமிழ் (Tamil)',
};

export const TONE_LABELS: Record<Tone, string> = {
  PROFESSIONAL: 'Professional',
  FRIENDLY: 'Friendly',
  GAMING: 'Gaming',
  LUXURY: 'Luxury',
  CASUAL: 'Casual',
};
