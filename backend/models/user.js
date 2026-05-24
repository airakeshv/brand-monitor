import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'brand-monitor.db');

// derive a 32-byte key from ENCRYPTION_KEY env var (or a safe dev fallback)
function deriveKey() {
  const raw = process.env.ENCRYPTION_KEY || 'brand-monitor-dev-key-change-in-prod';
  return crypto.createHash('sha256').update(raw).digest();
}

// AES-256-GCM encrypt — returns iv:ciphertext:authTag (all hex), or '' if text is empty
function encrypt(text) {
  if (!text) return '';
  const iv     = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(), iv);
  const enc    = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return [iv.toString('hex'), enc.toString('hex'), cipher.getAuthTag().toString('hex')].join(':');
}

// AES-256-GCM decrypt — returns plaintext, or '' on failure
function decrypt(stored) {
  if (!stored || !stored.includes(':')) return stored || '';
  try {
    const [ivHex, encHex, tagHex] = stored.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return decipher.update(encHex, 'hex', 'utf8') + decipher.final('utf8');
  } catch { return ''; }
}

// detect AES-256-GCM encrypted format: three colon-separated hex segments
function isEncrypted(value) {
  if (!value) return false;
  const parts = value.split(':');
  return parts.length === 3 && parts.every(p => /^[0-9a-f]+$/i.test(p));
}

const MASKED = '••••••••';

let db;

// open or create the SQLite database, ensuring the data directory exists
export function getDB() {
  if (!db) {
    const resolved = path.resolve(DB_PATH);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    db = new Database(resolved);
  }
  return db;
}

// create tables if they don't exist
export function initDB() {
  const db = getDB();

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      company_name TEXT DEFAULT '',
      competitor_names TEXT DEFAULT '[]',
      executive_names TEXT DEFAULT '[]',
      include_keywords TEXT DEFAULT '[]',
      exclude_keywords TEXT DEFAULT '[]',
      exclude_domains TEXT DEFAULT '[]',
      llm_model TEXT DEFAULT 'gemini-2.5-flash',
      llm_api_key TEXT DEFAULT '',
      fallback_model TEXT DEFAULT 'gemini-2.5-flash',
      digest_language TEXT DEFAULT 'English',
      timezone TEXT DEFAULT 'Asia/Kolkata',
      delivery_time TEXT DEFAULT '08:00',
      frequency TEXT DEFAULT 'daily',
      pause_from TEXT DEFAULT NULL,
      pause_to TEXT DEFAULT NULL,
      email TEXT DEFAULT '',
      whatsapp TEXT DEFAULT '',
      slack_webhook TEXT DEFAULT '',
      dev_webhook TEXT DEFAULT '',
      crisis_sensitivity TEXT DEFAULT 'medium',
      review_threshold INTEGER DEFAULT 3,
      sources_enabled TEXT DEFAULT '{}'
    )
  `);

  // safe migration: add news_lookback column if it doesn't already exist
  try { db.exec("ALTER TABLE settings ADD COLUMN news_lookback TEXT DEFAULT '7d'"); } catch (_) {}

  // seed a single-user default row if none exists
  const row = db.prepare('SELECT id FROM settings WHERE id = 1').get();
  if (!row) {
    db.prepare('INSERT INTO settings (id) VALUES (1)').run();
  }

  // startup guard: encrypt any plaintext llm_api_key still in the DB
  const keyRow = db.prepare('SELECT llm_api_key FROM settings WHERE id = 1').get();
  if (keyRow?.llm_api_key && !isEncrypted(keyRow.llm_api_key)) {
    db.prepare('UPDATE settings SET llm_api_key = ? WHERE id = 1').run(encrypt(keyRow.llm_api_key));
  }
}

// get the single user's settings — API key is masked for client safety
export function getSettings() {
  const row = getDB().prepare('SELECT * FROM settings WHERE id = 1').get();
  return {
    ...row,
    competitor_names:  JSON.parse(row.competitor_names),
    executive_names:   JSON.parse(row.executive_names),
    include_keywords:  JSON.parse(row.include_keywords),
    exclude_keywords:  JSON.parse(row.exclude_keywords),
    exclude_domains:   JSON.parse(row.exclude_domains),
    sources_enabled:   JSON.parse(row.sources_enabled),
    llm_api_key:       row.llm_api_key ? MASKED : '',
    llm_api_key_set:   !!row.llm_api_key,
  };
}

// get settings with the real decrypted API key — for internal service use only
export function getSettingsInternal() {
  const row = getDB().prepare('SELECT * FROM settings WHERE id = 1').get();
  return {
    ...row,
    competitor_names: JSON.parse(row.competitor_names),
    executive_names:  JSON.parse(row.executive_names),
    include_keywords: JSON.parse(row.include_keywords),
    exclude_keywords: JSON.parse(row.exclude_keywords),
    exclude_domains:  JSON.parse(row.exclude_domains),
    sources_enabled:  JSON.parse(row.sources_enabled),
    llm_api_key:      decrypt(row.llm_api_key),
  };
}

// update settings fields (partial update supported); AES-256 encrypts llm_api_key
export function saveSettings(updates) {
  const arrayFields  = ['competitor_names', 'executive_names', 'include_keywords', 'exclude_keywords', 'exclude_domains'];
  const objectFields = ['sources_enabled'];

  const serialised = {};
  for (const [k, v] of Object.entries(updates)) {
    if (k === 'llm_api_key_set') continue; // read-only computed field — never store
    if (k === 'llm_api_key') {
      if (!v || v === MASKED) continue; // masked sentinel or blank → keep existing encrypted value
      serialised[k] = encrypt(v);      // new key provided → encrypt before storing
    } else if (arrayFields.includes(k) || objectFields.includes(k)) {
      serialised[k] = JSON.stringify(v);
    } else {
      serialised[k] = v;
    }
  }

  if (Object.keys(serialised).length === 0) return;
  const cols = Object.keys(serialised).map(k => `${k} = @${k}`).join(', ');
  getDB().prepare(`UPDATE settings SET ${cols} WHERE id = 1`).run(serialised);
}
