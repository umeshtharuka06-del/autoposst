"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mediaService = exports.MediaService = void 0;
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = __importDefault(require("path"));
const promises_2 = require("stream/promises");
const stream_1 = require("stream");
const sharp_1 = __importDefault(require("sharp"));
const client_1 = require("@prisma/client");
const env_1 = require("../../config/env");
const logger_1 = require("../../lib/logger");
const errors_1 = require("../../lib/errors");
const media_repository_1 = require("../../repositories/media.repository");
const TELEGRAM_API = 'https://api.telegram.org';
class MediaService {
    /**
     * Downloads all media for a post from Telegram, generates thumbnails for
     * photos, and recompresses oversized images. Updates media rows in place.
     */
    async processPostMedia(postId) {
        const mediaItems = await media_repository_1.mediaRepository.findByPost(postId);
        if (mediaItems.length === 0) {
            throw new errors_1.NonRetryableError(`Post ${postId} has no media`);
        }
        const postDir = path_1.default.join(env_1.env.MEDIA_STORAGE_PATH, postId);
        await (0, promises_1.mkdir)(postDir, { recursive: true });
        for (const media of mediaItems) {
            const localPath = await this.downloadTelegramFile(media.telegramFileId, postDir, media.id);
            const fileStat = await (0, promises_1.stat)(localPath);
            let thumbnailPath = null;
            let compressedPath = null;
            let width = media.width;
            let height = media.height;
            if (media.type === client_1.MediaType.PHOTO) {
                const meta = await (0, sharp_1.default)(localPath).metadata();
                width = meta.width ?? width;
                height = meta.height ?? height;
                thumbnailPath = path_1.default.join(postDir, `${media.id}_thumb.jpg`);
                await (0, sharp_1.default)(localPath)
                    .rotate()
                    .resize({ width: env_1.env.THUMBNAIL_WIDTH, withoutEnlargement: true })
                    .jpeg({ quality: 80 })
                    .toFile(thumbnailPath);
                if (fileStat.size > env_1.env.MEDIA_COMPRESS_THRESHOLD_BYTES) {
                    compressedPath = path_1.default.join(postDir, `${media.id}_compressed.jpg`);
                    await (0, sharp_1.default)(localPath).rotate().jpeg({ quality: 82, mozjpeg: true }).toFile(compressedPath);
                    logger_1.logger.info({ mediaId: media.id, original: fileStat.size, compressed: (await (0, promises_1.stat)(compressedPath)).size }, 'image recompressed');
                }
            }
            await media_repository_1.mediaRepository.update(media.id, {
                localPath,
                thumbnailPath,
                compressedPath,
                fileSize: fileStat.size,
                width,
                height,
            });
        }
        logger_1.logger.info({ postId, count: mediaItems.length }, 'post media processed');
    }
    /** Returns the best local file to publish: compressed version if present, else original. */
    publishablePath(media) {
        const p = media.compressedPath ?? media.localPath;
        if (!p)
            throw new errors_1.NonRetryableError('Media has not been downloaded yet');
        return p;
    }
    async downloadTelegramFile(fileId, dir, mediaId) {
        const infoRes = await fetch(`${TELEGRAM_API}/bot${env_1.env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`);
        const info = (await infoRes.json());
        if (!info.ok || !info.result?.file_path) {
            throw new errors_1.ExternalApiError('telegram', `getFile failed: ${info.description ?? 'unknown error'}`, infoRes.status);
        }
        const ext = path_1.default.extname(info.result.file_path) || '.bin';
        const localPath = path_1.default.join(dir, `${mediaId}${ext}`);
        const fileRes = await fetch(`${TELEGRAM_API}/file/bot${env_1.env.TELEGRAM_BOT_TOKEN}/${info.result.file_path}`);
        if (!fileRes.ok || !fileRes.body) {
            throw new errors_1.ExternalApiError('telegram', `file download failed (${fileRes.status})`, fileRes.status);
        }
        await (0, promises_2.pipeline)(stream_1.Readable.fromWeb(fileRes.body), (0, fs_1.createWriteStream)(localPath));
        return localPath;
    }
}
exports.MediaService = MediaService;
exports.mediaService = new MediaService();
//# sourceMappingURL=media.service.js.map