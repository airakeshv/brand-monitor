import { Router } from 'express';
import { existsSync, statSync } from 'fs';
import { resolve } from 'path';
import { searchAll } from '../services/searchService.js';
import { applyNoiseFilter } from '../services/noiseFilter.js';
import { runDigest } from '../services/digestService.js';
import { sendDigestEmail, sendMultiCompanyDigestEmail } from '../services/emailService.js';
import { sendWhatsAppDigest, sendWhatsAppTest } from '../services/whatsappService.js';
import { sendSlackDigest } from '../services/slackService.js';
import { getDB, getSettings, getSettingsInternal, saveSettings } from '../models/user.js';
import { getHistory, getDigestById } from '../models/digest.js';
import { scheduleDigest, rescheduleWorkspace, stopSchedule, getScheduleStatus } from '../scheduler/cronManager.js';
import { getDeliveryHistory } from '../models/deliveryLog.js';
import { generateMagicToken, hashToken, signJWT, sendMagicLinkEmail } from '../services/authService.js';
import { discoverExecutives } from '../services/executiveDiscoveryService.js';
import { getWorkspaces, createWorkspace, deleteWorkspace } from '../models/workspace.js';

const router = Router();

router.get('/ping', (_req, res) => res.json({ message: 'API ready' }));

// DB health check — confirms path, file existence, user/workspace counts
// Accessible to any authenticated user — useful for diagnosing Railway volume issues
router.get('/debug/db', (req, res) => {
  try {
    const db     = getDB();
    const dbPath = resolve(process.env.DATABASE_PATH || 'data/brand-monitor.db');
    const exists = existsSync(dbPath);
    const size   = exists ? statSync(dbPath).size : 0;
    const users      = db.prepare('SELECT COUNT(*) as n FROM users').get().n;
    const workspaces = db.prepare('SELECT COUNT(*) as n FROM workspaces').get().n;
    const settings   = db.prepare('SELECT COUNT(*) as n FROM settings').get().n;
    const myWs       = db.prepare('SELECT * FROM workspaces WHERE user_id = ?').all(req.userId);
    res.json({ dbPath, exists, sizeBytes: size, users, workspaces, settings, myWorkspaces: myWs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// request a magic sign-in link — upserts user, stores hashed token, emails the link
router.post('/auth/request-link', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !/\S+@\S+\.\S+/.test(email)) return res.status(400).json({ error: 'Valid email is required' });

    const db = getDB();
    db.prepare('INSERT OR IGNORE INTO users (email) VALUES (?)').run(email);
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);

    const { raw, hash, expiresAt } = generateMagicToken();
    db.prepare('INSERT INTO magic_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)').run(user.id, hash, expiresAt);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    console.log('Sending magic link to:', email);
    await sendMagicLinkEmail(email, `${frontendUrl}/auth/callback?token=${raw}`);

    res.json({ ok: true });
  } catch (err) {
    console.error('Request link error:', err.message);
    res.status(500).json({ error: 'Failed to send magic link' });
  }
});

// verify a magic link token — marks it used and returns a signed JWT
router.get('/auth/verify', (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'token is required' });

    const db   = getDB();
    const hash = hashToken(token);
    const row  = db.prepare('SELECT * FROM magic_tokens WHERE token_hash = ? AND used = 0').get(hash);

    if (!row)                                  return res.status(401).json({ error: 'Invalid or already used link' });
    if (new Date(row.expires_at) < new Date()) return res.status(401).json({ error: 'Link has expired. Request a new one.' });

    db.prepare('UPDATE magic_tokens SET used = 1 WHERE id = ?').run(row.id);
    const user      = db.prepare('SELECT * FROM users WHERE id = ?').get(row.user_id);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    res.json({ token: signJWT(user.id, user.email), expiresAt });
  } catch (err) {
    console.error('Verify token error:', err.message);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// ─── Workspace middleware ─────────────────────────────────────────────────────
// resolve req.workspaceId for every authenticated route — auto-creates workspace for new users
async function resolveWorkspace(req, res, next) {
  try {
    const db          = getDB();
    const headerWsId  = parseInt(req.headers['x-workspace-id']);

    if (headerWsId && !isNaN(headerWsId)) {
      // verify the workspace actually belongs to this user
      const ws = db.prepare('SELECT id FROM workspaces WHERE id = ? AND user_id = ?').get(headerWsId, req.userId);
      if (!ws) return res.status(403).json({ error: 'Workspace not found or access denied' });
      req.workspaceId = headerWsId;
    } else {
      // find user's first workspace — auto-create one if they have none (new user)
      let ws = db.prepare('SELECT id FROM workspaces WHERE user_id = ? ORDER BY id ASC LIMIT 1').get(req.userId);
      if (!ws) {
        const user = db.prepare('SELECT email FROM users WHERE id = ?').get(req.userId);
        const name  = (user?.email || 'user').split('@')[0];
        ws = createWorkspace(req.userId, name);
      }
      req.workspaceId = ws.id;
    }
    next();
  } catch (err) {
    console.error('Workspace resolution failed:', err.message);
    res.status(500).json({ error: 'Workspace resolution failed' });
  }
}

// apply workspace middleware to every route that needs it (all except auth + ping)
router.use((req, res, next) => {
  if (req.path.startsWith('/auth/') || req.path === '/ping') return next();
  return resolveWorkspace(req, res, next);
});

// ─── Workspace CRUD ───────────────────────────────────────────────────────────

// list all workspaces belonging to the authenticated user
router.get('/workspaces', (req, res) => {
  try {
    res.json(getWorkspaces(req.userId));
  } catch (err) {
    res.status(500).json({ error: 'Failed to load workspaces' });
  }
});

// create a new workspace (and its default settings row)
router.post('/workspaces', (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
    const ws = createWorkspace(req.userId, name.trim());
    res.json(ws);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create workspace' });
  }
});

