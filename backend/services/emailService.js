import { Resend } from 'resend';
import sgMail from '@sendgrid/mail';

// lazy singleton — only instantiated when a key is present
let _resend = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

// send an email via SendGrid HTTP API (HTTPS port 443 — works from Railway)
async function sendViaSendGrid({ to, subject, html, text }) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  const from = (process.env.SENDGRID_FROM || '').trim();
  try {
    await sgMail.send({ to, from, subject, html, text });
  } catch (err) {
    const details = err.response?.body?.errors?.map(e => e.message).join(' | ') || err.message;
    throw new Error(details);
  }
}

// send an email via Resend HTTP API — restricted to account-owner email on free tier without custom domain
async function sendViaResend({ to, subject, html, text }) {
  const from = process.env.RESEND_FROM || 'BrandMonitor <onboarding@resend.dev>';
  const { error } = await getResend().emails.send({ from, to, subject, html, text });
  if (error) throw new Error(error.message);
}

// unified email dispatcher — SendGrid → Resend → console
async function dispatchEmail({ to, subject, html, text }) {
  if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM) {
    await sendViaSendGrid({ to, subject, html, text });
    return;
  }
  if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 'add_later') {
    await sendViaResend({ to, subject, html, text });
    return;
  }
  // dev fallback — no email provider configured
  console.log(`[email] ⚠ No email provider configured. Would have sent "${subject}" to ${to}`);
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
        <span style="margin-left:8px;color:#B4B4B4;font-size:12px">${r.platform||''}${r.rating != null ? ' · ' + '★'.repeat(Math.max(0,r.rating||0)) + '☆'.repeat(Math.max(0,5-(r.rating||0))) : ''}</span>
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

  const aiVisibilityRows = (digest.ai_visibility || []).filter(a => a.engine).map(a => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #2A3858">
        <span style="background:rgba(34,197,94,0.15);color:#22c55e;border:1px solid rgba(34,197,94,0.3);border-radius:999px;padding:2px 10px;font-size:11px;font-weight:600;text-transform:uppercase">${a.engine}</span>
        ${a.accuracy_flag === false ? `<span style="margin-left:8px;background:#ef4444;color:#fff;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:600">INACCURATE</span>` : ''}
        <div style="color:#B4B4B4;font-size:13px;margin-top:6px">${a.summary || ''}</div>
      </td>
    </tr>`).join('');

  const competitorRows = (digest.competitor_signals || []).filter(c => c.company).map(c => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #2A3858;border-left:3px solid #5B63EB;padding-left:12px">
        <span style="color:#5B63EB;font-weight:700;font-size:13px">${c.company}</span>
        <span style="margin-left:8px;background:rgba(91,99,235,0.15);color:#5B63EB;border-radius:4px;padding:1px 7px;font-size:11px">${c.signal_type || ''}</span>
        <div style="color:#B4B4B4;font-size:13px;margin-top:4px">${c.detail || ''}</div>
      </td>
    </tr>`).join('');

  const corporateRows = (digest.corporate_events || []).filter(e => e.headline).map(e => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #2A3858">
        <span style="background:rgba(250,204,21,0.15);color:#facc15;border:1px solid rgba(250,204,21,0.3);border-radius:999px;padding:2px 10px;font-size:11px;font-weight:600;text-transform:uppercase">${e.type || 'EVENT'}</span>
        <div style="color:#FFFFFF;font-weight:600;font-size:14px;margin-top:6px">${e.headline}</div>
        ${e.implication ? `<div style="color:#B4B4B4;font-size:13px;margin-top:4px">${e.implication}</div>` : ''}
      </td>
    </tr>`).join('');

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

          <!-- AI Visibility -->
          ${aiVisibilityRows ? `<div style="color:#E91E8C;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin:20px 0 8px">AI Visibility</div>
          <table width="100%" cellpadding="0" cellspacing="0">${aiVisibilityRows}</table>` : ''}

          <!-- Competitor Signals -->
          ${competitorRows ? `<div style="color:#E91E8C;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin:20px 0 8px">Competitor Signals</div>
          <table width="100%" cellpadding="0" cellspacing="0">${competitorRows}</table>` : ''}

          <!-- Corporate Events -->
          ${corporateRows ? `<div style="color:#E91E8C;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin:20px 0 8px">Corporate Events</div>
          <table width="100%" cellpadding="0" cellspacing="0">${corporateRows}</table>` : ''}

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
    '--- AI VISIBILITY ---',
    ...(digest.ai_visibility || []).filter(a => a.engine).map(a => `[${a.engine}] ${a.summary}${a.accuracy_flag === false ? ' ⚠ INACCURATE' : ''}`),
    '',
    '--- COMPETITOR SIGNALS ---',
    ...(digest.competitor_signals || []).filter(c => c.company).map(c => `${c.company} (${c.signal_type}): ${c.detail}`),
    '',
    '--- CORPORATE EVENTS ---',
    ...(digest.corporate_events || []).filter(e => e.headline).map(e => `[${e.type}] ${e.headline}${e.implication ? ' — ' + e.implication : ''}`),
    '',
    `Keywords: ${(digest.keywords || []).join(', ')}`,
    digest.watch_out ? `Watch Out: ${digest.watch_out}` : '',
  ];
  return lines.filter(Boolean).join('\n');
}

// send digest email — uses SendGrid if configured, falls back to Resend, then console log
export async function sendDigestEmail(digest, toEmail) {
  try {
    const crisisPrefix = digest.crisis_flag?.triggered ? '🚨 CRISIS ALERT — ' : '';
    const rangeLabel   = digest.search_from && digest.search_to
      ? ` · ${fmtReadable(digest.search_from)} – ${fmtReadable(digest.search_to)}`
      : '';
    const subject = `${crisisPrefix}${digest.company} Brand Digest · ${fmtReadable(digest.date) || digest.date}${digest.timezone_label ? ' ' + digest.timezone_label : ''}${rangeLabel}`;

    await dispatchEmail({ to: toEmail, subject, html: buildHtml(digest), text: buildText(digest) });
    return { ok: true };
  } catch (err) {
    console.error('Email send failed:', err.message);
    return { ok: false, error: err.message };
  }
}

// ─── Multi-company combined email ────────────────────────────────────────────

// build full HTML section for one company inside a combined email — matches dashboard detail level
function buildCompanySectionHtml(digest) {
  // news — all items with snippet
  const newsRows = (digest.news || []).map(n => `
    <tr><td style="padding:8px 0;border-bottom:1px solid #1e2a44">
      <span style="background:rgba(91,99,235,0.15);color:#5B63EB;border:1px solid rgba(91,99,235,0.3);border-radius:999px;padding:1px 8px;font-size:11px;font-weight:600">${n.source||''}</span>
      <span style="margin-left:6px;background:${sentimentColor(n.sentiment)};color:#0A0E27;border-radius:999px;padding:1px 6px;font-size:11px;font-weight:600">${n.sentiment||''}</span>
      <div style="margin-top:4px"><a href="${n.url||'#'}" style="color:#FFFFFF;font-weight:600;font-size:13px;text-decoration:none">${n.title||''}</a></div>
      ${n.snippet ? `<div style="color:#B4B4B4;font-size:12px;margin-top:3px">${n.snippet}</div>` : ''}
    </td></tr>`).join('');

  // social — all items that have a title
  const socialRows = (digest.social || []).filter(s => s.title).map(s => `
    <tr><td style="padding:8px 0;border-bottom:1px solid #1e2a44">
      <span style="background:rgba(168,85,247,0.15);color:#a855f7;border:1px solid rgba(168,85,247,0.3);border-radius:999px;padding:1px 8px;font-size:11px;font-weight:600">${s.source||''}</span>
      ${s.sentiment ? `<span style="margin-left:6px;background:${sentimentColor(s.sentiment)};color:#0A0E27;border-radius:999px;padding:1px 6px;font-size:11px;font-weight:600">${s.sentiment}</span>` : ''}
      <div style="margin-top:4px"><a href="${s.url||'#'}" style="color:#FFFFFF;font-weight:600;font-size:13px;text-decoration:none">${s.title||''}</a></div>
      ${s.snippet ? `<div style="color:#B4B4B4;font-size:12px;margin-top:3px">${s.snippet}</div>` : ''}
    </td></tr>`).join('');

  // reviews — CRITICAL and HIGH urgency only
  const flaggedReviews = (digest.reviews || []).filter(r => r.urgency === 'CRITICAL' || r.urgency === 'HIGH');
  const reviewRows = flaggedReviews.map(r => `
    <tr><td style="padding:8px 0;border-bottom:1px solid #1e2a44;border-left:3px solid ${urgencyColor(r.urgency)};padding-left:10px">
      <span style="color:${urgencyColor(r.urgency)};font-weight:700;font-size:11px">${r.urgency||''}</span>
      <span style="margin-left:6px;color:#B4B4B4;font-size:11px">${r.platform||''}${r.rating != null ? ' · ' + '★'.repeat(Math.max(0,r.rating||0)) + '☆'.repeat(Math.max(0,5-(r.rating||0))) : ''}</span>
      <div style="color:#FFFFFF;margin-top:4px;font-size:13px">"${r.excerpt||''}"</div>
      ${r.draft_response ? `<div style="background:#0A0E27;border:1px solid #2A3858;border-radius:6px;padding:6px 10px;margin-top:6px;color:#B4B4B4;font-size:12px"><strong style="color:#5B63EB">Suggested reply:</strong> ${r.draft_response}</div>` : ''}
    </td></tr>`).join('');

  // competitor signals
  const competitorRows = (digest.competitor_signals || []).filter(c => c.company).map(c => `
    <tr><td style="padding:8px 0;border-bottom:1px solid #1e2a44;border-left:3px solid #5B63EB;padding-left:10px">
      <span style="color:#5B63EB;font-weight:700;font-size:13px">${c.company}</span>
      <span style="margin-left:6px;background:rgba(91,99,235,0.15);color:#5B63EB;border-radius:4px;padding:1px 6px;font-size:11px">${c.signal_type||''}</span>
      <div style="color:#B4B4B4;font-size:12px;margin-top:3px">${c.detail||''}</div>
    </td></tr>`).join('');

  // keywords pills
  const keywords = (digest.keywords || []).map(k =>
    `<span style="background:rgba(91,99,235,0.15);color:#5B63EB;border:1px solid rgba(91,99,235,0.3);border-radius:999px;padding:2px 10px;font-size:11px;display:inline-block;margin:2px 2px">${k}</span>`
  ).join('');

  const reviewFlagged = flaggedReviews.length;
  const crisisBadge   = digest.crisis_flag?.triggered
    ? `<span style="background:#ef4444;color:#fff;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:700;margin-left:8px">⚠ CRISIS</span>` : '';
  const crisisBanner  = digest.crisis_flag?.triggered
    ? `<tr><td style="padding:8px 0 4px"><div style="background:rgba(239,68,68,0.15);border:1px solid #ef4444;border-radius:8px;padding:8px 12px;font-size:12px;color:#FFFFFF"><strong style="color:#ef4444">⚠ CRISIS ALERT:</strong> ${digest.crisis_flag.reason}</div></td></tr>` : '';

  // section header helper
  const sectionHeader = (label, count) =>
    `<tr><td style="padding:10px 0 4px"><div style="color:#6B7A99;font-size:11px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;border-bottom:1px solid #1e2a44;padding-bottom:4px">${label} (${count})</div></td></tr>`;

  return `
    <tr><td style="padding:20px 32px 4px">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="border-top:2px solid #5B63EB;padding-top:14px;padding-bottom:8px">
          <div style="color:#FFFFFF;font-size:15px;font-weight:700">🏢 ${(digest.company||'').toUpperCase()}${crisisBadge}</div>
          <div style="color:#6B7A99;font-size:12px;margin-top:4px">
            News (${(digest.news||[]).length}) &nbsp;·&nbsp; Social (${(digest.social||[]).length})${reviewFlagged ? ` &nbsp;·&nbsp; <span style="color:#ef4444">${reviewFlagged} review${reviewFlagged>1?'s':''} flagged</span>` : ''}
          </div>
        </td></tr>
        ${crisisBanner}
        ${newsRows ? `${sectionHeader('News', (digest.news||[]).length)}<tr><td><table width="100%" cellpadding="0" cellspacing="0">${newsRows}</table></td></tr>` : ''}
        ${socialRows ? `${sectionHeader('Social', (digest.social||[]).filter(s=>s.title).length)}<tr><td><table width="100%" cellpadding="0" cellspacing="0">${socialRows}</table></td></tr>` : ''}
        ${reviewRows ? `${sectionHeader('Flagged Reviews', reviewFlagged)}<tr><td><table width="100%" cellpadding="0" cellspacing="0">${reviewRows}</table></td></tr>` : ''}
        ${competitorRows ? `${sectionHeader('Competitor Signals', (digest.competitor_signals||[]).filter(c=>c.company).length)}<tr><td><table width="100%" cellpadding="0" cellspacing="0">${competitorRows}</table></td></tr>` : ''}
        ${keywords ? `<tr><td style="padding:8px 0 4px"><div style="margin-bottom:4px;color:#6B7A99;font-size:11px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase">Keywords</div><div>${keywords}</div></td></tr>` : ''}
        ${digest.watch_out ? `<tr><td style="padding:8px 0 4px"><div style="background:rgba(250,204,21,0.1);border-left:3px solid #facc15;padding:8px 12px;font-size:12px;color:#FFFFFF"><strong style="color:#facc15">Watch Out:</strong> ${digest.watch_out}</div></td></tr>` : ''}
      </table>
    </td></tr>`;
}

// build combined HTML email wrapping one section per company
function buildMultiCompanyHtml(digests) {
  const names     = digests.map(d => d.company).join(', ');
  const date      = digests[0]?.date;
  const tzLabel   = digests[0]?.timezone_label;
  const model     = digests[0]?.model_used;
  const anycrisis = digests.some(d => d.crisis_flag?.triggered);
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0A0E27;font-family:Inter,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0E27">
    <tr><td align="center" style="padding:32px 16px">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#111830;border:1px solid #2A3858;border-radius:16px;overflow:hidden">
        <tr><td style="background:linear-gradient(135deg,#5B63EB,#E91E8C);padding:24px 32px">
          <div style="color:#FFFFFF;font-size:22px;font-weight:700">Brand<span style="color:#fff">Monitor</span></div>
          <div style="color:rgba(255,255,255,0.9);font-size:15px;font-weight:600;margin-top:6px">${names}</div>
          <div style="color:rgba(255,255,255,0.8);font-size:13px;margin-top:4px">📅 ${fmtReadable(date)||date}${tzLabel ? ' · ' + tzLabel : ''} · ${digests.length} companies</div>
          <div style="color:rgba(255,255,255,0.6);font-size:12px;margin-top:8px">Powered by ${model}</div>
        </td></tr>
        ${anycrisis ? `<tr><td style="padding:16px 32px 0"><div style="background:rgba(239,68,68,0.15);border:1px solid #ef4444;border-radius:10px;padding:12px 16px"><strong style="color:#ef4444">⚠ CRISIS DETECTED — see company sections below</strong></div></td></tr>` : ''}
        ${digests.map(buildCompanySectionHtml).join('')}
        <tr><td style="border-top:1px solid #2A3858;padding:16px 32px;text-align:center;color:#6B7A99;font-size:12px">
          BrandMonitor · Daily Digest · <a href="#" style="color:#5B63EB">Manage Preferences</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// build plain-text fallback for multi-company email — full detail matching dashboard
function buildMultiCompanyText(digests) {
  const lines = [
    'BRAND MONITOR — MULTI-COMPANY DIGEST',
    digests.map(d => d.company).join(', '),
    `${fmtReadable(digests[0]?.date)} · ${digests[0]?.timezone_label || ''} | Model: ${digests[0]?.model_used}`,
    '',
  ];
  for (const digest of digests) {
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    lines.push(`🏢 ${digest.company.toUpperCase()}`);
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    lines.push(`News (${(digest.news||[]).length}) | Social (${(digest.social||[]).length}) | Reviews (${(digest.reviews||[]).length})`);
    if (digest.crisis_flag?.triggered) lines.push(`⚠ CRISIS: ${digest.crisis_flag.reason}`);

    // all news items
    if ((digest.news||[]).length > 0) {
      lines.push('');
      lines.push('NEWS:');
      (digest.news || []).forEach(n => {
        lines.push(`  [${n.sentiment||''}] ${n.title||''}`);
        if (n.snippet) lines.push(`    ${n.snippet}`);
      });
    }

    // all social items
    const socialItems = (digest.social || []).filter(s => s.title);
    if (socialItems.length > 0) {
      lines.push('');
      lines.push('SOCIAL:');
      socialItems.forEach(s => {
        lines.push(`  [${s.source||''}] ${s.title||''}`);
        if (s.snippet) lines.push(`    ${s.snippet}`);
      });
    }

    // flagged reviews only
    const flagged = (digest.reviews || []).filter(r => r.urgency === 'CRITICAL' || r.urgency === 'HIGH');
    if (flagged.length > 0) {
      lines.push('');
      lines.push('FLAGGED REVIEWS:');
      flagged.forEach(r => {
        lines.push(`  [${r.urgency}] ${r.platform||''}: "${r.excerpt||''}"`);
        if (r.draft_response) lines.push(`    Suggested reply: ${r.draft_response}`);
      });
    }

    // competitor signals
    const competitors = (digest.competitor_signals || []).filter(c => c.company);
    if (competitors.length > 0) {
      lines.push('');
      lines.push('COMPETITOR SIGNALS:');
      competitors.forEach(c => lines.push(`  ${c.company} [${c.signal_type||''}]: ${c.detail||''}`));
    }

    // keywords
    if ((digest.keywords || []).length > 0) {
      lines.push('');
      lines.push(`KEYWORDS: ${digest.keywords.join(', ')}`);
    }

    if (digest.watch_out) {
      lines.push('');
      lines.push(`Watch Out: ${digest.watch_out}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

// send one combined email covering all companies — uses SendGrid if configured, falls back to Resend
export async function sendMultiCompanyDigestEmail(digests, toEmail) {
  if (!digests?.length) return { ok: false, error: 'No digests provided' };
  if (digests.length === 1) return sendDigestEmail(digests[0], toEmail);
  try {
    const companies    = digests.map(d => d.company);
    const date         = digests[0]?.date;
    const tzLabel      = digests[0]?.timezone_label;
    const anycrisis    = digests.some(d => d.crisis_flag?.triggered);
    const crisisPrefix = anycrisis ? '🚨 CRISIS — ' : '';
    const label        = companies.slice(0, 2).join(', ') + (companies.length > 2 ? ` +${companies.length - 2} more` : '');
    const subject      = `${crisisPrefix}${label} Brand Digest · ${fmtReadable(date)||date}${tzLabel ? ' ' + tzLabel : ''}`;

    await dispatchEmail({ to: toEmail, subject, html: buildMultiCompanyHtml(digests), text: buildMultiCompanyText(digests) });
    return { ok: true };
  } catch (err) {
    console.error('Multi-company email send failed:', err.message);
    return { ok: false, error: err.message };
  }
}
