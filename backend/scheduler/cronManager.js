import cron from 'node-cron';
import { CronExpressionParser } from 'cron-parser';
import { fromZonedTime } from 'date-fns-tz';
import { getDB, getSettingsInternal, saveSettings } from '../models/user.js';
import { runDigest } from '../services/digestService.js';
import { discoverExecutives } from '../services/executiveDiscoveryService.js';
import { sendMultiCompanyDigestEmail } from '../services/emailService.js';
import { sendWhatsAppDigest } from '../services/whatsappService.js';
import { sendSlackDigest } from '../services/slackService.js';
import { logDelivery } from '../models/deliveryLog.js';

// Map of workspaceId → { task: CronJob, cronExpr: string }
// Each workspace gets exactly one active cron job
const activeJobs = new Map();

// returns the YYYY-MM-DD string for the day after a given YYYY-MM-DD
function nextDayStr(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// convert HH:MM + frequency + timezone to a UTC cron expression
function toCronExpression(timeHHMM, timezone, frequency = 'daily') {
  // use a fixed reference date to avoid DST-at-schedule-creation-time issues
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

// run one company's digest — retries once after 5 s on LLM/rate-limit failure, then skips
async function runDigestWithRetry(company, settings, workspaceId, attempt = 1) {
  try {
    return await runDigest(company, settings, null, workspaceId);
  } catch (err) {
    if (attempt < 2) {
      console.log(`Digest failed for "${company}" (attempt ${attempt}): ${err.message} — retrying in 5 s…`);
      await new Promise(r => setTimeout(r, 5000));
      return runDigestWithRetry(company, settings, workspaceId, 2);
    }
    console.error(`Digest failed for "${company}" after 2 attempts — skipping: ${err.message}`);
    return null;
  }
}

// run digest for all companies in a workspace, deliver via all channels, log result
async function deliverDigest(settings, workspaceId) {
  const companyList = (settings.companies || []).filter(Boolean);
  const companies   = companyList.length > 0 ? companyList : (settings.company_name ? [settings.company_name] : []);
  if (companies.length === 0) return;

  const today = new Date().toISOString().slice(0, 10);

  // skip delivery if today is within the pause window
  if (settings.pause_from && settings.pause_to
      && today >= settings.pause_from && today <= settings.pause_to) {
    console.log(`[ws ${workspaceId}] Digest delivery paused — resumes after ${settings.pause_to}`);
    return;
  }

  // first day after pause ends: clear the pause window from DB
  if (settings.pause_from && settings.pause_to && today === nextDayStr(settings.pause_to)) {
    saveSettings({ pause_from: null, pause_to: null }, workspaceId);
    console.log(`[ws ${workspaceId}] Pause window cleared — resuming digest delivery`);
  }

  // run companies sequentially with 3 s gap — prevents Gemini free-tier rate-limit (60 req/min)
  if (companies.length > 1) console.log(`[ws ${workspaceId}] Processing ${companies.length} companies sequentially (3 s gap)…`);
  const runs = [];
  for (let i = 0; i < companies.length; i++) {
    const result = await runDigestWithRetry(companies[i], settings, workspaceId);
    if (result) runs.push(result);
    if (i < companies.length - 1) await new Promise(r => setTimeout(r, 3000));
  }
  if (runs.length === 0) return;
  const digests = runs.map(r => r.digest);

  const results = { email_ok: null, whatsapp_ok: null, slack_ok: null };

  if (settings.email) {
    const r = await sendMultiCompanyDigestEmail(digests, settings.email);
    results.email_ok = r.ok ? 1 : 0;
  }
  if (settings.whatsapp) {
    const r = await sendWhatsAppDigest(digests, settings.whatsapp);
    results.whatsapp_ok = r.ok ? 1 : 0;
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

  logDelivery({
    company:      companies[0],
    trigger:      'scheduled',
    status,
    digest_id:    runs[0]?.id,
    workspace_id: workspaceId,
    ...results,
  });
  return digests;
}

// attempt delivery for a specific workspace — retries once after 5 minutes on failure
async function deliverWithRetry(workspaceId, attempt = 1) {
  const settings = getSettingsInternal(workspaceId);
  try {
    await deliverDigest(settings, workspaceId);
  } catch (err) {
    console.error(`Scheduled digest failed [ws ${workspaceId}] (attempt ${attempt}): ${err.message}`);
    if (attempt < 2) {
      console.log('Retrying in 5 minutes…');
      setTimeout(() => deliverWithRetry(workspaceId, 2), 5 * 60 * 1000);
    } else {
      logDelivery({
        company:      settings.company_name || 'unknown',
        trigger:      'scheduled',
        status:       'failed',
        error:        err.message,
        workspace_id: workspaceId,
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

// schedule one workspace's digest — cancels any existing job for that workspaceId first
function scheduleWorkspace(workspaceId, settings) {
  // cancel existing job to prevent duplicates
  if (activeJobs.has(workspaceId)) {
    activeJobs.get(workspaceId).task.stop();
    activeJobs.delete(workspaceId);
  }

  if (!settings.company_name || !settings.delivery_time) return;

  const timezone  = settings.timezone  || 'Asia/Kolkata';
  const frequency = settings.frequency || 'daily';
  const cronExpr  = toCronExpression(settings.delivery_time, timezone, frequency);

  // stagger each workspace by (wsId-1 mod 5) × 2 min — prevents all workspaces hitting Serper simultaneously
  const staggerMs = ((workspaceId - 1) % 5) * 2 * 60 * 1000; // ws1=0min, ws2=2min, ws3=4min, ws4=6min, ws5=8min
  const task = cron.schedule(cronExpr, async () => {
    if (staggerMs > 0) await new Promise(r => setTimeout(r, staggerMs));
    deliverWithRetry(workspaceId);
  }, { timezone: 'UTC' });
  activeJobs.set(workspaceId, { task, cronExpr });
  console.log(`Digest scheduled [ws ${workspaceId}]: ${frequency} at ${settings.delivery_time} ${timezone} → cron: ${cronExpr}`);
}

// start (or restart) the full schedule — clears ALL jobs then reloads every workspace from DB
export function scheduleDigest() {
  stopAllJobs();
  const db = getDB();
  // load every settings row that has both a company and a delivery time configured
  const rows = db.prepare(
    'SELECT * FROM settings WHERE delivery_time IS NOT NULL AND company_name IS NOT NULL AND workspace_id IS NOT NULL'
  ).all();
  rows.forEach(row => scheduleWorkspace(row.workspace_id, row));
}

// cancel and immediately reschedule ONE workspace — called after every settings save
export function rescheduleWorkspace(workspaceId, settings) {
  scheduleWorkspace(workspaceId, settings);
  const job = activeJobs.get(workspaceId);
  if (job) {
    console.log(`Rescheduled [ws ${workspaceId}] for ${settings.company_name} at ${settings.delivery_time} ${settings.timezone || 'Asia/Kolkata'}`);
  }
}

// stop all active schedules
export function stopSchedule() {
  stopAllJobs();
}

// run executive discovery for all workspaces — called weekly + on first company setup
async function runExecutiveDiscoveryForAll() {
  const db   = getDB();
  const rows = db.prepare('SELECT workspace_id FROM settings WHERE company_name IS NOT NULL').all();
  for (const row of rows) {
    try {
      const settings   = getSettingsInternal(row.workspace_id);
      if (!settings.company_name) continue;
      const executives = await discoverExecutives(settings.company_name, settings);
      if (executives.length === 0) continue;
      const existing   = settings.executive_names || [];
      const newNames   = executives.map(e => e.name);
      const merged     = [...new Set([...existing, ...newNames])];
      saveSettings({
        discovered_executives:     executives,
        executives_last_refreshed: new Date().toISOString(),
        executive_names:           merged,
      }, row.workspace_id);
      console.log(`[exec-discovery] ws ${row.workspace_id}: found ${executives.length} executives`);
    } catch (err) {
      console.error(`[exec-discovery] failed for ws ${row.workspace_id}:`, err.message);
    }
  }
}

// weekly executive refresh — every Monday at 2:00 AM UTC
let execWeeklyJob = null;
export function startExecutiveDiscovery() {
  if (execWeeklyJob) execWeeklyJob.stop();
  execWeeklyJob = cron.schedule('0 2 * * 1', runExecutiveDiscoveryForAll, { timezone: 'UTC' });
  console.log('[exec-discovery] Weekly refresh scheduled — Mondays 02:00 UTC');
}

// return current scheduler state for a specific workspace
export function getScheduleStatus(workspaceId) {
  const job = workspaceId ? activeJobs.get(workspaceId) : null;
  if (!job) return { active: false };

  const settings = getSettingsInternal(workspaceId);
  return {
    active:        true,
    cron:          job.cronExpr,
    delivery_time: settings.delivery_time,
    timezone:      settings.timezone || 'Asia/Kolkata',
    frequency:     settings.frequency || 'daily',
    next_run:      nextRunISO(job.cronExpr),
  };
}