// delete a workspace — only the owner can delete; rejects if it's the last workspace
router.delete('/workspaces/:id', (req, res) => {
  try {
    const db   = getDB();
    const wsId = parseInt(req.params.id);
    const remaining = db.prepare('SELECT COUNT(*) as n FROM workspaces WHERE user_id = ?').get(req.userId).n;
    if (remaining <= 1) return res.status(400).json({ error: 'Cannot delete your only workspace' });
    const ok = deleteWorkspace(wsId, req.userId);
    if (!ok) return res.status(404).json({ error: 'Workspace not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete workspace' });
  }
});

// ─── Search ───────────────────────────────────────────────────────────────────

// search all sources for a company name
router.post('/search', async (req, res) => {
  try {
    const { company } = req.body;
    if (!company) return res.status(400).json({ error: 'company is required' });

    const settings = getSettingsInternal(req.workspaceId);
    const raw      = await searchAll(company, settings);
    const filtered = applyNoiseFilter(raw, settings);

    res.json({ company, count: filtered.length, results: filtered });
  } catch (err) {
    console.error('Search error:', err.message);
    res.status(500).json({ error: 'Search failed' });
  }
});

// ─── Digest ───────────────────────────────────────────────────────────────────

// generate a digest for a company using the chosen model
router.post('/digest', async (req, res) => {
  try {
    const { company, model, apiKey } = req.body;
    if (!company) return res.status(400).json({ error: 'company is required' });

    const settings = { ...getSettingsInternal(req.workspaceId), ...(model && { llm_model: model }), ...(apiKey && { llm_api_key: apiKey }) };
    const { id, digest } = await runDigest(company, settings, null, req.workspaceId);

    res.json({ id, digest });
  } catch (err) {
    console.error('Digest error:', err.message);
    res.status(500).json({ error: err.message || 'Digest generation failed' });
  }
});

// ─── Settings ─────────────────────────────────────────────────────────────────

