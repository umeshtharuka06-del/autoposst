import { decryptSecret, encryptSecret } from '../lib/crypto';
import { settingsRepository } from '../repositories/settings.repository';

/** Well-known setting keys. */
export const SETTING_KEYS = {
  pinterestAccessToken: 'pinterest.access_token',
  defaultAutoPublish: 'posts.auto_publish',
  publishLanguage: 'posts.publish_language',
} as const;

export class SettingsService {
  async get(key: string): Promise<string | null> {
    const row = await settingsRepository.get(key);
    if (!row) return null;
    return row.isSecret ? decryptSecret(row.value) : row.value;
  }

  async set(key: string, value: string): Promise<void> {
    await settingsRepository.set(key, value, false);
  }

  async setSecret(key: string, value: string): Promise<void> {
    await settingsRepository.set(key, encryptSecret(value), true);
  }

  async getBool(key: string, fallback: boolean): Promise<boolean> {
    const v = await this.get(key);
    if (v === null) return fallback;
    return v === 'true' || v === '1';
  }

  /** Lists non-secret settings plus the keys (not values) of secret ones. */
  async listForDisplay(): Promise<{ key: string; value: string; isSecret: boolean }[]> {
    const rows = await settingsRepository.list();
    return rows.map((r) => ({
      key: r.key,
      value: r.isSecret ? '••••••••' : r.value,
      isSecret: r.isSecret,
    }));
  }
}

export const settingsService = new SettingsService();
