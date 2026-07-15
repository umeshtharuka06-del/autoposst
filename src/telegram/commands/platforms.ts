import type { Bot } from 'grammy';
import { DraftStatus } from '@prisma/client';
import { encryptSecret } from '../../lib/crypto';
import { errorMessage } from '../../lib/errors';
import { facebookRepository } from '../../repositories/facebook.repository';
import { pinterestRepository } from '../../repositories/pinterest.repository';
import { redditRepository } from '../../repositories/reddit.repository';
import { facebookPublisher } from '../../services/publishers/facebook.publisher';
import { pinterestPublisher } from '../../services/publishers/pinterest.publisher';
import { redditDraftService } from '../../services/publishers/reddit.draft.service';
import { SETTING_KEYS, settingsService } from '../../services/settings.service';
import type { BotContext } from '../context';
import { requireAdmin } from '../middleware/auth';
import { redditDraftKeyboard } from '../keyboards';
import { escapeHtml } from '../notifier';

function args(ctx: BotContext): string[] {
  return String(ctx.match ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

async function guardAdmin(ctx: BotContext): Promise<boolean> {
  if (!requireAdmin(ctx)) {
    await ctx.reply('⛔ Only the owner/admin can manage platform credentials.');
    return false;
  }
  return true;
}

export function registerPlatformCommands(bot: Bot<BotContext>): void {
  // ===== /facebook =====
  bot.command('facebook', async (ctx) => {
    const [sub, ...rest] = args(ctx);
    try {
      switch (sub) {
        case 'add': {
          if (!(await guardAdmin(ctx))) return;
          const [pageId, token] = rest;
          if (!pageId || !token) {
            await ctx.reply('Usage: /facebook add <pageId> <pageAccessToken>');
            return;
          }
          // Delete the message so the token doesn't linger in chat history.
          await ctx.deleteMessage().catch(() => undefined);
          const name = await facebookPublisher.verifyPageToken(pageId, token);
          await facebookRepository.upsert({ pageId, name, encryptedToken: encryptSecret(token) });
          await ctx.reply(`✅ Facebook Page connected: <b>${escapeHtml(name)}</b> (${pageId})\nToken stored encrypted.`, {
            parse_mode: 'HTML',
          });
          return;
        }
        case 'remove': {
          if (!(await guardAdmin(ctx))) return;
          const [pageId] = rest;
          if (!pageId) return void (await ctx.reply('Usage: /facebook remove <pageId>'));
          await facebookRepository.deactivate(pageId);
          await ctx.reply(`🗑 Facebook Page ${pageId} deactivated — it will no longer receive posts.`);
          return;
        }
        default: {
          const pages = await facebookRepository.listAll();
          if (pages.length === 0) {
            await ctx.reply(
              'No Facebook Pages connected.\n\n/facebook add <pageId> <pageAccessToken>\n' +
                'Get a long-lived Page token from https://developers.facebook.com/tools/explorer (pages_manage_posts + pages_read_engagement).',
            );
            return;
          }
          const lines = pages
            .map((p) => `• ${escapeHtml(p.name)} (<code>${p.pageId}</code>)${p.isActive ? '' : ' — inactive'}`)
            .join('\n');
          await ctx.reply(
            `<b>Facebook Pages</b> — posts publish to <b>every active page</b>\n${lines}\n\n` +
              `Commands: add &lt;id&gt; &lt;token&gt; | remove &lt;id&gt;`,
            { parse_mode: 'HTML' },
          );
          return;
        }
      }
    } catch (err) {
      await ctx.reply(`❌ ${escapeHtml(errorMessage(err))}`, { parse_mode: 'HTML' });
    }
  });

  // ===== /pinterest =====
  bot.command('pinterest', async (ctx) => {
    const [sub, ...rest] = args(ctx);
    try {
      switch (sub) {
        case 'token': {
          if (!(await guardAdmin(ctx))) return;
          const [token] = rest;
          if (!token) return void (await ctx.reply('Usage: /pinterest token <accessToken>'));
          await ctx.deleteMessage().catch(() => undefined);
          const username = await pinterestPublisher.verifyToken(token);
          await settingsService.setSecret(SETTING_KEYS.pinterestAccessToken, token);
          await ctx.reply(`✅ Pinterest connected as <b>${escapeHtml(username)}</b>. Token stored encrypted.\nNow run /pinterest boards to sync your boards.`, {
            parse_mode: 'HTML',
          });
          return;
        }
        case 'boards': {
          if (!(await guardAdmin(ctx))) return;
          const boards = await pinterestPublisher.fetchBoards();
          for (const b of boards) await pinterestRepository.upsert({ boardId: b.id, name: b.name });
          await ctx.reply(`🔄 Synced ${boards.length} board(s). Use /pinterest list to view them.`);
          return;
        }
        case 'default': {
          if (!(await guardAdmin(ctx))) return;
          const [boardId] = rest;
          if (!boardId) return void (await ctx.reply('Usage: /pinterest default <boardId>'));
          await pinterestRepository.setDefault(boardId);
          await ctx.reply(`⭐ Default board set to ${boardId}.`);
          return;
        }
        case 'remove': {
          if (!(await guardAdmin(ctx))) return;
          const [boardId] = rest;
          if (!boardId) return void (await ctx.reply('Usage: /pinterest remove <boardId>'));
          await pinterestRepository.deactivate(boardId);
          await ctx.reply(`🗑 Board ${boardId} deactivated.`);
          return;
        }
        default: {
          const boards = await pinterestRepository.listAll();
          const hasToken = (await settingsService.get(SETTING_KEYS.pinterestAccessToken)) !== null;
          const lines =
            boards.length > 0
              ? boards
                  .map((b) => `${b.isDefault ? '⭐' : '•'} ${escapeHtml(b.name)} (<code>${b.boardId}</code>)${b.isActive ? '' : ' — inactive'}`)
                  .join('\n')
              : '(no boards synced yet)';
          await ctx.reply(
            `<b>Pinterest</b> — token: ${hasToken ? '✅ set' : '❌ missing'}\n${lines}\n\n` +
              `Commands: token &lt;accessToken&gt; | boards | default &lt;id&gt; | remove &lt;id&gt;`,
            { parse_mode: 'HTML' },
          );
          return;
        }
      }
    } catch (err) {
      await ctx.reply(`❌ ${escapeHtml(errorMessage(err))}`, { parse_mode: 'HTML' });
    }
  });

  // ===== /reddit =====
  bot.command('reddit', async (ctx) => {
    const [sub, ...rest] = args(ctx);
    try {
      switch (sub) {
        case 'show': {
          const [draftId] = rest;
          if (!draftId) return void (await ctx.reply('Usage: /reddit show <draftId>'));
          const draft = await redditRepository.findById(draftId);
          if (!draft) return void (await ctx.reply('Draft not found.'));
          const rules = await redditDraftService.rulesFor(draft.subreddit);
          const rulesText = rules.length > 0 ? `\n\n📏 <b>Rules:</b>\n• ${rules.map(escapeHtml).join('\n• ')}` : '';
          await ctx.reply(
            `📝 <b>r/${escapeHtml(draft.subreddit)}</b> — ${draft.status}\n\n<b>${escapeHtml(draft.title)}</b>\n\n` +
              `${escapeHtml(draft.body.slice(0, 2000))}${rulesText}`,
            {
              parse_mode: 'HTML',
              reply_markup: draft.status === DraftStatus.PENDING_REVIEW ? redditDraftKeyboard(draft.id) : undefined,
            },
          );
          return;
        }
        case 'sub': {
          const [draftId, subreddit] = rest;
          if (!draftId || !subreddit) return void (await ctx.reply('Usage: /reddit sub <draftId> <subreddit>'));
          const draft = await redditDraftService.updateSubreddit(draftId, subreddit);
          const rules = await redditDraftService.rulesFor(draft.subreddit);
          await ctx.reply(
            `🎯 Draft retargeted to r/${escapeHtml(draft.subreddit)}.` +
              (rules.length > 0 ? `\n📏 Rules:\n• ${rules.map(escapeHtml).join('\n• ')}` : ''),
            { parse_mode: 'HTML', reply_markup: redditDraftKeyboard(draft.id) },
          );
          return;
        }
        default: {
          const drafts = await redditRepository.findPending(10);
          if (drafts.length === 0) {
            await ctx.reply('No Reddit drafts awaiting review. Drafts are created automatically for each post — Reddit is never auto-published.');
            return;
          }
          for (const d of drafts) {
            await ctx.reply(
              `📝 <b>r/${escapeHtml(d.subreddit)}</b> (<code>${d.id}</code>)\n<b>${escapeHtml(d.title)}</b>\n\n${escapeHtml(
                d.body.slice(0, 500),
              )}`,
              { parse_mode: 'HTML', reply_markup: redditDraftKeyboard(d.id) },
            );
          }
          return;
        }
      }
    } catch (err) {
      await ctx.reply(`❌ ${escapeHtml(errorMessage(err))}`, { parse_mode: 'HTML' });
    }
  });
}
