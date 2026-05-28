import { getDB } from './user.js';

// create the delivery_log table if it doesn't exist
export function initDeliveryLogTable() {
  const db = getDB();
  db.exec(`
    CREATE TABLE IF NOT EXISTS delivery_log (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      company      TEXT    NOT NULL,
      run_at       TEXT    NOT NULL,
      trigger      TEXT    DEFAULT 'scheduled',
      status       TEXT    NOT NULL,
      email_ok     INTEGER,
      whatsapp_ok  INTEGER,
      slack_ok     INTEGER,
      error        TEXT,
      digest_id    INTEGER
    )
  `);
  try { db.exec('ALTER TABLE delivery_log ADD COLUMN workspace_id INTEGER'); } catch (_) {}
}

// insert one delivery attempt record — workspace_id scopes it to the correct workspace
export function logDelivery({ company, trigger = 'scheduled', status, email_ok, whatsapp_ok, slack_ok, error, digest_id, workspace_id }) {
  getDB().prepare(`
    INSERT INTO delivery_log
      (company, run_at, trigger, status, email_ok, whatsapp_ok, slack_ok, error, digest_id, workspace_id)
    VALUES
      (@company, @run_at, @trigger, @status, @email_ok, @whatsapp_ok, @slack_ok, @error, @digest_id, @workspace_id)
  `).run({
    company,
    run_at:       new Date().toISOString(),
    trigger,
    status,
    email_ok:     email_ok    ?? null,
    whatsapp_ok:  whatsapp_ok ?? null,
    slack_ok:     slack_ok    ?? null,
    error:        error       || null,
    digest_id:    digest_id   || null,
    workspace_id: workspace_id || null,
  });
}

// fetch the most recent delivery log entry
export function getLastDelivery() {
  return getDB().prepare('SELECT * FROM delivery_log ORDER BY id DESC LIMIT 1').get() || null;
}

// fetch the last N delivery log entries for a workspace
export function getDeliveryHistory(limit = 30, workspaceId = null) {
  if (workspaceId) {
    return getDB().prepare('SELECT * FROM delivery_log WHERE workspace_id = ? ORDER BY id DESC LIMIT ?').all(workspaceId, limit);
  }
  return getDB().prepare('SELECT * FROM delivery_log ORDER BY id DESC LIMIT ?').all(limit);
}
