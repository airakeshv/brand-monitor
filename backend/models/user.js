import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DATABASE_PATH || './data/brand-monitor.db';

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
}

// get the single user's settings
export function getSettings() {
  const row = getDB().prepare('SELECT * FROM settings WHERE id = 1').get();
  return {
    ...row,
    competitor_names: JSON.parse(row.competitor_names),
    executive_names: JSON.parse(row.executive_names),
    include_keywords: JSON.parse(row.include_keywords),
    exclude_keywords: JSON.parse(row.exclude_keywords),
    exclude_domains: JSON.parse(row.exclude_domains),
    sources_enabled: JSON.parse(row.sources_enabled),
  };
}

// update settings fields (partial update supported)
export function saveSettings(updates) {
  const arrayFields = ['competitor_names', 'executive_names', 'include_keywords', 'exclude_keywords', 'exclude_domains'];
  const objectFields = ['sources_enabled'];

  const serialised = {};
  for (const [k, v] of Object.entries(updates)) {
    if (arrayFields.includes(k) || objectFields.includes(k)) {
      serialised[k] = JSON.stringify(v);
    } else {
      serialised[k] = v;
    }
  }

  const cols = Object.keys(serialised).map(k => `${k} = @${k}`).join(', ');
  getDB().prepare(`UPDATE settings SET ${cols} WHERE id = 1`).run(serialised);
}
