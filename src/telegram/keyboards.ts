import { InlineKeyboard } from 'grammy';
import type { Language, Tone } from '@prisma/client';
import { LANGUAGES, LANGUAGE_LABELS, TONES, TONE_LABELS } from '../types';

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

export function postReadyKeyboard(postId: string, language: Language): InlineKeyboard {
  const kb = new InlineKeyboard()
    .text('🚀 Publish now', `pub:${postId}:${language}`)
    .text('🕒 Schedule', `sch:${postId}`)
    .row();
  for (const lang of LANGUAGES.filter((l) => l !== language)) {
    kb.text(`Publish in ${LANGUAGE_LABELS[lang]}`, `pub:${postId}:${lang}`);
  }
  kb.row().text('❌ Cancel', `cxl:${postId}`);
  return kb;
}

export function redditDraftKeyboard(draftId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ Approve & post', `rda:${draftId}`)
    .text('🗑 Reject', `rdr:${draftId}`);
}

export function retryKeyboard(postId: string): InlineKeyboard {
  return new InlineKeyboard().text('🔁 Retry failed', `rty:${postId}`);
}

export function languageKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const lang of LANGUAGES) kb.text(LANGUAGE_LABELS[lang], `lng:${lang}`);
  return kb;
}

export function toneKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  TONES.forEach((tone: Tone, i: number) => {
    kb.text(TONE_LABELS[tone], `ton:${tone}`);
    if (i % 2 === 1) kb.row();
  });
  return kb;
}
