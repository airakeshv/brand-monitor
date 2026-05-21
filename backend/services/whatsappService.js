import twilio from 'twilio';

// build condensed 5-8 line WhatsApp digest
function buildWhatsAppText(digest) {
  const lines = [
    `*BrandMonitor — ${digest.company}*`,
    `_${digest.timezone_label || digest.date} · ${digest.model_used}_`,
    '',
  ];

  if (digest.crisis_flag?.triggered) {
    lines.push(`🚨 *CRISIS ALERT:* ${digest.crisis_flag.reason}`);
    lines.push('');
  }

  const topNews = (digest.news || []).slice(0, 3);
  if (topNews.length) {
    lines.push('*📰 Top News*');
    topNews.forEach(n => lines.push(`• ${n.title} (${n.sentiment})`));
    lines.push('');
  }

  const badReviews = (digest.reviews || []).filter(r => r.urgency === 'CRITICAL' || r.urgency === 'HIGH');
  if (badReviews.length) {
    lines.push('*⭐ Review Alerts*');
    badReviews.slice(0, 2).forEach(r => lines.push(`• [${r.urgency}] ${r.platform} — "${r.excerpt?.slice(0, 80)}"`));
    lines.push('');
  }

  if (digest.keywords?.length) {
    lines.push(`*🔑 Keywords:* ${digest.keywords.slice(0, 5).join(', ')}`);
  }

  if (digest.watch_out) {
    lines.push(`*👀 Watch Out:* ${digest.watch_out}`);
  }

  return lines.join('\n');
}

// send condensed digest via Twilio WhatsApp
export async function sendWhatsAppDigest(digest, toNumber) {
  try {
    const sid   = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from  = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';

    if (!sid || sid === 'add_later' || !token || token === 'add_later') {
      return { ok: false, error: 'Twilio credentials not configured' };
    }

    const client = twilio(sid, token);
    const body   = buildWhatsAppText(digest);
    const to     = toNumber.startsWith('whatsapp:') ? toNumber : `whatsapp:${toNumber}`;

    const msg = await client.messages.create({ from, to, body });
    return { ok: true, sid: msg.sid };
  } catch (err) {
    console.error('WhatsApp send failed:', err.message);
    return { ok: false, error: err.message };
  }
}
