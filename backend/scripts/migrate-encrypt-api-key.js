// One-time migration: encrypt any plaintext llm_api_key stored in the settings table
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../.env') });
import crypto from 'crypto';
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = process.env.DATABASE_PATH || './data/brand-monitor.db';

// derive a 32-byte key — must match the logic in models/user.js
function deriveKey() {
  const raw = process.env.ENCRYPTION_KEY || 'brand-monitor-dev-key-change-in-prod';
  return crypto.createHash('sha256').update(raw).digest();
}

// AES-256-GCM encrypt — returns iv:ciphertext:authTag (all hex)
function encrypt(text) {
  if (!text) return '';
  const iv     = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(), iv);
  const enc    = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return [iv.toString('hex'), enc.toString('hex'), cipher.getAuthTag().toString('hex')].join(':');
}

// detect whether a value is already AES-256-GCM encrypted (three hex segments separated by ':')
function isEncrypted(value) {
  if (!value) return false;
  const parts = value.split(':');
  return parts.length === 3 && parts.every(p => /^[0-9a-f]+$/i.test(p));
}

const db = new Database(path.resolve(DB_PATH));
const row = db.prepare('SELECT llm_api_key FROM settings WHERE id = 1').get();

if (!row) {
  console.log('No settings row found — nothing to migrate.');
  process.exit(0);
}

if (!row.llm_api_key) {
  console.log('No API key stored — nothing to migrate.');
  process.exit(0);
}

if (isEncrypted(row.llm_api_key)) {
  console.log('API key is already encrypted — no action needed.');
  process.exit(0);
}

const encrypted = encrypt(row.llm_api_key);
db.prepare('UPDATE settings SET llm_api_key = ? WHERE id = 1').run(encrypted);
console.log('Done — llm_api_key encrypted and saved.');
