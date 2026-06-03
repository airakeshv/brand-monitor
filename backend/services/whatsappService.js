import twilio from 'twilio';

// format date to "26 May 2026" — handles both "YYYY-MM-DD" and full ISO timestamps
function fmtDate(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso.includes('T') ? iso : iso + 'T12:00:00Z');
    if (isNaN(d.getTime())) return iso;
    const M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${d.getUTCDate()} ${M[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  } catch { return iso; }
}

// build the compact 7-line WhatsApp message for one company digest
// format: header | top news | crisis | review alert | executive | keywords | footer
function buildCompactMessage(digest) {
  const company = (digest.company || '').toUpperCase();
  const date    = fmtDate(digest.date);

  // line 2: top news
  const topNews  = digest.news?.[0];
  const newsLine = topNews
    ? `📰 Top: ${(topNews.title || '').slice(0, 65)}${(topNews.title || '').length > 65 ? '…' : ''} (${topNews.source || ''})`
    : '📰 Top: No news today';

  // line 3: crisis
  const crisisLine = digest.crisis_flag?.triggered
    ? `⚠️ Crisis: ${(digest.crisis_flag.reason || 'ALERT').slice(0, 70)}`
    : '⚠️ Crisis: None';

  // line 4: review alert
  const highReviews = (digest.reviews || []).filter(r =>
    r.urgency?.toUpperCase() === 'CRITICAL' || r.urgency?.toUpperCase() === 'HIGH'
  );
  const reviewLine = highReviews.length > 0
    ? `⭐ Review alert: ${highReviews.length} ${highReviews[0].urgency?.toUpperCase()} on ${highReviews[0].platform || 'review site'}`
    : '⭐ Reviews: No alerts';

  // line 5: executive mention (omitted if no executives tracked)
  const exec     = digest.executive_mentions?.[0];
  const execName = exec?.person_name || exec?.person || '';
  const execLine = execName
    ? `👤 Executive: ${execName} — ${(exec.title || '').slice(0, 45)}${(exec.title || '').length > 45 ? '…' : ''}`
    : null;

  // line 6: keywords
  const kws    = (digest.keywords || []).slice(0, 5).join(', ');
  const kwLine = kws ? `🔑 Keywords: ${kws}` : null;

  const timeLabel = digest.timezone_label ? ` · ${digest.timezone_label}` : '';

  const lines = [
    `🏢 *${company}* | 📅 ${date}${timeLabel}`,
    newsLine,
    crisisLine,
    reviewLine,
    execLine,
    kwLine,
    '📧 Full digest in your inbox',
  ].filter(Boolean);

  return lines.join('\n');
}

// get a Twilio client — returns null if TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not set
function getTwilioClient() {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || sid === 'add_later' || !token || token === 'add_later') return null;
  return twilio(sid, token);
}

// normalise any phone format to whatsapp:+XXXXX
function toWhatsAppAddr(number) {
  if (!number) return '';
  if (number.startsWith('whatsapp:')) return number;
  return `whatsapp:${number.startsWith('+') ? number : '+' + number}`;
}

// send one compact WhatsApp message per company digest
// accepts a single digest object OR an array — 2 s delay between messages
export async function sendWhatsAppDigest(digestOrArray, whatsappNumber) {
  if (!whatsappNumber) return { ok: false, error: 'No WhatsApp number configured' };

  const client = getTwilioClient();
  if (!client) return { ok: false, error: 'Twilio credentials not configured — add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN to Railway env vars' };

  const from    = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';
  const to      = toWhatsAppAddr(whatsappNumber);
  const digests = Array.isArray(digestOrArray) ? digestOrArray : [digestOrArray];
  let   allOk   = true;

  for (let i = 0; i < digests.length; i++) {
    try {
      const body = buildCompactMessage(digests[i]);
      const msg  = await client.messages.create({ from, to, body });
      console.log(`[whatsapp] ✓ sent to ${to} for ${digests[i].company} (sid: ${msg.sid})`);
    } catch (err) {
      console.error(`[whatsapp] ✗ failed for ${digests[i].company}:`, err.message);
      allOk = false;
    }
    // 2 s delay between messages — prevents Twilio rate limit + gives reader time
    if (i < digests.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  return { ok: allOk };
}

// send a one-time test/verification message to confirm the number can receive messages
export async function sendWhatsAppTest(whatsappNumber) {
  if (!whatsappNumber) return { ok: false, error: 'No WhatsApp number provided' };

  const client = getTwilioClient();
  if (!client) {
    return {
      ok: false,
      error: 'Twilio credentials not configured. Add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN to Railway environment variables.',
    };
  }

  const from = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';
  const to   = toWhatsAppAddr(whatsappNumber);

  try {
    const msg = await client.messages.create({
      from,
      to,
      body: `✅ *BrandMonitor connected!*\n\nYour daily digest will arrive here at 08:00 IST.\n\nReply STOP to unsubscribe.`,
    });
    console.log(`[whatsapp] ✓ test sent to ${to} (sid: ${msg.sid})`);
    return { ok: true };
  } catch (err) {
    console.error('[whatsapp] ✗ test failed:', err.message);
    return { ok: false, error: err.message };
  }
}
