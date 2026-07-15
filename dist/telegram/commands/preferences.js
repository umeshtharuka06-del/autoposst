"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPreferenceCommands = registerPreferenceCommands;
const job_repository_1 = require("../../repositories/job.repository");
const settings_service_1 = require("../../services/settings.service");
const types_1 = require("../../types");
const keyboards_1 = require("../keyboards");
const auth_1 = require("../middleware/auth");
const notifier_1 = require("../notifier");
function registerPreferenceCommands(bot) {
    bot.command('language', async (ctx) => {
        await ctx.reply(`🌐 Current default publish language: <b>${types_1.LANGUAGE_LABELS[ctx.dbUser.language]}</b>\nPick a new one:`, { parse_mode: 'HTML', reply_markup: (0, keyboards_1.languageKeyboard)() });
    });
    bot.command('settings', async (ctx) => {
        const parts = String(ctx.match ?? '').trim().split(/\s+/).filter(Boolean);
        const [sub, value] = parts;
        if (sub === 'autopublish') {
            if (!(0, auth_1.requireAdmin)(ctx)) {
                await ctx.reply('⛔ Only the owner/admin can change auto-publish.');
                return;
            }
            if (value !== 'on' && value !== 'off') {
                await ctx.reply('Usage: /settings autopublish on|off');
                return;
            }
            await settings_service_1.settingsService.set(settings_service_1.SETTING_KEYS.defaultAutoPublish, value === 'on' ? 'true' : 'false');
            await ctx.reply(value === 'on'
                ? '⚡ Auto-publish ON: new posts go straight to Facebook & Pinterest after generation (Reddit still needs approval).'
                : '✋ Auto-publish OFF: new posts wait for /publish after generation.');
            return;
        }
        if (sub === 'tone') {
            await ctx.reply(`🎨 Current tone: <b>${types_1.TONE_LABELS[ctx.dbUser.tone]}</b>. Pick one:`, {
                parse_mode: 'HTML',
                reply_markup: (0, keyboards_1.toneKeyboard)(),
            });
            return;
        }
        const autoPublish = await settings_service_1.settingsService.getBool(settings_service_1.SETTING_KEYS.defaultAutoPublish, true);
        const stored = await settings_service_1.settingsService.listForDisplay();
        const storedLines = stored.length > 0 ? stored.map((s) => `  ${(0, notifier_1.escapeHtml)(s.key)} = ${(0, notifier_1.escapeHtml)(s.value)}`).join('\n') : '  (none)';
        await ctx.reply(`<b>⚙️ Settings</b>\n\n` +
            `Tone: <b>${types_1.TONE_LABELS[ctx.dbUser.tone]}</b> — /settings tone\n` +
            `Language: <b>${types_1.LANGUAGE_LABELS[ctx.dbUser.language]}</b> — /language\n` +
            `Auto-publish: <b>${autoPublish ? 'on' : 'off'}</b> — /settings autopublish on|off\n\n` +
            `<b>Stored settings</b>\n${storedLines}`, { parse_mode: 'HTML' });
    });
    bot.command('logs', async (ctx) => {
        const [logs, failed] = await Promise.all([job_repository_1.jobRepository.recentLogs(15), job_repository_1.jobRepository.unresolvedFailedJobs(5)]);
        const logLines = logs.length > 0
            ? logs
                .map((l) => `  <code>${l.createdAt.toISOString().slice(11, 19)}</code> [${l.queue}] ${l.level}: ${(0, notifier_1.escapeHtml)(l.message.slice(0, 120))}`)
                .join('\n')
            : '  (no logs yet)';
        const failedLines = failed.length > 0
            ? failed.map((f) => `  [${f.queue}] ${(0, notifier_1.escapeHtml)(f.failedReason.slice(0, 150))}`).join('\n')
            : '  (none 🎉)';
        await ctx.reply(`<b>🧾 Recent job logs</b>\n${logLines}\n\n<b>💀 Unresolved dead-letter jobs</b>\n${failedLines}\n\nUse /retry to re-queue failed publishes.`, {
            parse_mode: 'HTML',
        });
    });
}
//# sourceMappingURL=preferences.js.map