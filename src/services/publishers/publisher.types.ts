import type { Media, Translation } from '@prisma/client';

export interface PublishResult {
  externalPostId: string;
  externalUrl: string | null;
}

export interface PublishInput {
  postId: string;
  /** Resolved target: Facebook page id / Pinterest board id. */
  targetId: string;
  translation: Translation;
  media: Media[];
}

export interface Publisher {
  publish(input: PublishInput): Promise<PublishResult>;
}
