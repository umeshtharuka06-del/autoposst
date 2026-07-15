import { createWriteStream } from 'fs';
import { mkdir, stat } from 'fs/promises';
import path from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import sharp from 'sharp';
import { MediaType } from '@prisma/client';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { ExternalApiError, NonRetryableError } from '../../lib/errors';
import { mediaRepository } from '../../repositories/media.repository';

const TELEGRAM_API = 'https://api.telegram.org';

interface TelegramFileInfo {
  ok: boolean;
  result?: { file_id: string; file_size?: number; file_path?: string };
  description?: string;
}

export class MediaService {
  /**
   * Downloads all media for a post from Telegram, generates thumbnails for
   * photos, and recompresses oversized images. Updates media rows in place.
   */
  async processPostMedia(postId: string): Promise<void> {
    const mediaItems = await mediaRepository.findByPost(postId);
    if (mediaItems.length === 0) {
      throw new NonRetryableError(`Post ${postId} has no media`);
    }

    const postDir = path.join(env.MEDIA_STORAGE_PATH, postId);
    await mkdir(postDir, { recursive: true });

    for (const media of mediaItems) {
      const localPath = await this.downloadTelegramFile(media.telegramFileId, postDir, media.id);
      const fileStat = await stat(localPath);

      let thumbnailPath: string | null = null;
      let compressedPath: string | null = null;
      let width: number | null = media.width;
      let height: number | null = media.height;

      if (media.type === MediaType.PHOTO) {
        const meta = await sharp(localPath).metadata();
        width = meta.width ?? width;
        height = meta.height ?? height;

        thumbnailPath = path.join(postDir, `${media.id}_thumb.jpg`);
        await sharp(localPath)
          .rotate()
          .resize({ width: env.THUMBNAIL_WIDTH, withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toFile(thumbnailPath);

        if (fileStat.size > env.MEDIA_COMPRESS_THRESHOLD_BYTES) {
          compressedPath = path.join(postDir, `${media.id}_compressed.jpg`);
          await sharp(localPath).rotate().jpeg({ quality: 82, mozjpeg: true }).toFile(compressedPath);
          logger.info(
            { mediaId: media.id, original: fileStat.size, compressed: (await stat(compressedPath)).size },
            'image recompressed',
          );
        }
      }

      await mediaRepository.update(media.id, {
        localPath,
        thumbnailPath,
        compressedPath,
        fileSize: fileStat.size,
        width,
        height,
      });
    }

    logger.info({ postId, count: mediaItems.length }, 'post media processed');
  }

  /** Returns the best local file to publish: compressed version if present, else original. */
  publishablePath(media: { localPath: string | null; compressedPath: string | null }): string {
    const p = media.compressedPath ?? media.localPath;
    if (!p) throw new NonRetryableError('Media has not been downloaded yet');
    return p;
  }

  private async downloadTelegramFile(fileId: string, dir: string, mediaId: string): Promise<string> {
    const infoRes = await fetch(
      `${TELEGRAM_API}/bot${env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`,
    );
    const info = (await infoRes.json()) as TelegramFileInfo;
    if (!info.ok || !info.result?.file_path) {
      throw new ExternalApiError('telegram', `getFile failed: ${info.description ?? 'unknown error'}`, infoRes.status);
    }

    const ext = path.extname(info.result.file_path) || '.bin';
    const localPath = path.join(dir, `${mediaId}${ext}`);

    const fileRes = await fetch(`${TELEGRAM_API}/file/bot${env.TELEGRAM_BOT_TOKEN}/${info.result.file_path}`);
    if (!fileRes.ok || !fileRes.body) {
      throw new ExternalApiError('telegram', `file download failed (${fileRes.status})`, fileRes.status);
    }

    await pipeline(Readable.fromWeb(fileRes.body as import('stream/web').ReadableStream), createWriteStream(localPath));
    return localPath;
  }
}

export const mediaService = new MediaService();
