import { readFile } from 'fs/promises';
import { MediaType } from '@prisma/client';
import { env } from '../../config/env';
import { ConfigurationError, ExternalApiError, NonRetryableError, NotFoundError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { pinterestRepository } from '../../repositories/pinterest.repository';
import { mediaService } from '../media/media.service';
import { SETTING_KEYS, settingsService } from '../settings.service';
import type { PublishInput, PublishResult, Publisher } from './publisher.types';

interface PinterestMediaRegistration {
  media_id: string;
  media_type: string;
  upload_url: string;
  upload_parameters: Record<string, string>;
}

interface PinterestMediaStatus {
  media_id: string;
  status: 'registered' | 'processing' | 'succeeded' | 'failed';
}

export class PinterestPublisher implements Publisher {
  async publish(input: PublishInput): Promise<PublishResult> {
    const board = await pinterestRepository.findByBoardId(input.targetId);
    if (!board || !board.isActive) throw new NotFoundError('PinterestBoard', input.targetId);
    const token = await this.requireToken();

    const t = input.translation;
    const photos = input.media.filter((m) => m.type === MediaType.PHOTO);
    const videos = input.media.filter((m) => m.type === MediaType.VIDEO);

    const basePin: Record<string, unknown> = {
      board_id: board.boardId,
      title: (t.title ?? t.body).slice(0, 100),
      description: (t.description ?? t.body).slice(0, 800),
      alt_text: t.altText ? t.altText.slice(0, 480) : undefined,
    };

    if (videos.length > 0) {
      const cover = photos.find((p) => p.thumbnailPath);
      if (!cover?.thumbnailPath) {
        throw new NonRetryableError(
          'Pinterest video pins need a cover image. Send the video together with at least one photo in the album.',
        );
      }
      const mediaId = await this.uploadVideo(token, mediaService.publishablePath(videos[0]!));
      const coverBuf = await readFile(cover.thumbnailPath);
      basePin.media_source = {
        source_type: 'video_id',
        media_id: mediaId,
        cover_image_content_type: 'image/jpeg',
        cover_image_data: coverBuf.toString('base64'),
      };
    } else if (photos.length === 1) {
      const buf = await readFile(mediaService.publishablePath(photos[0]!));
      basePin.media_source = {
        source_type: 'image_base64',
        content_type: photos[0]!.mimeType ?? 'image/jpeg',
        data: buf.toString('base64'),
      };
    } else if (photos.length > 1) {
      const items = await Promise.all(
        photos.slice(0, 5).map(async (p) => ({
          content_type: p.mimeType ?? 'image/jpeg',
          data: (await readFile(mediaService.publishablePath(p))).toString('base64'),
        })),
      );
      basePin.media_source = { source_type: 'multiple_image_base64', items };
    } else {
      throw new NonRetryableError('Pinterest requires at least one photo or video');
    }

    const pin = await this.api<{ id: string }>(token, 'POST', '/pins', basePin);
    return { externalPostId: pin.id, externalUrl: `https://www.pinterest.com/pin/${pin.id}/` };
  }

  /** Registers + uploads a video, polls until processed, returns media_id. */
  private async uploadVideo(token: string, filePath: string): Promise<string> {
    const reg = await this.api<PinterestMediaRegistration>(token, 'POST', '/media', { media_type: 'video' });

    const form = new FormData();
    for (const [k, v] of Object.entries(reg.upload_parameters)) form.append(k, v);
    const buf = await readFile(filePath);
    form.append('file', new Blob([buf], { type: 'video/mp4' }));

    const uploadRes = await fetch(reg.upload_url, { method: 'POST', body: form });
    if (!uploadRes.ok && uploadRes.status !== 204) {
      throw new ExternalApiError('pinterest', `video upload failed (${uploadRes.status})`, uploadRes.status);
    }

    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 4000));
      const status = await this.api<PinterestMediaStatus>(token, 'GET', `/media/${reg.media_id}`);
      if (status.status === 'succeeded') return reg.media_id;
      if (status.status === 'failed') {
        throw new NonRetryableError('Pinterest rejected the video during processing');
      }
    }
    throw new ExternalApiError('pinterest', 'video processing timed out after 2 minutes');
  }

  /** Fetches boards from the API for /pinterest boards sync. */
  async fetchBoards(): Promise<{ id: string; name: string }[]> {
    const token = await this.requireToken();
    const data = await this.api<{ items: { id: string; name: string }[] }>(token, 'GET', '/boards?page_size=100');
    return data.items.map((b) => ({ id: b.id, name: b.name }));
  }

  async verifyToken(token: string): Promise<string> {
    const res = await fetch(`${env.PINTEREST_API_BASE}/user_account`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json().catch(() => ({}))) as { username?: string; message?: string };
    if (!res.ok) {
      throw new ExternalApiError('pinterest', body.message ?? `Token invalid (${res.status})`, res.status, false);
    }
    return body.username ?? 'unknown';
  }

  private async requireToken(): Promise<string> {
    const token = await settingsService.get(SETTING_KEYS.pinterestAccessToken);
    if (!token) {
      throw new ConfigurationError('Pinterest access token not configured. Use /pinterest token <access_token>.');
    }
    return token;
  }

  private async api<T>(token: string, method: 'GET' | 'POST', pathname: string, body?: unknown): Promise<T> {
    const res = await fetch(`${env.PINTEREST_API_BASE}${pathname}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = (await res.json().catch(() => ({}))) as T & { message?: string; code?: number };
    if (!res.ok) {
      const message = data.message ?? `HTTP ${res.status}`;
      logger.error({ pathname, status: res.status, message }, 'pinterest api error');
      if (res.status === 401 || res.status === 403 || res.status === 400) {
        throw new NonRetryableError(`Pinterest: ${message}`);
      }
      throw new ExternalApiError('pinterest', message, res.status);
    }
    return data;
  }
}

export const pinterestPublisher = new PinterestPublisher();
