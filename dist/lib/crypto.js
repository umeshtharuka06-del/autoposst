"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptSecret = encryptSecret;
exports.decryptSecret = decryptSecret;
exports.maskSecret = maskSecret;
const crypto_1 = require("crypto");
const env_1 = require("../config/env");
const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;
const key = Buffer.from(env_1.env.ENCRYPTION_KEY, 'hex');
/**
 * Encrypts a UTF-8 string with AES-256-GCM.
 * Output format: base64(iv | authTag | ciphertext)
 */
function encryptSecret(plaintext) {
    const iv = (0, crypto_1.randomBytes)(IV_LENGTH);
    const cipher = (0, crypto_1.createCipheriv)(ALGO, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
}
function decryptSecret(payload) {
    const buf = Buffer.from(payload, 'base64');
    if (buf.length < IV_LENGTH + 16 + 1) {
        throw new Error('Invalid encrypted payload');
    }
    const iv = buf.subarray(0, IV_LENGTH);
    const tag = buf.subarray(IV_LENGTH, IV_LENGTH + 16);
    const ciphertext = buf.subarray(IV_LENGTH + 16);
    const decipher = (0, crypto_1.createDecipheriv)(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
/** Masks a secret for display: keeps first 4 and last 4 chars. */
function maskSecret(secret) {
    if (secret.length <= 8)
        return '••••••••';
    return `${secret.slice(0, 4)}…${secret.slice(-4)}`;
}
//# sourceMappingURL=crypto.js.map