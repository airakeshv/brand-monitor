import { Router } from 'express';
import { searchAll } from '../services/searchService.js';
import { applyNoiseFilter } from '../services/noiseFilter.js';
import { runDigest } from '../services/digestService.js';
import { sendDigestEmail } from '../services/emailService.js';
import { sendWhatsAppDigest } from '../services/whatsappService.js';
import { sendSlackDigest } from '../services/slackService.js';
import { getSettings, getSettingsInternal, saveSettings } from '../models/user.js';
import { getHistory, getDigestById } from '../models/digest.js';
import { scheduleDigest, stopSchedule } from '../scheduler/cronManager.js';

const router = Router();

router.get('/ping', (_req, res) => res.json({ message: 'API ready' }));

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

// update settings (PUT or POST — both accepted)
function handleSaveSettings(req, res) {
  try {
    saveSettings(req.body);
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
router.post('/run-now', async (req, res) => {
  const { company, date_from, date_to } = req.body;
  if (!company) return res.status(400).json({ error: 'company is required' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (msg) => res.write(`data: ${JSON.stringify({ message: msg })}\n\n`);

  try {
    const base = getSettingsInternal();
    const settings = {
      ...base,
      ...(date_from && { search_from: date_from }),
      ...(date_to   && { search_to:   date_to   }),
    };
    if (date_from && date_to) {
      const days = Math.round((new Date(date_to) - new Date(date_from)) / 86400000);
      if (days > 90) {
        res.write(`data: ${JSON.stringify({ error: `Date range is ${days} days — max is 90 days for reliable results. Please narrow your selection.` })}\n\n`);
        res.end();
        return;
      }
      send(`Searching news from ${date_from} to ${date_to} (${days} days)…`);
    }
    const { id, digest } = await runDigest(company, settings, send);

    // attach date range to digest so email template can show coverage period
    if (date_from) digest.search_from = date_from;
    if (date_to)   digest.search_to   = date_to;

    const deliveryResults = {};
    if (settings.email) {
      send('Sending email…');
      deliveryResults.email = await sendDigestEmail(digest, settings.email);
    }
    if (settings.whatsapp) {
      send('Sending WhatsApp…');
      deliveryResults.whatsapp = await sendWhatsAppDigest(digest, settings.whatsapp);
    }
    if (settings.slack_webhook) {
      send('Sending Slack…');
      deliveryResults.slack = await sendSlackDigest(digest, settings.slack_webhook);
    }

    res.write(`data: ${JSON.stringify({ done: true, id, digest, delivery: deliveryResults })}\n\n`);
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
    res.json({ ok: true, message: 'Schedule updated' });
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

export default router;
