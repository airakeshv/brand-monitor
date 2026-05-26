import cron from 'node-cron';
import { CronExpressionParser } from 'cron-parser';
import { fromZonedTime } from 'date-fns-tz';
import { getDB, getSettings, getSettingsInternal, saveSettings } from '../models/user.js';
import { runDigest } from '../services/digestService.js';
import { sendDigestEmail, sendMultiCompanyDigestEmail } from '../services/emailService.js';
import { sendWhatsAppDigest } from '../services/whatsappService.js';
import { sendSlackDigest } from '../services/slackService.js';
import { logDelivery } from '../models/deliveryLog.js';

// Map of userId → { task: CronJob, cronExpr: string }
// Using a Map prevents duplicate schedules — each userId can have exactly one active job
const activeJobs = new Map();

// returns the YYYY-MM-DD string for the day after a given YYYY-MM-DD
function nextDayStr(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// convert HH:MM + frequency + timezone to a UTC cron expression
function toCronExpression(timeHHMM, timezone, frequency = 'daily') {
  // use a fixed reference date (Jan 1 = standard time in most zones) to avoid
  // DST-at-schedule-creation-time issues; { timezone: 'UTC' } on the job handles runtime
  const utc = fromZonedTime(`2000-01-01T${timeHHMM}:00`, timezone);
  const m = utc.getUTCMinutes();
  const h = utc.getUTCHours();
  if (frequency === 'weekdays') return `${m} ${h} * * 1-5`;
  if (frequency === 'weekly')   return `${m} ${h} * * 1`;
  if (frequency === 'monthly')  return `${m} ${h} 1 * *`;
  return `${m} ${h} * * *`;
}

// compute ISO string for when this cron expression will next fire (UTC)
function nextRunISO(cronExpr) {
  try {
    const interval = CronExpressionParser.parse(cronExpr, { tz: 'UTC' });
    return new Date(interval.next().getTime()).toISOString();
  } catch { return null; }
}

// run digest for all configured companies, deliver via all channels, log result
async function deliverDigest(settings) {
  // build the companies list — prefer companies[] array, fall back to legacy company_name
  const companyList = (settings.companies || []).filter(Boolean);
  const companies   = companyList.length > 0 ? companyList : (settings.company_name ? [settings.company_name] : []);
  if (companies.length === 0) return;

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
    console.log(`Pause window cleared — resuming digest delivery`);
  }

  // run all companies in parallel
  const runs    = await Promise.all(companies.map(c => runDigest(c, settings)));
  const digests = runs.map(r => r.digest);

  const results = { email_ok: null, whatsapp_ok: null, slack_ok: null };

  if (settings.email) {
    // single combined email for all companies
    const r = await sendMultiCompanyDigestEmail(digests, settings.email);
    results.email_ok = r.ok ? 1 : 0;
  }
  if (settings.whatsapp) {
    // WhatsApp has char limits — one message per company
    let ok = true;
    for (const digest of digests) {
      const r = await sendWhatsAppDigest(digest, settings.whatsapp);
      if (!r.ok) ok = false;
    }
    results.whatsapp_ok = ok ? 1 : 0;
  }
  if (settings.slack_webhook) {
    let ok = true;
    for (const digest of digests) {
      const r = await sendSlackDigest(digest, settings.slack_webhook);
      if (!r.ok) ok = false;
    }
    results.slack_ok = ok ? 1 : 0;
  }

  const anyConfigured = settings.email || settings.whatsapp || settings.slack_webhook;
  const allOk = [results.email_ok, results.whatsapp_ok, results.slack_ok]
    .filter(v => v !== null).every(v => v === 1);
  const status = !anyConfigured ? 'success' : allOk ? 'success' : 'partial';

  logDelivery({ company: companies[0], trigger: 'scheduled', status, digest_id: runs[0]?.id, ...results });
  return digests;
}

// attempt delivery for a specific user — retries once after 5 minutes on failure
async function deliverWithRetry(userId, attempt = 1) {
  const settings = getSettingsInternal();
  try {
    await deliverDigest(settings);
  } catch (err) {
    console.error(`Scheduled digest failed [user ${userId}] (attempt ${attempt}): ${err.message}`);
    if (attempt < 2) {
      console.log('Retrying in 5 minutes…');
      setTimeout(() => deliverWithRetry(userId, 2), 5 * 60 * 1000);
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

// cancel and remove all active cron jobs — called before any full reschedule
function stopAllJobs() {
  for (const { task } of activeJobs.values()) {
    task.stop();
  }
  activeJobs.clear();
}

// schedule one user's digest — cancels any existing job for that userId first
function scheduleUser(userId, settings) {
  // cancel existing job for this userId to prevent duplicates
  if (activeJobs.has(userId)) {
    activeJobs.get(userId).task.stop();
    activeJobs.delete(userId);
  }

  if (!settings.company_name || !settings.delivery_time) return;

  const timezone  = settings.timezone  || 'Asia/Kolkata';
  const frequency = settings.frequency || 'daily';
  const cronExpr  = toCronExpression(settings.delivery_time, timezone, frequency);

  // always pass { timezone: 'UTC' } so Railway server local time never affects firing
  const task = cron.schedule(cronExpr, () => deliverWithRetry(userId), { timezone: 'UTC' });
  activeJobs.set(userId, { task, cronExpr });
  console.log(`Digest scheduled [user ${userId}]: ${frequency} at ${settings.delivery_time} ${timezone} → cron: ${cronExpr}`);
}

// start (or restart) the full schedule — clears ALL existing jobs then reloads every user from DB
export function scheduleDigest() {
  stopAllJobs();
  const db = getDB();
  // load every settings row that has both a company and a delivery time configured
  const rows = db.prepare(
    'SELECT * FROM settings WHERE delivery_time IS NOT NULL AND company_name IS NOT NULL'
  ).all();
  rows.forEach(u => scheduleUser(u.user_id ?? u.id, u));
}

// cancel and immediately reschedule ONE user — called after every settings save so
// new/updated users get scheduled instantly without disrupting everyone else's jobs
export function rescheduleUser(userId, settings) {
  scheduleUser(userId, settings);
  const job = activeJobs.get(userId);
  if (job) {
    console.log(`Rescheduled [user ${userId}] for ${settings.company_name} at ${settings.delivery_time} ${settings.timezone || 'Asia/Kolkata'}`);
  }
}

// stop all active schedules
export function stopSchedule() {
  stopAllJobs();
}

// return current scheduler state for the status API
export function getScheduleStatus() {
  if (activeJobs.size === 0) return { active: false };

  const settings = getSettings();
  const job      = activeJobs.get(1); // single-user for now; extended in Task 3.7
  if (!job) return { active: false };

  return {
    active:        true,
    cron:          job.cronExpr,
    delivery_time: settings.delivery_time,
    timezone:      settings.timezone || 'Asia/Kolkata',
    frequency:     settings.frequency || 'daily',
    next_run:      nextRunISO(job.cronExpr),
  };
}
