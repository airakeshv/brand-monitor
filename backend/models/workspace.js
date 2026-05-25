import { getDB } from './user.js';

// create workspaces table if it doesn't exist
export function initWorkspaceTable() {
  getDB().exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id),
      name       TEXT    NOT NULL,
      created_at TEXT    DEFAULT (datetime('now'))
    )
  `);
}

// get all workspaces belonging to a user
export function getWorkspaces(userId) {
  return getDB()
    .prepare('SELECT * FROM workspaces WHERE user_id = ? ORDER BY created_at ASC')
    .all(userId);
}

// create a new workspace and its default settings row
export function createWorkspace(userId, name) {
  const db = getDB();
  const { lastInsertRowid } = db
    .prepare('INSERT INTO workspaces (user_id, name) VALUES (?, ?)')
    .run(userId, name);
  db.prepare('INSERT INTO settings (workspace_id) VALUES (?)').run(lastInsertRowid);
  return db.prepare('SELECT * FROM workspaces WHERE id = ?').get(lastInsertRowid);
}

// delete a workspace and all its data — only if it belongs to the user
export function deleteWorkspace(id, userId) {
  const db = getDB();
  const ws = db.prepare('SELECT id FROM workspaces WHERE id = ? AND user_id = ?').get(id, userId);
  if (!ws) return false;
  db.prepare('DELETE FROM delivery_log WHERE workspace_id = ?').run(id);
  db.prepare('DELETE FROM digests WHERE workspace_id = ?').run(id);
  db.prepare('DELETE FROM settings WHERE workspace_id = ?').run(id);
  db.prepare('DELETE FROM workspaces WHERE id = ?').run(id);
  return true;
}
