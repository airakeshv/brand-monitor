import cron from 'node-cron';
import { fromZonedTime } from 'date-fns-tz';
import { getSettings, saveSettings } from '../models/user.js';
import { runDigest } from '../services/digestService.js';
import { sendDigestEmail } from '../services/emailService.js';
import { sendWhatsAppDigest } from '../services/whatsappService.js';
import { sendSlackDigest } from '../services/slackService.js';

let activeTask = null;

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
  if (frequency === 'weekdays') return `${m} ${h} * * 1-5`;   // Mon–Fri
  if (frequency === 'weekly')   return `${m} ${h} * * 1`;      // every Monday
  if (frequency === 'monthly')  return `${m} ${h} 1 * *`;      // 1st of each month
  return `${m} ${h} * * *`;                                    // daily (default)
}

// run digest and deliver to all enabled channels, respecting pause window
async function deliverDigest(settings) {
  try {
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

    const { digest } = await runDigest(company, settings);

    if (settings.email)         await sendDigestEmail(digest, settings.email);
    if (settings.whatsapp)      await sendWhatsAppDigest(digest, settings.whatsapp);
    if (settings.slack_webhook) await sendSlackDigest(digest, settings.slack_webhook);
  } catch (err) {
    console.error('Scheduled digest failed:', err.message);
  }
}

// start the cron schedule based on current settings
export function scheduleDigest() {
  if (activeTask) {
    activeTask.stop();
    activeTask = null;
  }

  const settings  = getSettings();
  if (!settings.company_name || !settings.delivery_time) return;

  const timezone  = settings.timezone  || 'Asia/Kolkata';
  const frequency = settings.frequency || 'daily';
  const cronExpr  = toCronExpression(settings.delivery_time, timezone, frequency);

  activeTask = cron.schedule(cronExpr, () => deliverDigest(getSettings()), { timezone: 'UTC' });
  console.log(`Digest scheduled: ${frequency} at ${settings.delivery_time} ${timezone} → cron: ${cronExpr}`);
}

// stop the active schedule
export function stopSchedule() {
  if (activeTask) {
    activeTask.stop();
    activeTask = null;
  }
}
