import { Router } from 'express';
import { searchAll } from '../services/searchService.js';
import { applyNoiseFilter } from '../services/noiseFilter.js';
import { runDigest } from '../services/digestService.js';
import { sendDigestEmail, sendMultiCompanyDigestEmail } from '../services/emailService.js';
import { sendWhatsAppDigest } from '../services/whatsappService.js';
import { sendSlackDigest } from '../services/slackService.js';
import { getDB, getSettings, getSettingsInternal, saveSettings } from '../models/user.js';
import { getHistory, getDigestById } from '../models/digest.js';
import { scheduleDigest, rescheduleUser, stopSchedule, getScheduleStatus } from '../scheduler/cronManager.js';
import { getDeliveryHistory } from '../models/deliveryLog.js';
import { generateMagicToken, hashToken, signJWT, sendMagicLinkEmail } from '../services/authService.js';

const router = Router();

router.get('/ping', (_req, res) => res.json({ message: 'API ready' }));

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

    if (!row)                                 return res.status(401).json({ error: 'Invalid or already used link' });
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

// search all sources for a company name
router.post('/search', async (req, res) => {
  try {
    const { company } = req.body;
    if (!company) return res.status(400).json({ error: 'company is required' });

    const settings = getSettingsInternal();
    const raw = await searchAll(company, settings);
    const filtered = applyNoiseFilter(raw, settings);

    res.json({ company, count: filtered.length, results: filtered });
  } catch (err) {
    console.error('Search error:', err.message);
    res.status(500).json({ error: 'Search failed' });
  }
});

// generate a digest for a company using the chosen model
router.post('/digest', async (req, res) => {
  try {
    const { company, model, apiKey } = req.body;
    if (!company) return res.status(400).json({ error: 'company is required' });

    const settings = { ...getSettingsInternal(), ...(model && { llm_model: model }), ...(apiKey && { llm_api_key: apiKey }) };
    const { id, digest } = await runDigest(company, settings);

    res.json({ id, digest });
  } catch (err) {
    console.error('Digest error:', err.message);
    res.status(500).json({ error: err.message || 'Digest generation failed' });
  }
});

// get settings
router.get('/settings', (_req, res) => {
  try {
    res.json(getSettings());
  } catch (err) {
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

// update settings (PUT or POST — both accepted) then reschedule only this user's cron
function handleSaveSettings(req, res) {
  try {
    // plan limit: free = 1 company max, pro = 5 companies max
    if (Array.isArray(req.body.companies)) {
      const current      = getSettings();
      const plan         = current.plan || 'pro';
      const maxCompanies = plan === 'pro' ? 5 : 1;
      const active       = req.body.companies.filter(Boolean);
      if (active.length > maxCompanies) {
        return res.status(403).json({ error: 'Upgrade to Pro to track more than 1 company' });
      }
    }
    saveSettings(req.body);
    // use getSettingsInternal so the scheduler gets decrypted/parsed settings
    const settings = getSettingsInternal();
    rescheduleUser(req.userId, settings);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save settings' });
  }
}
router.put('/settings',  handleSaveSettings);
router.post('/settings', handleSaveSettings);

// get digest history
router.get('/history', (_req, res) => {
  try {
    res.json(getHistory(30));
  } catch (err) {
    res.status(500).json({ error: 'Failed to load history' });
  }
});

// get a single digest by id
router.get('/history/:id', (req, res) => {
  try {
    const row = getDigestById(Number(req.params.id));
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load digest' });
  }
});

// run digest immediately with SSE progress streaming; optional date_from/date_to override news lookback
// ad-hoc (dashboard): pass { company } for a single run; omit to run all settings.companies[]
router.post('/run-now', async (req, res) => {
  const { company: adHocCompany, date_from, date_to } = req.body;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (msg) => res.write(`data: ${JSON.stringify({ message: msg })}\n\n`);

  try {
    const base     = getSettingsInternal();
    const settings = {
      ...base,
      ...(date_from && { search_from: date_from }),
      ...(date_to   && { search_to:   date_to   }),
    };

    // ad-hoc uses the passed company; settings test uses settings.companies[]
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
        res.write(`data: ${JSON.stringify({ error: `Date range is ${days} days — max is 90 days for reliable results. Please narrow your selection.` })}\n\n`);
        res.end();
        return;
      }
      send(`Searching news from ${date_from} to ${date_to} (${days} days)…`);
    }

    if (companies.length === 1) {
      // single company — existing streaming flow
      const { id, digest } = await runDigest(companies[0], settings, send);
      if (date_from) digest.search_from = date_from;
      if (date_to)   digest.search_to   = date_to;

      const deliveryResults = {};
      if (settings.email)         { send('Sending email…');    deliveryResults.email    = await sendDigestEmail(digest, settings.email); }
      if (settings.whatsapp)      { send('Sending WhatsApp…'); deliveryResults.whatsapp = await sendWhatsAppDigest(digest, settings.whatsapp); }
      if (settings.slack_webhook) { send('Sending Slack…');    deliveryResults.slack    = await sendSlackDigest(digest, settings.slack_webhook); }

      res.write(`data: ${JSON.stringify({ done: true, id, digest, delivery: deliveryResults })}\n\n`);
    } else {
      // multi-company — run all in parallel then send one combined email
      send(`Running digest for ${companies.length} companies: ${companies.join(', ')}…`);
      const runs = await Promise.all(companies.map(async c => {
        send(`Generating digest for ${c}…`);
        return runDigest(c, settings);
      }));
      const digests = runs.map(r => r.digest);

      const deliveryResults = {};
      if (settings.email) {
        send('Sending combined email…');
        deliveryResults.email = await sendMultiCompanyDigestEmail(digests, settings.email);
      }
      if (settings.whatsapp) {
        send('Sending WhatsApp…');
        for (const d of digests) await sendWhatsAppDigest(d, settings.whatsapp);
        deliveryResults.whatsapp = { ok: true };
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

// activate/update the cron schedule
router.post('/schedule', (_req, res) => {
  try {
    scheduleDigest();
    res.json({ ok: true, message: 'Schedule updated', status: getScheduleStatus() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to schedule' });
  }
});

// stop the cron schedule
router.delete('/schedule', (_req, res) => {
  try {
    stopSchedule();
    res.json({ ok: true, message: 'Schedule stopped' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to stop schedule' });
  }
});

// get current scheduler state + next fire time
router.get('/schedule/status', (_req, res) => {
  try {
    res.json(getScheduleStatus());
  } catch (err) {
    res.status(500).json({ error: 'Failed to get schedule status' });
  }
});

// get delivery log history (last 30 runs)
router.get('/schedule/history', (_req, res) => {
  try {
    res.json(getDeliveryHistory(30));
  } catch (err) {
    res.status(500).json({ error: 'Failed to get delivery history' });
  }
});

export default router;
