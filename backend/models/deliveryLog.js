import { getDB } from './user.js';

// create the delivery_log table if it doesn't exist
export function initDeliveryLogTable() {
  getDB().exec(`
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
}

// insert one delivery attempt record
export function logDelivery({ company, trigger = 'scheduled', status, email_ok, whatsapp_ok, slack_ok, error, digest_id }) {
  getDB().prepare(`
    INSERT INTO delivery_log
      (company, run_at, trigger, status, email_ok, whatsapp_ok, slack_ok, error, digest_id)
    VALUES
      (@company, @run_at, @trigger, @status, @email_ok, @whatsapp_ok, @slack_ok, @error, @digest_id)
  `).run({
    company,
    run_at:      new Date().toISOString(),
    trigger,
    status,
    email_ok:    email_ok    ?? null,
    whatsapp_ok: whatsapp_ok ?? null,
    slack_ok:    slack_ok    ?? null,
    error:       error       || null,
    digest_id:   digest_id   || null,
  });
}

// fetch the most recent delivery log entry
export function getLastDelivery() {
  return getDB().prepare('SELECT * FROM delivery_log ORDER BY id DESC LIMIT 1').get() || null;
}

// fetch the last N delivery log entries
export function getDeliveryHistory(limit = 30) {
  return getDB().prepare('SELECT * FROM delivery_log ORDER BY id DESC LIMIT ?').all(limit);
}
