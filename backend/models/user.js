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

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      email      TEXT    NOT NULL UNIQUE,
      created_at TEXT    DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS magic_tokens (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id),
      token_hash TEXT    NOT NULL,
      expires_at TEXT    NOT NULL,
      used       INTEGER NOT NULL DEFAULT 0
    )
  `);

  // safe migrations
  try { db.exec("ALTER TABLE settings ADD COLUMN news_lookback TEXT DEFAULT '7d'"); } catch (_) {}
  try { db.exec('ALTER TABLE settings ADD COLUMN workspace_id INTEGER'); } catch (_) {}
  try { db.exec("ALTER TABLE settings ADD COLUMN companies TEXT DEFAULT '[]'"); } catch (_) {}
  try { db.exec("ALTER TABLE settings ADD COLUMN plan TEXT DEFAULT 'pro'"); } catch (_) {}

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

// seed default user + workspace for the existing single-user row — called after initWorkspaceTable()
export function runSeedMigration() {
  const db = getDB();
  const userCount = db.prepare('SELECT COUNT(*) as n FROM users').get().n;
  if (userCount > 0) return;

  db.prepare("INSERT OR IGNORE INTO users (id, email) VALUES (1, 'seed@local')").run();

  const s = db.prepare('SELECT company_name FROM settings WHERE id = 1').get();
  const name = s?.company_name || 'Default';
  db.prepare('INSERT OR IGNORE INTO workspaces (id, user_id, name) VALUES (1, 1, ?)').run(name);

  db.prepare('UPDATE settings SET workspace_id = 1 WHERE id = 1 AND workspace_id IS NULL').run();
}

// default empty settings shape — returned when a workspace has no settings row yet
function emptySettings(extras = {}) {
  return {
    company_name: '', competitor_names: [], executive_names: [],
    include_keywords: [], exclude_keywords: [], exclude_domains: [],
    llm_model: 'gemini-2.5-flash', llm_api_key: '', llm_api_key_set: false,
    fallback_model: 'gemini-2.5-flash', digest_language: 'English',
    timezone: 'Asia/Kolkata', delivery_time: '08:00', frequency: 'daily',
    pause_from: null, pause_to: null, email: '', whatsapp: '',
    slack_webhook: '', dev_webhook: '', crisis_sensitivity: 'medium',
    review_threshold: 3, sources_enabled: {}, companies: [], plan: 'pro',
    news_lookback: '7d', ...extras,
  };
}

// get workspace settings — API key masked for client safety
export function getSettings(workspaceId) {
  const row = getDB().prepare('SELECT * FROM settings WHERE workspace_id = ?').get(workspaceId);
  if (!row) return emptySettings();
  return {
    ...row,
    competitor_names:  JSON.parse(row.competitor_names  || '[]'),
    executive_names:   JSON.parse(row.executive_names   || '[]'),
    include_keywords:  JSON.parse(row.include_keywords  || '[]'),
    exclude_keywords:  JSON.parse(row.exclude_keywords  || '[]'),
    exclude_domains:   JSON.parse(row.exclude_domains   || '[]'),
    sources_enabled:   JSON.parse(row.sources_enabled   || '{}'),
    companies:         JSON.parse(row.companies         || '[]'),
    plan:              row.plan || 'pro',
    llm_api_key:       row.llm_api_key ? MASKED : '',
    llm_api_key_set:   !!row.llm_api_key,
  };
}

// get workspace settings with decrypted API key — for internal service use only
export function getSettingsInternal(workspaceId) {
  const row = getDB().prepare('SELECT * FROM settings WHERE workspace_id = ?').get(workspaceId);
  if (!row) return emptySettings();
  return {
    ...row,
    competitor_names: JSON.parse(row.competitor_names  || '[]'),
    executive_names:  JSON.parse(row.executive_names   || '[]'),
    include_keywords: JSON.parse(row.include_keywords  || '[]'),
    exclude_keywords: JSON.parse(row.exclude_keywords  || '[]'),
    exclude_domains:  JSON.parse(row.exclude_domains   || '[]'),
    sources_enabled:  JSON.parse(row.sources_enabled   || '{}'),
    companies:        JSON.parse(row.companies         || '[]'),
    plan:             row.plan || 'pro',
    llm_api_key:      decrypt(row.llm_api_key),
  };
}

// update workspace settings (partial update supported); AES-256 encrypts llm_api_key
export function saveSettings(updates, workspaceId) {
  const arrayFields  = ['competitor_names', 'executive_names', 'include_keywords', 'exclude_keywords', 'exclude_domains', 'companies'];
  const objectFields = ['sources_enabled'];

  const serialised = {};
  for (const [k, v] of Object.entries(updates)) {
    if (k === 'llm_api_key_set') continue;  // read-only computed field — never store
    if (k === 'workspace_id')    continue;  // never allow overwriting workspace ownership
    if (k === 'id')              continue;  // never update the primary key
    if (k === 'llm_api_key') {
      if (!v || v === MASKED) continue;     // masked sentinel or blank → keep existing
      serialised[k] = encrypt(v);
    } else if (arrayFields.includes(k) || objectFields.includes(k)) {
      serialised[k] = JSON.stringify(v);
    } else {
      serialised[k] = v;
    }
  }

  if (Object.keys(serialised).length === 0) return;
  const cols = Object.keys(serialised).map(k => `${k} = @${k}`).join(', ');
  // use _wsId as named param to avoid collision with any field named workspace_id
  getDB().prepare(`UPDATE settings SET ${cols} WHERE workspace_id = @_wsId`).run({ ...serialised, _wsId: workspaceId });
}