// get workspace settings
router.get('/settings', (req, res) => {
  try {
    res.json(getSettings(req.workspaceId));
  } catch (err) {
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

// update workspace settings then reschedule only this workspace's cron
function handleSaveSettings(req, res) {
  try {
    // plan limit: free = 1 company max, pro = 5 companies max
    if (Array.isArray(req.body.companies)) {
      const current      = getSettings(req.workspaceId);
      const plan         = current.plan || 'pro';
      const maxCompanies = plan === 'pro' ? 5 : 1;
      const active       = req.body.companies.filter(Boolean);
      if (active.length > maxCompanies) {
        return res.status(403).json({ error: 'Upgrade to Pro to track more than 1 company' });
      }
    }
    saveSettings(req.body, req.workspaceId);
    const settings = getSettingsInternal(req.workspaceId);
    rescheduleWorkspace(req.workspaceId, settings);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save settings' });
  }
}
router.put('/settings',  handleSaveSettings);
router.post('/settings', handleSaveSettings);

// ─── History ──────────────────────────────────────────────────────────────────

// get digest history for this workspace
router.get('/history', (req, res) => {
  try {
    res.json(getHistory(30, req.workspaceId));
  } catch (err) {
    res.status(500).json({ error: 'Failed to load history' });
  }
});

// get a single digest by id — scoped to workspace
router.get('/history/:id', (req, res) => {
  try {
    const row = getDigestById(Number(req.params.id), req.workspaceId);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load digest' });
  }
});

// ─── Run Now ──────────────────────────────────────────────────────────────────

// run digest immediately with SSE progress streaming; optional date_from/date_to override news lookback
router.post('/run-now', async (req, res) => {
  const { company: adHocCompany, date_from, date_to } = req.body;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (msg) => res.write(`data: ${JSON.stringify({ message: msg })}\n\n`);

  try {
    const base     = getSettingsInternal(req.workspaceId);
    const settings = {
      ...base,
      ...(date_from && { search_from: date_from }),
      ...(date_to   && { search_to:   date_to   }),
    };

    // ad-hoc uses the passed company; otherwise use settings.companies[]
    const companies = adHocCompany
      ? [adHocCompany.trim()]
      : (base.companies?.filter(Boolean).length > 0
          ? base.companies.filter(Boolean)
          : (base.company_name ? [base.company_name] : []));

    if (companies.length === 0) {
      res.write(`data: ${JSON.stringify({ error: 'No company configured. Add one in Settings → Company tab.' })}\n\n`);
      res.end();
      return;
    }

    if (date_from && date_to) {
      const days = Math.round((new Date(date_to) - new Date(date_from)) / 86400000);
      if (days > 90) {
        res.write(`data: ${JSON.stringify({ error: `Date range is ${days} days — max is 90 days. Please narrow your selection.` })}\n\n`);
        res.end();
        return;
      }
      send(`Searching news from ${date_from} to ${date_to} (${days} days)…`);
    }

    if (companies.length === 1) {
      // single company — streaming flow
      const { id, digest } = await runDigest(companies[0], settings, send, req.workspaceId);
      if (date_from) digest.search_from = date_from;
      if (date_to)   digest.search_to   = date_to;

      const deliveryResults = {};
      if (settings.email)         { send('Sending email…');    deliveryResults.email    = await sendDigestEmail(digest, settings.email); }
      if (settings.whatsapp)      { send('Sending WhatsApp…'); deliveryResults.whatsapp = await sendWhatsAppDigest([digest], settings.whatsapp); }
      if (settings.slack_webhook) { send('Sending Slack…');    deliveryResults.slack    = await sendSlackDigest(digest, settings.slack_webhook); }

      res.write(`data: ${JSON.stringify({ done: true, id, digest, delivery: deliveryResults })}\n\n`);
    } else {
      // multi-company — run all, then one combined email
      send(`Running digest for ${companies.length} companies: ${companies.join(', ')}…`);
      const runs = await Promise.all(companies.map(async c => {
        send(`Generating digest for ${c}…`);
        return runDigest(c, settings, null, req.workspaceId);
      }));
      const digests = runs.map(r => r.digest);

      const deliveryResults = {};
      if (settings.email) {
        send('Sending combined email…');
        deliveryResults.email = await sendMultiCompanyDigestEmail(digests, settings.email);
      }
      if (settings.whatsapp) {
        send('Sending WhatsApp…');
        deliveryResults.whatsapp = await sendWhatsAppDigest(digests, settings.whatsapp);
      }
      if (settings.slack_webhook) {
        send('Sending Slack…');
        for (const d of digests) await sendSlackDigest(d, settings.slack_webhook);
        deliveryResults.slack = { ok: true };
      }

      res.write(`data: ${JSON.stringify({ done: true, digests, delivery: deliveryResults })}\n\n`);
    }
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
  } finally {
    res.end();
  }
});

// ─── Schedule ─────────────────────────────────────────────────────────────────

// activate/update the cron schedule for all workspaces
router.post('/schedule', (_req, res) => {
  try {
    scheduleDigest();
    res.json({ ok: true, message: 'Schedule updated', status: getScheduleStatus(_req.workspaceId) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to schedule' });
  }
});

// stop all active schedules
router.delete('/schedule', (_req, res) => {
  try {
    stopSchedule();
    res.json({ ok: true, message: 'Schedule stopped' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to stop schedule' });
  }
});

// get current scheduler state + next fire time for this workspace
router.get('/schedule/status', (req, res) => {
  try {
    res.json(getScheduleStatus(req.workspaceId));
  } catch (err) {
    res.status(500).json({ error: 'Failed to get schedule status' });
  }
});

// get delivery log history for this workspace
router.get('/schedule/history', (req, res) => {
  try {
    res.json(getDeliveryHistory(30, req.workspaceId));
  } catch (err) {
    res.status(500).json({ error: 'Failed to get delivery history' });
  }
});

// discover C-level executives for the workspace company — Serper + LLM; saves to settings
router.post('/discover-executives', async (req, res) => {
  try {
    const settings = getSettingsInternal(req.workspaceId);
    const company  = settings.company_name;
    if (!company) return res.status(400).json({ error: 'No company name set in settings' });

    const executives = await discoverExecutives(company, settings);

    // merge new names into existing executive_names (deduplicated)
    const existing = (settings.executive_names || []);
    const newNames  = executives.map(e => e.name);
    const merged    = [...new Set([...existing, ...newNames])];

    saveSettings({
      discovered_executives:       executives,
      executives_last_refreshed:   new Date().toISOString(),
      executive_names:             merged,
    }, req.workspaceId);

    res.json({ executives, executive_names: merged });
  } catch (err) {
    console.error('Executive discovery error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// send a test WhatsApp message to verify the number is reachable; marks it verified on success
router.post('/settings/test-whatsapp', async (req, res) => {
  try {
    const { whatsapp_number } = req.body;
    if (!whatsapp_number) return res.status(400).json({ ok: false, error: 'whatsapp_number is required' });
    const result = await sendWhatsAppTest(whatsapp_number);
    if (result.ok) {
      saveSettings({ whatsapp_verified: 1 }, req.workspaceId);
    }
    res.json(result);
  } catch (err) {
    console.error('WhatsApp test error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
