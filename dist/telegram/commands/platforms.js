"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPlatformCommands = registerPlatformCommands;
const client_1 = require("@prisma/client");
const crypto_1 = require("../../lib/crypto");
const errors_1 = require("../../lib/errors");
const facebook_repository_1 = require("../../repositories/facebook.repository");
const pinterest_repository_1 = require("../../repositories/pinterest.repository");
const reddit_repository_1 = require("../../repositories/reddit.repository");
const facebook_publisher_1 = require("../../services/publishers/facebook.publisher");
const pinterest_publisher_1 = require("../../services/publishers/pinterest.publisher");
const reddit_draft_service_1 = require("../../services/publishers/reddit.draft.service");
const settings_service_1 = require("../../services/settings.service");
const auth_1 = require("../middleware/auth");
const keyboards_1 = require("../keyboards");
const notifier_1 = require("../notifier");
function args(ctx) {
    return String(ctx.match ?? '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
}
async function guardAdmin(ctx) {
    if (!(0, auth_1.requireAdmin)(ctx)) {
        await ctx.reply('⛔ Only the owner/admin can manage platform credentials.');
        return false;
    }
    return true;
}
function registerPlatformCommands(bot) {
    // ===== /facebook =====
    bot.command('facebook', async (ctx) => {
        const [sub, ...rest] = args(ctx);
        try {
            switch (sub) {
                case 'add': {
                    if (!(await guardAdmin(ctx)))
                        return;
                    const [pageId, token] = rest;
                    if (!pageId || !token) {
                        await ctx.reply('Usage: /facebook add <pageId> <pageAccessToken>');
                        return;
                    }
                    // Delete the message so the token doesn't linger in chat history.
                    await ctx.deleteMessage().catch(() => undefined);
                    const name = await facebook_publisher_1.facebookPublisher.verifyPageToken(pageId, token);
                    await facebook_repository_1.facebookRepository.upsert({ pageId, name, encryptedToken: (0, crypto_1.encryptSecret)(token) });
                    await ctx.reply(`✅ Facebook Page connected: <b>${(0, notifier_1.escapeHtml)(name)}</b> (${pageId})\nToken stored encrypted.`, {
                        parse_mode: 'HTML',
                    });
                    return;
                }
                case 'default': {
                    if (!(await guardAdmin(ctx)))
                        return;
                    const [pageId] = rest;
                    if (!pageId)
                        return void (await ctx.reply('Usage: /facebook default <pageId>'));
                    await facebook_repository_1.facebookRepository.setDefault(pageId);
                    await ctx.reply(`⭐ Default Facebook Page set to ${pageId}.`);
                    return;
                }
                case 'remove': {
                    if (!(await guardAdmin(ctx)))
                        return;
                    const [pageId] = rest;
                    if (!pageId)
                        return void (await ctx.reply('Usage: /facebook remove <pageId>'));
                    await facebook_repository_1.facebookRepository.deactivate(pageId);
                    await ctx.reply(`🗑 Facebook Page ${pageId} deactivated.`);
                    return;
                }
                default: {
                    const pages = await facebook_repository_1.facebookRepository.listAll();
                    if (pages.length === 0) {
                        await ctx.reply('No Facebook Pages connected.\n\n/facebook add <pageId> <pageAccessToken>\n' +
                            'Get a long-lived Page token from https://developers.facebook.com/tools/explorer (pages_manage_posts + pages_read_engagement).');
                        return;
                    }
                    const lines = pages
                        .map((p) => `${p.isDefault ? '⭐' : '•'} ${(0, notifier_1.escapeHtml)(p.name)} (<code>${p.pageId}</code>)${p.isActive ? '' : ' — inactive'}`)
                        .join('\n');
                    await ctx.reply(`<b>Facebook Pages</b>\n${lines}\n\nCommands: add &lt;id&gt; &lt;token&gt; | default &lt;id&gt; | remove &lt;id&gt;`, { parse_mode: 'HTML' });
                    return;
                }
            }
        }
        catch (err) {
            await ctx.reply(`❌ ${(0, notifier_1.escapeHtml)((0, errors_1.errorMessage)(err))}`, { parse_mode: 'HTML' });
        }
    });
    // ===== /pinterest =====
    bot.command('pinterest', async (ctx) => {
        const [sub, ...rest] = args(ctx);
        try {
            switch (sub) {
                case 'token': {
                    if (!(await guardAdmin(ctx)))
                        return;
                    const [token] = rest;
                    if (!token)
                        return void (await ctx.reply('Usage: /pinterest token <accessToken>'));
                    await ctx.deleteMessage().catch(() => undefined);
                    const username = await pinterest_publisher_1.pinterestPublisher.verifyToken(token);
                    await settings_service_1.settingsService.setSecret(settings_service_1.SETTING_KEYS.pinterestAccessToken, token);
                    await ctx.reply(`✅ Pinterest connected as <b>${(0, notifier_1.escapeHtml)(username)}</b>. Token stored encrypted.\nNow run /pinterest boards to sync your boards.`, {
                        parse_mode: 'HTML',
                    });
                    return;
                }
                case 'boards': {
                    if (!(await guardAdmin(ctx)))
                        return;
                    const boards = await pinterest_publisher_1.pinterestPublisher.fetchBoards();
                    for (const b of boards)
                        await pinterest_repository_1.pinterestRepository.upsert({ boardId: b.id, name: b.name });
                    await ctx.reply(`🔄 Synced ${boards.length} board(s). Use /pinterest list to view them.`);
                    return;
                }
                case 'default': {
                    if (!(await guardAdmin(ctx)))
                        return;
                    const [boardId] = rest;
                    if (!boardId)
                        return void (await ctx.reply('Usage: /pinterest default <boardId>'));
                    await pinterest_repository_1.pinterestRepository.setDefault(boardId);
                    await ctx.reply(`⭐ Default board set to ${boardId}.`);
                    return;
                }
                case 'remove': {
                    if (!(await guardAdmin(ctx)))
                        return;
                    const [boardId] = rest;
                    if (!boardId)
                        return void (await ctx.reply('Usage: /pinterest remove <boardId>'));
                    await pinterest_repository_1.pinterestRepository.deactivate(boardId);
                    await ctx.reply(`🗑 Board ${boardId} deactivated.`);
                    return;
                }
                default: {
                    const boards = await pinterest_repository_1.pinterestRepository.listAll();
                    const hasToken = (await settings_service_1.settingsService.get(settings_service_1.SETTING_KEYS.pinterestAccessToken)) !== null;
                    const lines = boards.length > 0
                        ? boards
                            .map((b) => `${b.isDefault ? '⭐' : '•'} ${(0, notifier_1.escapeHtml)(b.name)} (<code>${b.boardId}</code>)${b.isActive ? '' : ' — inactive'}`)
                            .join('\n')
                        : '(no boards synced yet)';
                    await ctx.reply(`<b>Pinterest</b> — token: ${hasToken ? '✅ set' : '❌ missing'}\n${lines}\n\n` +
                        `Commands: token &lt;accessToken&gt; | boards | default &lt;id&gt; | remove &lt;id&gt;`, { parse_mode: 'HTML' });
                    return;
                }
            }
        }
        catch (err) {
            await ctx.reply(`❌ ${(0, notifier_1.escapeHtml)((0, errors_1.errorMessage)(err))}`, { parse_mode: 'HTML' });
        }
    });
    // ===== /reddit =====
    bot.command('reddit', async (ctx) => {
        const [sub, ...rest] = args(ctx);
        try {
            switch (sub) {
                case 'show': {
                    const [draftId] = rest;
                    if (!draftId)
                        return void (await ctx.reply('Usage: /reddit show <draftId>'));
                    const draft = await reddit_repository_1.redditRepository.findById(draftId);
                    if (!draft)
                        return void (await ctx.reply('Draft not found.'));
                    const rules = await reddit_draft_service_1.redditDraftService.rulesFor(draft.subreddit);
                    const rulesText = rules.length > 0 ? `\n\n📏 <b>Rules:</b>\n• ${rules.map(notifier_1.escapeHtml).join('\n• ')}` : '';
                    await ctx.reply(`📝 <b>r/${(0, notifier_1.escapeHtml)(draft.subreddit)}</b> — ${draft.status}\n\n<b>${(0, notifier_1.escapeHtml)(draft.title)}</b>\n\n` +
                        `${(0, notifier_1.escapeHtml)(draft.body.slice(0, 2000))}${rulesText}`, {
                        parse_mode: 'HTML',
                        reply_markup: draft.status === client_1.DraftStatus.PENDING_REVIEW ? (0, keyboards_1.redditDraftKeyboard)(draft.id) : undefined,
                    });
                    return;
                }
                case 'sub': {
                    const [draftId, subreddit] = rest;
                    if (!draftId || !subreddit)
                        return void (await ctx.reply('Usage: /reddit sub <draftId> <subreddit>'));
                    const draft = await reddit_draft_service_1.redditDraftService.updateSubreddit(draftId, subreddit);
                    const rules = await reddit_draft_service_1.redditDraftService.rulesFor(draft.subreddit);
                    await ctx.reply(`🎯 Draft retargeted to r/${(0, notifier_1.escapeHtml)(draft.subreddit)}.` +
                        (rules.length > 0 ? `\n📏 Rules:\n• ${rules.map(notifier_1.escapeHtml).join('\n• ')}` : ''), { parse_mode: 'HTML', reply_markup: (0, keyboards_1.redditDraftKeyboard)(draft.id) });
                    return;
                }
                default: {
                    const drafts = await reddit_repository_1.redditRepository.findPending(10);
                    if (drafts.length === 0) {
                        await ctx.reply('No Reddit drafts awaiting review. Drafts are created automatically for each post — Reddit is never auto-published.');
                        return;
                    }
                    for (const d of drafts) {
                        await ctx.reply(`📝 <b>r/${(0, notifier_1.escapeHtml)(d.subreddit)}</b> (<code>${d.id}</code>)\n<b>${(0, notifier_1.escapeHtml)(d.title)}</b>\n\n${(0, notifier_1.escapeHtml)(d.body.slice(0, 500))}`, { parse_mode: 'HTML', reply_markup: (0, keyboards_1.redditDraftKeyboard)(d.id) });
                    }
                    return;
                }
            }
        }
        catch (err) {
            await ctx.reply(`❌ ${(0, notifier_1.escapeHtml)((0, errors_1.errorMessage)(err))}`, { parse_mode: 'HTML' });
        }
    });
}
//# sourceMappingURL=platforms.js.map