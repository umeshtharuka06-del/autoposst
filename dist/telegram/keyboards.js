"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postReadyKeyboard = postReadyKeyboard;
exports.redditDraftKeyboard = redditDraftKeyboard;
exports.retryKeyboard = retryKeyboard;
exports.languageKeyboard = languageKeyboard;
exports.toneKeyboard = toneKeyboard;
const grammy_1 = require("grammy");
const types_1 = require("../types");
/**
 * Callback-data conventions (kept short — Telegram caps callback_data at 64 bytes):
 *   pub:<postId>:<lang>   publish now in language
 *   sch:<postId>          prompt for schedule
 *   cxl:<postId>          cancel post
 *   rda:<draftId>         approve reddit draft (publishes)
 *   rdr:<draftId>         reject reddit draft
 *   lng:<code>            set user language
 *   ton:<tone>            set user tone
 *   rty:<postId>          retry failed platform jobs
 */
function postReadyKeyboard(postId, language) {
    const kb = new grammy_1.InlineKeyboard()
        .text('🚀 Publish now', `pub:${postId}:${language}`)
        .text('🕒 Schedule', `sch:${postId}`)
        .row();
    for (const lang of types_1.LANGUAGES.filter((l) => l !== language)) {
        kb.text(`Publish in ${types_1.LANGUAGE_LABELS[lang]}`, `pub:${postId}:${lang}`);
    }
    kb.row().text('❌ Cancel', `cxl:${postId}`);
    return kb;
}
function redditDraftKeyboard(draftId) {
    return new grammy_1.InlineKeyboard()
        .text('✅ Approve & post', `rda:${draftId}`)
        .text('🗑 Reject', `rdr:${draftId}`);
}
function retryKeyboard(postId) {
    return new grammy_1.InlineKeyboard().text('🔁 Retry failed', `rty:${postId}`);
}
function languageKeyboard() {
    const kb = new grammy_1.InlineKeyboard();
    for (const lang of types_1.LANGUAGES)
        kb.text(types_1.LANGUAGE_LABELS[lang], `lng:${lang}`);
    return kb;
}
function toneKeyboard() {
    const kb = new grammy_1.InlineKeyboard();
    types_1.TONES.forEach((tone, i) => {
        kb.text(types_1.TONE_LABELS[tone], `ton:${tone}`);
        if (i % 2 === 1)
            kb.row();
    });
    return kb;
}
//# sourceMappingURL=keyboards.js.map