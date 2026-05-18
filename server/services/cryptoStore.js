// AES-256-GCM symmetric encryption for at-rest secrets (per-user OpenAI keys).
// Server-side encryption only; the key is the SESSION_SECRET / CRYPTO_SECRET
// from the environment. Without that secret you cannot decrypt the column.
//
// Format on disk: `v1:<base64-iv>:<base64-tag>:<base64-cipher>`

import crypto from 'node:crypto';

const ALG = 'aes-256-gcm';

function getKey() {
  const raw = process.env.CRYPTO_SECRET || process.env.SESSION_SECRET || '';
  if (raw.length < 16) {
    throw new Error('CRYPTO_SECRET (or SESSION_SECRET) must be set and at least 16 chars long.');
  }
  // Derive a 32-byte key from the secret via SHA-256 so any reasonable secret works.
  return crypto.createHash('sha256').update(raw).digest();
}

export function encryptSecret(plaintext) {
  if (!plaintext) return null;
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALG, key, iv);
  const ct = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
}

export function decryptSecret(payload) {
  if (!payload) return null;
  const parts = String(payload).split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') return null;
  try {
    const key = getKey();
    const iv = Buffer.from(parts[1], 'base64');
    const tag = Buffer.from(parts[2], 'base64');
    const ct = Buffer.from(parts[3], 'base64');
    const decipher = crypto.createDecipheriv(ALG, key, iv);
    decipher.setAuthTag(tag);
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
    return pt.toString('utf8');
  } catch {
    return null;
  }
}

// Mask for display: "sk-abc...xyz9"
export function maskSecret(plaintext) {
  if (!plaintext) return '';
  const s = String(plaintext);
  if (s.length <= 10) return '••••';
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}
