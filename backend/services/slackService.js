import axios from 'axios';

// build Slack Block Kit payload from DigestSchema
function buildSlackPayload(digest) {
  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `BrandMonitor — ${digest.company}` },
    },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `${digest.timezone_label || digest.date} · Model: ${digest.model_used}` }],
    },
    { type: 'divider' },
  ];

  if (digest.crisis_flag?.triggered) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `🚨 *CRISIS ALERT:* ${digest.crisis_flag.reason}` },
    });
  }

  const topNews = (digest.news || []).slice(0, 3);
  if (topNews.length) {
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: '*📰 Top News*' } });
    topNews.forEach(n => {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `• <${n.url}|${n.title}> _(${n.sentiment})_` },
      });
    });
    blocks.push({ type: 'divider' });
  }

  const badReviews = (digest.reviews || []).filter(r => r.urgency === 'CRITICAL' || r.urgency === 'HIGH');
  if (badReviews.length) {
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: '*⭐ Review Alerts*' } });
    badReviews.slice(0, 2).forEach(r => {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `• [${r.urgency}] *${r.platform}* — "${r.excerpt?.slice(0, 80)}"` },
      });
    });
  }

  if (digest.keywords?.length) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*🔑 Keywords:* ${digest.keywords.slice(0, 5).join(' · ')}` },
    });
  }

  if (digest.watch_out) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*👀 Watch Out:* ${digest.watch_out}` },
    });
  }

  return { blocks };
}

// post digest to Slack via incoming webhook
export async function sendSlackDigest(digest, webhookUrl) {
  try {
    if (!webhookUrl || webhookUrl === 'add_later') {
      return { ok: false, error: 'Slack webhook not configured' };
    }
    const payload = buildSlackPayload(digest);
    await axios.post(webhookUrl, payload);
    return { ok: true };
  } catch (err) {
    console.error('Slack send failed:', err.message);
    return { ok: false, error: err.message };
  }
}
