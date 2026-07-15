"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redditClient = exports.RedditClient = void 0;
const env_1 = require("../../config/env");
const errors_1 = require("../../lib/errors");
const logger_1 = require("../../lib/logger");
/**
 * Minimal Reddit API client used ONLY to submit a draft that a human has
 * explicitly approved via Telegram. There is no bulk or automatic posting.
 */
class RedditClient {
    accessToken = null;
    tokenExpiresAt = 0;
    isConfigured() {
        return Boolean(env_1.env.REDDIT_CLIENT_ID && env_1.env.REDDIT_CLIENT_SECRET && env_1.env.REDDIT_REFRESH_TOKEN);
    }
    /** Submits a single self (text) post. Returns the post URL. */
    async submitSelfPost(subreddit, title, body) {
        const token = await this.getAccessToken();
        const params = new URLSearchParams({
            api_type: 'json',
            kind: 'self',
            sr: subreddit,
            title: title.slice(0, 300),
            text: body,
            resubmit: 'false',
            sendreplies: 'true',
        });
        const res = await fetch('https://oauth.reddit.com/api/submit', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': env_1.env.REDDIT_USER_AGENT,
            },
            body: params.toString(),
        });
        const data = (await res.json().catch(() => ({})));
        if (!res.ok) {
            throw new errors_1.ExternalApiError('reddit', `submit failed (${res.status})`, res.status, res.status >= 500);
        }
        const errors = data.json?.errors ?? [];
        if (errors.length > 0) {
            // Errors like SUBREDDIT_NOTALLOWED / RATELIMIT are rule violations — do not retry blindly.
            const msg = errors.map((e) => e.join(': ')).join('; ');
            logger_1.logger.warn({ subreddit, msg }, 'reddit rejected submission');
            throw new errors_1.NonRetryableError(`Reddit rejected the post: ${msg}`);
        }
        const url = data.json?.data?.url;
        if (!url)
            throw new errors_1.ExternalApiError('reddit', 'submit succeeded but no URL returned', res.status, false);
        return url;
    }
    /** Fetches a subreddit's rules so the reviewer can check them before approving. */
    async fetchSubredditRules(subreddit) {
        try {
            const token = await this.getAccessToken();
            const res = await fetch(`https://oauth.reddit.com/r/${encodeURIComponent(subreddit)}/about/rules`, {
                headers: { Authorization: `Bearer ${token}`, 'User-Agent': env_1.env.REDDIT_USER_AGENT },
            });
            if (!res.ok)
                return [];
            const data = (await res.json());
            return (data.rules ?? []).map((r) => r.short_name ?? '').filter(Boolean);
        }
        catch {
            return [];
        }
    }
    async getAccessToken() {
        if (!this.isConfigured()) {
            throw new errors_1.ConfigurationError('Reddit is not configured. Set REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET and REDDIT_REFRESH_TOKEN in .env.');
        }
        if (this.accessToken && Date.now() < this.tokenExpiresAt - 60_000) {
            return this.accessToken;
        }
        const basic = Buffer.from(`${env_1.env.REDDIT_CLIENT_ID}:${env_1.env.REDDIT_CLIENT_SECRET}`).toString('base64');
        const res = await fetch('https://www.reddit.com/api/v1/access_token', {
            method: 'POST',
            headers: {
                Authorization: `Basic ${basic}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': env_1.env.REDDIT_USER_AGENT,
            },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: env_1.env.REDDIT_REFRESH_TOKEN,
            }).toString(),
        });
        const data = (await res.json().catch(() => ({})));
        if (!res.ok || !data.access_token) {
            throw new errors_1.ExternalApiError('reddit', `token refresh failed (${res.status})`, res.status, false);
        }
        this.accessToken = data.access_token;
        this.tokenExpiresAt = Date.now() + (data.expires_in ?? 3600) * 1000;
        return this.accessToken;
    }
}
exports.RedditClient = RedditClient;
exports.redditClient = new RedditClient();
//# sourceMappingURL=reddit.client.js.map