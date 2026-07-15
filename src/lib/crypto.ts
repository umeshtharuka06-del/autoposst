import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { env } from '../config/env';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;
const key = Buffer.from(env.ENCRYPTION_KEY, 'hex');

/**
 * Encrypts a UTF-8 string with AES-256-GCM.
 * Output format: base64(iv | authTag | ciphertext)
 */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decryptSecret(payload: string): string {
  const buf = Buffer.from(payload, 'base64');
  if (buf.length < IV_LENGTH + 16 + 1) {
    throw new Error('Invalid encrypted payload');
  }
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + 16);
  const ciphertext = buf.subarray(IV_LENGTH + 16);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

/** Masks a secret for display: keeps first 4 and last 4 chars. */
export function maskSecret(secret: string): string {
  if (secret.length <= 8) return '••••••••';
  return `${secret.slice(0, 4)}…${secret.slice(-4)}`;
}
