"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pinterestPublisher = exports.PinterestPublisher = void 0;
const promises_1 = require("fs/promises");
const client_1 = require("@prisma/client");
const env_1 = require("../../config/env");
const errors_1 = require("../../lib/errors");
const logger_1 = require("../../lib/logger");
const pinterest_repository_1 = require("../../repositories/pinterest.repository");
const media_service_1 = require("../media/media.service");
const settings_service_1 = require("../settings.service");
class PinterestPublisher {
    async publish(input) {
        const board = await pinterest_repository_1.pinterestRepository.findByBoardId(input.targetId);
        if (!board || !board.isActive)
            throw new errors_1.NotFoundError('PinterestBoard', input.targetId);
        const token = await this.requireToken();
        const t = input.translation;
        const photos = input.media.filter((m) => m.type === client_1.MediaType.PHOTO);
        const videos = input.media.filter((m) => m.type === client_1.MediaType.VIDEO);
        const basePin = {
            board_id: board.boardId,
            title: (t.title ?? t.body).slice(0, 100),
            description: (t.description ?? t.body).slice(0, 800),
            alt_text: t.altText ? t.altText.slice(0, 480) : undefined,
        };
        if (videos.length > 0) {
            const cover = photos.find((p) => p.thumbnailPath);
            if (!cover?.thumbnailPath) {
                throw new errors_1.NonRetryableError('Pinterest video pins need a cover image. Send the video together with at least one photo in the album.');
            }
            const mediaId = await this.uploadVideo(token, media_service_1.mediaService.publishablePath(videos[0]));
            const coverBuf = await (0, promises_1.readFile)(cover.thumbnailPath);
            basePin.media_source = {
                source_type: 'video_id',
                media_id: mediaId,
                cover_image_content_type: 'image/jpeg',
                cover_image_data: coverBuf.toString('base64'),
            };
        }
        else if (photos.length === 1) {
            const buf = await (0, promises_1.readFile)(media_service_1.mediaService.publishablePath(photos[0]));
            basePin.media_source = {
                source_type: 'image_base64',
                content_type: photos[0].mimeType ?? 'image/jpeg',
                data: buf.toString('base64'),
            };
        }
        else if (photos.length > 1) {
            const items = await Promise.all(photos.slice(0, 5).map(async (p) => ({
                content_type: p.mimeType ?? 'image/jpeg',
                data: (await (0, promises_1.readFile)(media_service_1.mediaService.publishablePath(p))).toString('base64'),
            })));
            basePin.media_source = { source_type: 'multiple_image_base64', items };
        }
        else {
            throw new errors_1.NonRetryableError('Pinterest requires at least one photo or video');
        }
        const pin = await this.api(token, 'POST', '/pins', basePin);
        return { externalPostId: pin.id, externalUrl: `https://www.pinterest.com/pin/${pin.id}/` };
    }
    /** Registers + uploads a video, polls until processed, returns media_id. */
    async uploadVideo(token, filePath) {
        const reg = await this.api(token, 'POST', '/media', { media_type: 'video' });
        const form = new FormData();
        for (const [k, v] of Object.entries(reg.upload_parameters))
            form.append(k, v);
        const buf = await (0, promises_1.readFile)(filePath);
        form.append('file', new Blob([buf], { type: 'video/mp4' }));
        const uploadRes = await fetch(reg.upload_url, { method: 'POST', body: form });
        if (!uploadRes.ok && uploadRes.status !== 204) {
            throw new errors_1.ExternalApiError('pinterest', `video upload failed (${uploadRes.status})`, uploadRes.status);
        }
        for (let i = 0; i < 30; i++) {
            await new Promise((r) => setTimeout(r, 4000));
            const status = await this.api(token, 'GET', `/media/${reg.media_id}`);
            if (status.status === 'succeeded')
                return reg.media_id;
            if (status.status === 'failed') {
                throw new errors_1.NonRetryableError('Pinterest rejected the video during processing');
            }
        }
        throw new errors_1.ExternalApiError('pinterest', 'video processing timed out after 2 minutes');
    }
    /** Fetches boards from the API for /pinterest boards sync. */
    async fetchBoards() {
        const token = await this.requireToken();
        const data = await this.api(token, 'GET', '/boards?page_size=100');
        return data.items.map((b) => ({ id: b.id, name: b.name }));
    }
    async verifyToken(token) {
        const res = await fetch(`${env_1.env.PINTEREST_API_BASE}/user_account`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const body = (await res.json().catch(() => ({})));
        if (!res.ok) {
            throw new errors_1.ExternalApiError('pinterest', body.message ?? `Token invalid (${res.status})`, res.status, false);
        }
        return body.username ?? 'unknown';
    }
    async requireToken() {
        const token = await settings_service_1.settingsService.get(settings_service_1.SETTING_KEYS.pinterestAccessToken);
        if (!token) {
            throw new errors_1.ConfigurationError('Pinterest access token not configured. Use /pinterest token <access_token>.');
        }
        return token;
    }
    async api(token, method, pathname, body) {
        const res = await fetch(`${env_1.env.PINTEREST_API_BASE}${pathname}`, {
            method,
            headers: {
                Authorization: `Bearer ${token}`,
                ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
            },
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        const data = (await res.json().catch(() => ({})));
        if (!res.ok) {
            const message = data.message ?? `HTTP ${res.status}`;
            logger_1.logger.error({ pathname, status: res.status, message }, 'pinterest api error');
            if (res.status === 401 || res.status === 403 || res.status === 400) {
                throw new errors_1.NonRetryableError(`Pinterest: ${message}`);
            }
            throw new errors_1.ExternalApiError('pinterest', message, res.status);
        }
        return data;
    }
}
exports.PinterestPublisher = PinterestPublisher;
exports.pinterestPublisher = new PinterestPublisher();
//# sourceMappingURL=pinterest.publisher.js.map