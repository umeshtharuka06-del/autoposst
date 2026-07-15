"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.settingsService = exports.SettingsService = exports.SETTING_KEYS = void 0;
const crypto_1 = require("../lib/crypto");
const settings_repository_1 = require("../repositories/settings.repository");
/** Well-known setting keys. */
exports.SETTING_KEYS = {
    pinterestAccessToken: 'pinterest.access_token',
    defaultAutoPublish: 'posts.auto_publish',
    publishLanguage: 'posts.publish_language',
};
class SettingsService {
    async get(key) {
        const row = await settings_repository_1.settingsRepository.get(key);
        if (!row)
            return null;
        return row.isSecret ? (0, crypto_1.decryptSecret)(row.value) : row.value;
    }
    async set(key, value) {
        await settings_repository_1.settingsRepository.set(key, value, false);
    }
    async setSecret(key, value) {
        await settings_repository_1.settingsRepository.set(key, (0, crypto_1.encryptSecret)(value), true);
    }
    async getBool(key, fallback) {
        const v = await this.get(key);
        if (v === null)
            return fallback;
        return v === 'true' || v === '1';
    }
    /** Lists non-secret settings plus the keys (not values) of secret ones. */
    async listForDisplay() {
        const rows = await settings_repository_1.settingsRepository.list();
        return rows.map((r) => ({
            key: r.key,
            value: r.isSecret ? '••••••••' : r.value,
            isSecret: r.isSecret,
        }));
    }
}
exports.SettingsService = SettingsService;
exports.settingsService = new SettingsService();
//# sourceMappingURL=settings.service.js.map