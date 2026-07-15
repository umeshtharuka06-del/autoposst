import { MediaType, User } from '@prisma/client';
import type { Message } from 'grammy/types';
import { logger } from '../../lib/logger';
import { messageRepository } from '../../repositories/message.repository';
import { postService, type IncomingMediaItem } from '../../services/post.service';
import { SETTING_KEYS, settingsService } from '../../services/settings.service';
import type { BotContext } from '../context';

const ALBUM_DEBOUNCE_MS = 1500;

interface PendingAlbum {
  user: User;
  caption: string | null;
  items: IncomingMediaItem[];
  messageDbIds: string[];
  chatId: number;
  timer: NodeJS.Timeout;
}

/** Albums arrive as separate messages sharing media_group_id — buffer + debounce. */
const pendingAlbums = new Map<string, PendingAlbum>();

function extractMedia(msg: Message): IncomingMediaItem | null {
  if (msg.photo && msg.photo.length > 0) {
    const best = msg.photo[msg.photo.length - 1]!;
    return {
      telegramFileId: best.file_id,
      type: MediaType.PHOTO,
      mimeType: 'image/jpeg',
      fileSize: best.file_size ?? null,
      width: best.width,
      height: best.height,
    };
  }
  if (msg.video) {
    return {
      telegramFileId: msg.video.file_id,
      type: MediaType.VIDEO,
      mimeType: msg.video.mime_type ?? 'video/mp4',
      fileSize: msg.video.file_size ?? null,
      width: msg.video.width,
      height: msg.video.height,
      duration: msg.video.duration,
    };
  }
  if (msg.document) {
    const mime = msg.document.mime_type ?? null;
    const type = mime?.startsWith('image/')
      ? MediaType.PHOTO
      : mime?.startsWith('video/')
        ? MediaType.VIDEO
        : MediaType.DOCUMENT;
    return {
      telegramFileId: msg.document.file_id,
      type,
      mimeType: mime,
      fileSize: msg.document.file_size ?? null,
    };
  }
  return null;
}

export async function handleIncomingMedia(ctx: BotContext): Promise<void> {
  const msg = ctx.message;
  if (!msg) return;

  const item = extractMedia(msg);
  if (!item) return;

  const dbMessage = await messageRepository.create({
    userId: ctx.dbUser.id,
    messageId: BigInt(msg.message_id),
    chatId: BigInt(msg.chat.id),
    mediaGroupId: msg.media_group_id ?? null,
    caption: msg.caption ?? null,
    raw: JSON.parse(JSON.stringify(msg)),
  });

  if (msg.media_group_id) {
    const key = msg.media_group_id;
    const existing = pendingAlbums.get(key);
    if (existing) {
      clearTimeout(existing.timer);
      existing.items.push(item);
      existing.messageDbIds.push(dbMessage.id);
      if (msg.caption) existing.caption = msg.caption;
      existing.timer = setTimeout(() => void flushAlbum(ctx, key), ALBUM_DEBOUNCE_MS);
    } else {
      pendingAlbums.set(key, {
        user: ctx.dbUser,
        caption: msg.caption ?? null,
        items: [item],
        messageDbIds: [dbMessage.id],
        chatId: msg.chat.id,
        timer: setTimeout(() => void flushAlbum(ctx, key), ALBUM_DEBOUNCE_MS),
      });
    }
    return;
  }

  await createPost(ctx, ctx.dbUser, msg.caption ?? null, [item], [dbMessage.id]);
}

async function flushAlbum(ctx: BotContext, key: string): Promise<void> {
  const album = pendingAlbums.get(key);
  if (!album) return;
  pendingAlbums.delete(key);
  try {
    await createPost(ctx, album.user, album.caption, album.items, album.messageDbIds);
  } catch (err) {
    logger.error({ key, err }, 'album flush failed');
    await ctx.api.sendMessage(album.chatId, '❌ Failed to process the album. Please try again.').catch(() => undefined);
  }
}

async function createPost(
  ctx: BotContext,
  user: User,
  caption: string | null,
  items: IncomingMediaItem[],
  messageDbIds: string[],
): Promise<void> {
  const autoPublish = await settingsService.getBool(SETTING_KEYS.defaultAutoPublish, true);
  const postId = await postService.createFromTelegram({
    user,
    caption,
    tone: user.tone,
    autoPublish,
    mediaItems: items,
    messageDbIds,
  });

  const summary = items.length === 1 ? items[0]!.type.toLowerCase() : `album of ${items.length} items`;
  await ctx.reply(
    `📥 Received your ${summary}.\n` +
      `⚙️ Downloading media and generating ${autoPublish ? 'content — will auto-publish when ready' : 'content for your review'}…\n` +
      `Post ID: ${postId}`,
  );
}
