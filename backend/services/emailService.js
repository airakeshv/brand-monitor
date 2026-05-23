import { Resend } from 'resend';

// lazy singleton — only instantiated when a key is present
let _resend = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

// map sentiment to a colour
function sentimentColor(s = '') {
  if (s.includes('strongly_positive')) return '#22c55e';
  if (s.includes('positive'))          return '#86efac';
  if (s.includes('strongly_negative')) return '#ef4444';
  if (s.includes('negative'))          return '#fca5a5';
  if (s.includes('mixed'))             return '#facc15';
  return '#6B7A99';
}

// map urgency to colour
function urgencyColor(u = '') {
  if (u === 'CRITICAL') return '#ef4444';
  if (u === 'HIGH')     return '#f97316';
  return '#facc15';
}

// format YYYY-MM-DD to "1 Jan 2026" — returns empty string if null or unparseable
function fmtReadable(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso.includes('T') ? iso : iso + 'T12:00:00Z');
    return isNaN(d.getTime()) ? (iso || '') : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return iso || ''; }
}

// build HTML email from DigestSchema
function buildHtml(digest) {
  const newsRows = (digest.news || []).map(n => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #2A3858">
        <span style="background:rgba(91,99,235,0.15);color:#5B63EB;border:1px solid rgba(91,99,235,0.3);border-radius:999px;padding:2px 10px;font-size:11px;font-weight:600;text-transform:uppercase">${n.source || ''}</span>
        <span style="margin-left:8px;background:${sentimentColor(n.sentiment)};color:#0A0E27;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:600">${n.sentiment || ''}</span>
        <div style="margin-top:6px"><a href="${n.url||'#'}" style="color:#FFFFFF;font-weight:600;text-decoration:none">${n.title||''}</a></div>
        <div style="color:#B4B4B4;font-size:13px;margin-top:4px">${n.snippet||''}</div>
      </td>
    </tr>`).join('');

  const socialRows = (digest.social || []).filter(s => s.title).map(s => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #2A3858">
        <span style="background:rgba(168,85,247,0.15);color:#a855f7;border:1px solid rgba(168,85,247,0.3);border-radius:999px;padding:2px 10px;font-size:11px;font-weight:600;text-transform:uppercase">${s.source || ''}</span>
        ${s.sentiment ? `<span style="margin-left:8px;background:${sentimentColor(s.sentiment)};color:#0A0E27;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:600">${s.sentiment}</span>` : ''}
        <div style="margin-top:6px"><a href="${s.url||'#'}" style="color:#FFFFFF;font-weight:600;text-decoration:none">${s.title||''}</a></div>
        <div style="color:#B4B4B4;font-size:13px;margin-top:4px">${s.snippet||''}</div>
      </td>
    </tr>`).join('');

  const reviewRows = (digest.reviews || []).map(r => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #2A3858;border-left:3px solid ${urgencyColor(r.urgency)};padding-left:12px">
        <span style="color:${urgencyColor(r.urgency)};font-weight:700;font-size:12px">${r.urgency||''}</span>
        <span style="margin-left:8px;color:#B4B4B4;font-size:12px">${r.platform||''} · ${'★'.repeat(Math.max(0,r.rating||0))}${'☆'.repeat(Math.max(0,5-(r.rating||0)))}</span>
        <div style="color:#FFFFFF;margin-top:4px;font-size:14px">"${r.excerpt||''}"</div>
        ${r.draft_response ? `<div style="background:#111830;border:1px solid #2A3858;border-radius:8px;padding:8px 12px;margin-top:8px;color:#B4B4B4;font-size:13px"><strong style="color:#5B63EB">Suggested reply:</strong> ${r.draft_response}</div>` : ''}
      </td>
    </tr>`).join('');

  const keywords = (digest.keywords || []).map(k =>
    `<span style="background:rgba(91,99,235,0.15);color:#5B63EB;border:1px solid rgba(91,99,235,0.3);border-radius:999px;padding:3px 12px;font-size:12px;white-space:nowrap;display:inline-block">${k}</span>`
  ).join(' ');

  const crisisBanner = digest.crisis_flag?.triggered
    ? `<div style="background:rgba(239,68,68,0.15);border:1px solid #ef4444;border-radius:10px;padding:12px 16px;margin-bottom:24px">
        <strong style="color:#ef4444">⚠ CRISIS ALERT:</strong> <span style="color:#FFFFFF">${digest.crisis_flag.reason}</span>
       </div>` : '';

  const watchOut = digest.watch_out
    ? `<div style="background:rgba(250,204,21,0.1);border:1px solid #facc15;border-radius:10px;padding:12px 16px;margin-top:16px">
        <strong style="color:#facc15">Watch Out:</strong> <span style="color:#FFFFFF">${digest.watch_out}</span>
       </div>` : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0A0E27;font-family:Inter,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0E27">
    <tr><td align="center" style="padding:32px 16px">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#111830;border:1px solid #2A3858;border-radius:16px;overflow:hidden">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#5B63EB,#E91E8C);padding:24px 32px">
          <div style="color:#FFFFFF;font-size:22px;font-weight:700">Brand<span style="color:#fff">Monitor</span></div>
          <div style="color:rgba(255,255,255,0.9);font-size:16px;font-weight:600;margin-top:6px">${digest.company}</div>
          <div style="color:rgba(255,255,255,0.8);font-size:13px;margin-top:4px">
            📅 ${fmtReadable(digest.date) || digest.date}${digest.timezone_label ? ' · ' + digest.timezone_label : ''}
          </div>
          ${digest.search_from && digest.search_to
            ? `<div style="background:rgba(255,255,255,0.18);border-radius:8px;padding:7px 14px;margin-top:10px;display:inline-block">
                <span style="color:#FFFFFF;font-size:13px;font-weight:600">📰 Coverage: ${fmtReadable(digest.search_from)} – ${fmtReadable(digest.search_to)}</span>
               </div>`
            : ''}
          <div style="color:rgba(255,255,255,0.6);font-size:12px;margin-top:8px">Powered by ${digest.model_used}</div>
        </td></tr>

        <tr><td style="padding:24px 32px">
          ${crisisBanner}

          <!-- News -->
          ${newsRows ? `<div style="color:#E91E8C;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px">News Highlights</div>
          <table width="100%" cellpadding="0" cellspacing="0">${newsRows}</table>` : ''}

          <!-- Social -->
          ${socialRows ? `<div style="color:#E91E8C;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin:20px 0 8px">Social Mentions</div>
          <table width="100%" cellpadding="0" cellspacing="0">${socialRows}</table>` : ''}

          <!-- Reviews -->
          ${reviewRows ? `<div style="color:#E91E8C;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin:20px 0 8px">Review Alerts</div>
          <table width="100%" cellpadding="0" cellspacing="0">${reviewRows}</table>` : ''}

          <!-- Keywords -->
          ${keywords ? `<div style="color:#E91E8C;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin:20px 0 8px">Trending Keywords</div>
          <div>${keywords}</div>` : ''}

          ${watchOut}
        </td></tr>

        <!-- Footer -->
        <tr><td style="border-top:1px solid #2A3858;padding:16px 32px;text-align:center;color:#6B7A99;font-size:12px">
          BrandMonitor · Daily Digest · <a href="#" style="color:#5B63EB">Manage Preferences</a>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// build plain-text fallback
function buildText(digest) {
  const coverage = digest.search_from && digest.search_to
    ? `Coverage: ${fmtReadable(digest.search_from)} – ${fmtReadable(digest.search_to)}`
    : '';
  const lines = [
    `BRAND MONITOR — ${digest.company}`,
    `${fmtReadable(digest.date) || digest.date}${digest.timezone_label ? ' · ' + digest.timezone_label : ''} | Model: ${digest.model_used}`,
    coverage,
    '',
    '--- NEWS ---',
    ...(digest.news || []).map(n => `[${n.sentiment}] ${n.title}\n${n.url}`),
    '',
    '--- SOCIAL ---',
    ...(digest.social || []).filter(s => s.title).map(s => `[${s.sentiment}] ${s.title}\n${s.url}`),
    '',
    '--- REVIEWS ---',
    ...(digest.reviews || []).map(r => `[${r.urgency}] ${r.platform} ${r.rating}★\n"${r.excerpt}"\nSuggested: ${r.draft_response}`),
    '',
    `Keywords: ${(digest.keywords || []).join(', ')}`,
    digest.watch_out ? `Watch Out: ${digest.watch_out}` : '',
  ];
  return lines.filter(Boolean).join('\n');
}

// send digest email via Resend
export async function sendDigestEmail(digest, toEmail) {
  try {
    if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 'add_later') {
      console.error('Resend API key not configured');
      return { ok: false, error: 'Resend key not set' };
    }

    const crisisPrefix = digest.crisis_flag?.triggered ? '🚨 CRISIS ALERT — ' : '';
    const rangeLabel  = digest.search_from && digest.search_to
      ? ` · ${fmtReadable(digest.search_from)} – ${fmtReadable(digest.search_to)}`
      : '';
    const subject = `${crisisPrefix}${digest.company} Brand Digest · ${fmtReadable(digest.date) || digest.date}${digest.timezone_label ? ' ' + digest.timezone_label : ''}${rangeLabel}`;

    const { data, error } = await getResend().emails.send({
      from: process.env.RESEND_FROM || 'BrandMonitor <onboarding@resend.dev>',
      to: toEmail,
      subject,
      html: buildHtml(digest),
      text: buildText(digest),
    });

    if (error) throw new Error(error.message);
    return { ok: true, id: data?.id };
  } catch (err) {
    console.error('Email send failed:', err.message);
    return { ok: false, error: err.message };
  }
}
