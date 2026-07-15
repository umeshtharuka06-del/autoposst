"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSystemPrompt = buildSystemPrompt;
exports.buildUserPrompt = buildUserPrompt;
exports.contentJsonSchema = contentJsonSchema;
const TONE_GUIDES = {
    PROFESSIONAL: 'Polished, credible, businesslike. No slang. Minimal emoji (max 1-2 subtle ones). Focus on value and trust.',
    FRIENDLY: 'Warm, welcoming, conversational. Moderate emoji use. Speak like a helpful friend, not a brand.',
    GAMING: 'High-energy, playful, meme-aware. Gamer vocabulary where natural (GG, level up, clutch). Bold emoji use.',
    LUXURY: 'Elegant, aspirational, understated. Sensory language. Very sparse, refined emoji (✨ at most). Never salesy.',
    CASUAL: 'Relaxed, everyday language. Short sentences. Light emoji. Feels like a personal post, not marketing.',
};
function buildSystemPrompt(tone) {
    return `You are an expert multilingual social media content strategist for Facebook, Pinterest and Reddit.

TONE: ${TONE_GUIDES[tone]}

LANGUAGES: You produce three language versions for every platform: English (EN), Sinhala (SI, සිංහල script), Tamil (TA, தமிழ் script).
CRITICAL: Sinhala and Tamil versions must be NATURAL REWRITES for native speakers — idiomatic, culturally fluent — NOT literal word-for-word translations. Keep brand names, product names and technical terms in their original form.

PER-PLATFORM RULES:

FACEBOOK:
- "body" is the post caption: hook in the first line, 2-5 short paragraphs or lines, ends with the call to action.
- 3-8 relevant hashtags in "hashtags" (with # prefix), not embedded mid-sentence.
- Emoji placement optimized for scannability per the tone guide.
- "title", "description", "altText" are null for Facebook.

PINTEREST:
- "title": SEO-optimized Pin title, max 100 characters, leading keywords first.
- "description": SEO-rich Pin description, 150-450 characters, natural keyword usage, ends with CTA.
- "body": same as description (Pinterest has no separate body).
- "keywords": 5-12 SEO keywords/phrases, no # prefix.
- "altText": literal accessibility description of the image/video for screen readers, max 480 chars.
- "hashtags": 3-6 with # prefix.

REDDIT:
- Reddit hates marketing. "title" must read like a genuine community post: specific, honest, zero clickbait, no emoji, no hashtags.
- "body": authentic first-person text that provides context or value; transparently disclose affiliation if promotional ("I made this", "we built..."). No hard selling, no CTA pressure.
- "hashtags" and "keywords" are empty arrays; "altText", "description", "cta" are null.
- Also suggest ONE plausible subreddit (without r/ prefix) in "redditSubredditSuggestion" that fits the content and typically allows this kind of post.

Every platform/language combination gets a "cta" (call-to-action, one short sentence) except Reddit where cta is null.
Return content for ALL THREE platforms in ALL THREE languages.`;
}
function buildUserPrompt(params) {
    const captionPart = params.caption
        ? `USER CAPTION (source of truth for meaning; enhance, do not contradict):\n${params.caption}`
        : 'USER CAPTION: (none provided — infer the subject entirely from the attached media)';
    return `${captionPart}\n\nMEDIA: ${params.mediaSummary}\n\nGenerate the full multilingual, multi-platform content package now.`;
}
/** Strict JSON schema for the Responses API structured output. */
function contentJsonSchema() {
    const platformContent = {
        type: 'object',
        additionalProperties: false,
        properties: {
            title: { type: ['string', 'null'] },
            body: { type: 'string' },
            description: { type: ['string', 'null'] },
            keywords: { type: 'array', items: { type: 'string' } },
            hashtags: { type: 'array', items: { type: 'string' } },
            altText: { type: ['string', 'null'] },
            cta: { type: ['string', 'null'] },
        },
        required: ['title', 'body', 'description', 'keywords', 'hashtags', 'altText', 'cta'],
    };
    const languageSet = {
        type: 'object',
        additionalProperties: false,
        properties: { EN: platformContent, SI: platformContent, TA: platformContent },
        required: ['EN', 'SI', 'TA'],
    };
    return {
        type: 'object',
        additionalProperties: false,
        properties: {
            FACEBOOK: languageSet,
            PINTEREST: languageSet,
            REDDIT: languageSet,
            redditSubredditSuggestion: { type: 'string' },
        },
        required: ['FACEBOOK', 'PINTEREST', 'REDDIT', 'redditSubredditSuggestion'],
    };
}
//# sourceMappingURL=prompts.js.map