import cron from 'node-cron';
import { CronExpressionParser } from 'cron-parser';
import { fromZonedTime } from 'date-fns-tz';
import { getSettings, saveSettings } from '../models/user.js';
import { runDigest } from '../services/digestService.js';
import { sendDigestEmail } from '../services/emailService.js';
import { sendWhatsAppDigest } from '../services/whatsappService.js';
import { sendSlackDigest } from '../services/slackService.js';
import { logDelivery } from '../models/deliveryLog.js';

let activeTask  = null;
let activeCron  = null;  // current cron expression string, for status reporting

// returns the YYYY-MM-DD string for the day after a given YYYY-MM-DD
function nextDayStr(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// convert HH:MM + frequency + timezone to a UTC cron expression
function toCronExpression(timeHHMM, timezone, frequency = 'daily') {
  const [hours, minutes] = timeHHMM.split(':').map(Number);
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const localStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(hours)}:${pad(minutes)}:00`;
  const utc = fromZonedTime(localStr, timezone);
  const m = utc.getUTCMinutes();
  const h = utc.getUTCHours();
  if (frequency === 'weekdays') return `${m} ${h} * * 1-5`;
  if (frequency === 'weekly')   return `${m} ${h} * * 1`;
  if (frequency === 'monthly')  return `${m} ${h} 1 * *`;
  return `${m} ${h} * * *`;
}

// compute ISO string for when this cron expression will next fire (UTC)
// the cron expression is always in UTC, so parse with tz:'UTC'
function nextRunISO(cronExpr) {
  try {
    const interval = CronExpressionParser.parse(cronExpr, { tz: 'UTC' });
    return new Date(interval.next().getTime()).toISOString();
  } catch { return null; }
}

// run digest and deliver to all enabled channels, log result, respecting pause window
async function deliverDigest(settings) {
  const company = settings.company_name;
  if (!company) return;

  const today = new Date().toISOString().slice(0, 10);

  // skip delivery if today is within the pause window
  if (settings.pause_from && settings.pause_to
      && today >= settings.pause_from && today <= settings.pause_to) {
    console.log(`Digest delivery paused — resumes after ${settings.pause_to}`);
    return;
  }

  // first day after pause ends: clear the pause window from DB
  if (settings.pause_from && settings.pause_to && today === nextDayStr(settings.pause_to)) {
    saveSettings({ pause_from: null, pause_to: null });
    console.log(`Pause window cleared — resuming digest delivery for ${company}`);
  }

  const { id: digest_id, digest } = await runDigest(company, settings);

  const results = { email_ok: null, whatsapp_ok: null, slack_ok: null };

  if (settings.email) {
    const r = await sendDigestEmail(digest, settings.email);
    results.email_ok = r.ok ? 1 : 0;
  }
  if (settings.whatsapp) {
    const r = await sendWhatsAppDigest(digest, settings.whatsapp);
    results.whatsapp_ok = r.ok ? 1 : 0;
  }
  if (settings.slack_webhook) {
    const r = await sendSlackDigest(digest, settings.slack_webhook);
    results.slack_ok = r.ok ? 1 : 0;
  }

  const anyConfigured = settings.email || settings.whatsapp || settings.slack_webhook;
  const allOk = [results.email_ok, results.whatsapp_ok, results.slack_ok]
    .filter(v => v !== null)
    .every(v => v === 1);
  const status = !anyConfigured ? 'success' : allOk ? 'success' : 'partial';

  logDelivery({ company, trigger: 'scheduled', status, digest_id, ...results });
  return digest;
}

// attempt delivery with one automatic retry after 5 minutes on failure
async function deliverWithRetry(attempt = 1) {
  const settings = getSettings();
  try {
    await deliverDigest({ ...settings, llm_api_key: settings.llm_api_key });
  } catch (err) {
    console.error(`Scheduled digest failed (attempt ${attempt}): ${err.message}`);
    if (attempt < 2) {
      console.log('Retrying in 5 minutes…');
      setTimeout(() => deliverWithRetry(2), 5 * 60 * 1000);
    } else {
      logDelivery({
        company: settings.company_name || 'unknown',
        trigger: 'scheduled',
        status:  'failed',
        error:   err.message,
      });
    }
  }
}

// start the cron schedule based on current settings
export function scheduleDigest() {
  if (activeTask) {
    activeTask.stop();
    activeTask = null;
    activeCron = null;
  }

  const settings  = getSettings();
  if (!settings.company_name || !settings.delivery_time) return;

  const timezone  = settings.timezone  || 'Asia/Kolkata';
  const frequency = settings.frequency || 'daily';
  const cronExpr  = toCronExpression(settings.delivery_time, timezone, frequency);

  activeTask = cron.schedule(cronExpr, () => deliverWithRetry(), { timezone: 'UTC' });
  activeCron = cronExpr;
  console.log(`Digest scheduled: ${frequency} at ${settings.delivery_time} ${timezone} → cron: ${cronExpr}`);
}

// stop the active schedule
export function stopSchedule() {
  if (activeTask) {
    activeTask.stop();
    activeTask = null;
    activeCron = null;
  }
}

// return current scheduler state for the status API
export function getScheduleStatus() {
  if (!activeTask || !activeCron) return { active: false };
  const settings = getSettings();
  return {
    active:           true,
    cron:             activeCron,
    delivery_time:    settings.delivery_time,
    timezone:         settings.timezone || 'Asia/Kolkata',
    frequency:        settings.frequency || 'daily',
    next_run:         nextRunISO(activeCron),
  };
}
