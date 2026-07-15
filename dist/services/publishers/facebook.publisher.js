"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.facebookPublisher = exports.FacebookPublisher = void 0;
const promises_1 = require("fs/promises");
const path_1 = __importDefault(require("path"));
const mime_types_1 = require("mime-types");
const client_1 = require("@prisma/client");
const env_1 = require("../../config/env");
const crypto_1 = require("../../lib/crypto");
const errors_1 = require("../../lib/errors");
const logger_1 = require("../../lib/logger");
const facebook_repository_1 = require("../../repositories/facebook.repository");
const media_service_1 = require("../media/media.service");
const GRAPH = () => `https://graph.facebook.com/${env_1.env.FACEBOOK_GRAPH_VERSION}`;
const GRAPH_VIDEO = () => `https://graph-video.facebook.com/${env_1.env.FACEBOOK_GRAPH_VERSION}`;
// Graph API error codes that will never succeed on retry (auth/permission/validation).
const NON_RETRYABLE_FB_CODES = new Set([100, 190, 200, 803]);
class FacebookPublisher {
    async publish(input) {
        const page = await facebook_repository_1.facebookRepository.findByPageId(input.targetId);
        if (!page || !page.isActive)
            throw new errors_1.NotFoundError('FacebookPage', input.targetId);
        const token = (0, crypto_1.decryptSecret)(page.encryptedToken);
        const message = this.composeMessage(input);
        const photos = input.media.filter((m) => m.type === client_1.MediaType.PHOTO);
        const videos = input.media.filter((m) => m.type === client_1.MediaType.VIDEO);
        if (videos.length > 0) {
            // Facebook feed posts support one video; publish the first.
            const video = videos[0];
            return this.publishVideo(page.pageId, token, media_service_1.mediaService.publishablePath(video), message);
        }
        if (photos.length === 1) {
            return this.publishSinglePhoto(page.pageId, token, media_service_1.mediaService.publishablePath(photos[0]), message);
        }
        if (photos.length > 1) {
            return this.publishAlbum(page.pageId, token, photos.map((p) => media_service_1.mediaService.publishablePath(p)), message);
        }
        // Text-only fallback (e.g. document posts).
        return this.publishTextPost(page.pageId, token, message);
    }
    composeMessage(input) {
        const t = input.translation;
        const parts = [t.body];
        if (t.cta && !t.body.includes(t.cta))
            parts.push(t.cta);
        if (t.hashtags.length > 0)
            parts.push(t.hashtags.join(' '));
        return parts.join('\n\n');
    }
    async publishSinglePhoto(pageId, token, filePath, message) {
        const form = new FormData();
        form.append('access_token', token);
        form.append('message', message);
        form.append('source', await this.fileBlob(filePath), path_1.default.basename(filePath));
        const data = await this.graphPost(`${GRAPH()}/${pageId}/photos`, form);
        const id = data.post_id ?? data.id;
        return { externalPostId: id, externalUrl: `https://www.facebook.com/${id}` };
    }
    async publishAlbum(pageId, token, filePaths, message) {
        const photoIds = [];
        for (const filePath of filePaths) {
            const form = new FormData();
            form.append('access_token', token);
            form.append('published', 'false');
            form.append('source', await this.fileBlob(filePath), path_1.default.basename(filePath));
            const data = await this.graphPost(`${GRAPH()}/${pageId}/photos`, form);
            photoIds.push(data.id);
        }
        const form = new FormData();
        form.append('access_token', token);
        form.append('message', message);
        photoIds.forEach((id, i) => form.append(`attached_media[${i}]`, JSON.stringify({ media_fbid: id })));
        const data = await this.graphPost(`${GRAPH()}/${pageId}/feed`, form);
        const id = data.id;
        return { externalPostId: id, externalUrl: `https://www.facebook.com/${id}` };
    }
    async publishVideo(pageId, token, filePath, description) {
        const form = new FormData();
        form.append('access_token', token);
        form.append('description', description);
        form.append('source', await this.fileBlob(filePath), path_1.default.basename(filePath));
        const data = await this.graphPost(`${GRAPH_VIDEO()}/${pageId}/videos`, form);
        const id = data.id;
        return { externalPostId: id, externalUrl: `https://www.facebook.com/${pageId}/videos/${id}` };
    }
    async publishTextPost(pageId, token, message) {
        const form = new FormData();
        form.append('access_token', token);
        form.append('message', message);
        const data = await this.graphPost(`${GRAPH()}/${pageId}/feed`, form);
        const id = data.id;
        return { externalPostId: id, externalUrl: `https://www.facebook.com/${id}` };
    }
    /** Verifies a page token and returns the page name. Used by /facebook add. */
    async verifyPageToken(pageId, token) {
        const res = await fetch(`${GRAPH()}/${pageId}?fields=id,name&access_token=${encodeURIComponent(token)}`);
        const body = (await res.json());
        if (!res.ok || !body.id) {
            throw new errors_1.ExternalApiError('facebook', body.error?.message ?? `Token verification failed (${res.status})`, res.status, false);
        }
        return body.name ?? pageId;
    }
    async fileBlob(filePath) {
        const buf = await (0, promises_1.readFile)(filePath);
        const mime = (0, mime_types_1.lookup)(filePath) || 'application/octet-stream';
        return new Blob([buf], { type: mime });
    }
    async graphPost(url, form) {
        const res = await fetch(url, { method: 'POST', body: form });
        const body = (await res.json().catch(() => ({})));
        if (!res.ok || body.error) {
            const message = body.error?.message ?? `HTTP ${res.status}`;
            const code = body.error?.code;
            logger_1.logger.error({ url: url.split('?')[0], code, message }, 'facebook graph error');
            if (code !== undefined && NON_RETRYABLE_FB_CODES.has(code)) {
                throw new errors_1.NonRetryableError(`Facebook: ${message} (code ${code})`);
            }
            throw new errors_1.ExternalApiError('facebook', message, res.status);
        }
        return body;
    }
}
exports.FacebookPublisher = FacebookPublisher;
exports.facebookPublisher = new FacebookPublisher();
//# sourceMappingURL=facebook.publisher.js.map