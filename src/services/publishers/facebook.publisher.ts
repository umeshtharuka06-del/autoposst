import { readFile } from 'fs/promises';
import path from 'path';
import { lookup as mimeLookup } from 'mime-types';
import { MediaType } from '@prisma/client';
import { env } from '../../config/env';
import { decryptSecret } from '../../lib/crypto';
import { ExternalApiError, NonRetryableError, NotFoundError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { facebookRepository } from '../../repositories/facebook.repository';
import { mediaService } from '../media/media.service';
import type { PublishInput, PublishResult, Publisher } from './publisher.types';

interface FbErrorBody {
  error?: { message?: string; code?: number; error_subcode?: number };
}

const GRAPH = () => `https://graph.facebook.com/${env.FACEBOOK_GRAPH_VERSION}`;
const GRAPH_VIDEO = () => `https://graph-video.facebook.com/${env.FACEBOOK_GRAPH_VERSION}`;

// Graph API error codes that will never succeed on retry (auth/permission/validation).
const NON_RETRYABLE_FB_CODES = new Set([100, 190, 200, 803]);

export class FacebookPublisher implements Publisher {
  async publish(input: PublishInput): Promise<PublishResult> {
    const page = await facebookRepository.findByPageId(input.targetId);
    if (!page || !page.isActive) throw new NotFoundError('FacebookPage', input.targetId);
    const token = decryptSecret(page.encryptedToken);

    const message = this.composeMessage(input);
    const photos = input.media.filter((m) => m.type === MediaType.PHOTO);
    const videos = input.media.filter((m) => m.type === MediaType.VIDEO);

    if (videos.length > 0) {
      // Facebook feed posts support one video; publish the first.
      const video = videos[0]!;
      return this.publishVideo(page.pageId, token, mediaService.publishablePath(video), message);
    }
    if (photos.length === 1) {
      return this.publishSinglePhoto(page.pageId, token, mediaService.publishablePath(photos[0]!), message);
    }
    if (photos.length > 1) {
      return this.publishAlbum(page.pageId, token, photos.map((p) => mediaService.publishablePath(p)), message);
    }
    // Text-only fallback (e.g. document posts).
    return this.publishTextPost(page.pageId, token, message);
  }

  private composeMessage(input: PublishInput): string {
    const t = input.translation;
    const parts = [t.body];
    if (t.cta && !t.body.includes(t.cta)) parts.push(t.cta);
    if (t.hashtags.length > 0) parts.push(t.hashtags.join(' '));
    return parts.join('\n\n');
  }

  private async publishSinglePhoto(pageId: string, token: string, filePath: string, message: string): Promise<PublishResult> {
    const form = new FormData();
    form.append('access_token', token);
    form.append('message', message);
    form.append('source', await this.fileBlob(filePath), path.basename(filePath));
    const data = await this.graphPost(`${GRAPH()}/${pageId}/photos`, form);
    const id = (data.post_id as string | undefined) ?? (data.id as string);
    return { externalPostId: id, externalUrl: `https://www.facebook.com/${id}` };
  }

  private async publishAlbum(pageId: string, token: string, filePaths: string[], message: string): Promise<PublishResult> {
    const photoIds: string[] = [];
    for (const filePath of filePaths) {
      const form = new FormData();
      form.append('access_token', token);
      form.append('published', 'false');
      form.append('source', await this.fileBlob(filePath), path.basename(filePath));
      const data = await this.graphPost(`${GRAPH()}/${pageId}/photos`, form);
      photoIds.push(data.id as string);
    }

    const form = new FormData();
    form.append('access_token', token);
    form.append('message', message);
    photoIds.forEach((id, i) => form.append(`attached_media[${i}]`, JSON.stringify({ media_fbid: id })));
    const data = await this.graphPost(`${GRAPH()}/${pageId}/feed`, form);
    const id = data.id as string;
    return { externalPostId: id, externalUrl: `https://www.facebook.com/${id}` };
  }

  private async publishVideo(pageId: string, token: string, filePath: string, description: string): Promise<PublishResult> {
    const form = new FormData();
    form.append('access_token', token);
    form.append('description', description);
    form.append('source', await this.fileBlob(filePath), path.basename(filePath));
    const data = await this.graphPost(`${GRAPH_VIDEO()}/${pageId}/videos`, form);
    const id = data.id as string;
    return { externalPostId: id, externalUrl: `https://www.facebook.com/${pageId}/videos/${id}` };
  }

  private async publishTextPost(pageId: string, token: string, message: string): Promise<PublishResult> {
    const form = new FormData();
    form.append('access_token', token);
    form.append('message', message);
    const data = await this.graphPost(`${GRAPH()}/${pageId}/feed`, form);
    const id = data.id as string;
    return { externalPostId: id, externalUrl: `https://www.facebook.com/${id}` };
  }

  /** Verifies a page token and returns the page name. Used by /facebook add. */
  async verifyPageToken(pageId: string, token: string): Promise<string> {
    const res = await fetch(`${GRAPH()}/${pageId}?fields=id,name&access_token=${encodeURIComponent(token)}`);
    const body = (await res.json()) as FbErrorBody & { id?: string; name?: string };
    if (!res.ok || !body.id) {
      throw new ExternalApiError('facebook', body.error?.message ?? `Token verification failed (${res.status})`, res.status, false);
    }
    return body.name ?? pageId;
  }

  private async fileBlob(filePath: string): Promise<Blob> {
    const buf = await readFile(filePath);
    const mime = mimeLookup(filePath) || 'application/octet-stream';
    return new Blob([buf], { type: mime });
  }

  private async graphPost(url: string, form: FormData): Promise<Record<string, unknown>> {
    const res = await fetch(url, { method: 'POST', body: form });
    const body = (await res.json().catch(() => ({}))) as FbErrorBody & Record<string, unknown>;
    if (!res.ok || body.error) {
      const message = body.error?.message ?? `HTTP ${res.status}`;
      const code = body.error?.code;
      logger.error({ url: url.split('?')[0], code, message }, 'facebook graph error');
      if (code !== undefined && NON_RETRYABLE_FB_CODES.has(code)) {
        throw new NonRetryableError(`Facebook: ${message} (code ${code})`);
      }
      throw new ExternalApiError('facebook', message, res.status);
    }
    return body;
  }
}

export const facebookPublisher = new FacebookPublisher();
