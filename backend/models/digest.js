import { getDB } from './user.js';

// create digests table if it doesn't exist
export function initDigestTable() {
  const db = getDB();
  db.exec(`
    CREATE TABLE IF NOT EXISTS digests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company TEXT NOT NULL,
      date TEXT NOT NULL,
      model_used TEXT DEFAULT '',
      json TEXT NOT NULL,
      delivered_at TEXT DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  try { db.exec('ALTER TABLE digests ADD COLUMN workspace_id INTEGER'); } catch (_) {}
}

// save a new digest — workspace_id ties it to the correct workspace
export function saveDigest({ company, date, model_used, json, workspaceId }) {
  return getDB()
    .prepare('INSERT INTO digests (company, date, model_used, json, workspace_id) VALUES (?, ?, ?, ?, ?)')
    .run(company, date, model_used, JSON.stringify(json), workspaceId || null);
}

// mark a digest as delivered
export function markDelivered(id) {
  getDB()
    .prepare("UPDATE digests SET delivered_at = datetime('now') WHERE id = ?")
    .run(id);
}

// get last N digests for a workspace — includes parsed digest for preview
export function getHistory(limit = 30, workspaceId = null) {
  const query = workspaceId
    ? 'SELECT id, company, date, model_used, delivered_at, created_at, json FROM digests WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ?'
    : 'SELECT id, company, date, model_used, delivered_at, created_at, json FROM digests ORDER BY created_at DESC LIMIT ?';
  const rows = workspaceId
    ? getDB().prepare(query).all(workspaceId, limit)
    : getDB().prepare(query).all(limit);
  return rows.map(row => {
    const digest = JSON.parse(row.json || '{}');
    return { ...row, digest, company: row.company || digest.company || '' };
  });
}

// get a single digest — optionally verify it belongs to the workspace
export function getDigestById(id, workspaceId = null) {
  const row = workspaceId
    ? getDB().prepare('SELECT * FROM digests WHERE id = ? AND workspace_id = ?').get(id, workspaceId)
    : getDB().prepare('SELECT * FROM digests WHERE id = ?').get(id);
  if (!row) return null;
  return { ...row, json: JSON.parse(row.json) };
}
