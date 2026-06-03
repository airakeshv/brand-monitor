import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Resend } from 'resend';
import sgMail from '@sendgrid/mail';

// hash a raw token with SHA-256 for safe DB storage
export function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

// generate a one-time magic link token — raw goes in the URL, hash goes in the DB
export function generateMagicToken() {
  const raw       = crypto.randomBytes(32).toString('hex');
  const hash      = hashToken(raw);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes
  return { raw, hash, expiresAt };
}

// sign a 7-day JWT for an authenticated user
export function signJWT(userId, email) {
  const secret = process.env.JWT_SECRET || 'brand-monitor-dev-jwt-secret-change-in-prod';
  return jwt.sign({ userId, email }, secret, { expiresIn: '7d' });
}

// verify a JWT — returns decoded payload, or null if invalid / expired
export function verifyJWT(token) {
  try {
    const secret = process.env.JWT_SECRET || 'brand-monitor-dev-jwt-secret-change-in-prod';
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
}

// build the magic link email HTML — white background avoids phishing-pattern spam flags
function buildMagicLinkHtml(magicUrl) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <!-- preheader (hidden preview text in inbox) -->
  <span style="display:none;max-height:0;overflow:hidden">Your one-time sign-in link for BrandMonitor — expires in 15 minutes.</span>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:8px;border:1px solid #e2e8f0;overflow:hidden">
        <!-- header -->
        <tr><td style="background:#5B63EB;padding:24px 32px">
          <span style="font-size:20px;font-weight:800;color:#ffffff">Brand<span style="color:#f9a8d4">Monitor</span></span>
        </td></tr>
        <!-- body -->
        <tr><td style="padding:32px">
          <h2 style="margin:0 0 12px;font-size:20px;color:#1a202c">Sign in to BrandMonitor</h2>
          <p style="margin:0 0 24px;font-size:15px;color:#4a5568;line-height:1.6">
            Click the button below to sign in. This link expires in <strong>15 minutes</strong> and can only be used once.
          </p>
          <a href="${magicUrl}"
             style="display:inline-block;padding:13px 28px;background:#5B63EB;color:#ffffff;border-radius:6px;text-decoration:none;font-weight:700;font-size:15px">
            Sign in to BrandMonitor
          </a>
          <p style="margin:24px 0 0;font-size:13px;color:#718096">
            If you didn't request this, you can safely ignore this email — your account is secure.
          </p>
          <p style="margin:16px 0 0;font-size:12px;color:#a0aec0">
            Or copy this link: <span style="word-break:break-all">${magicUrl}</span>
          </p>
        </td></tr>
        <!-- footer -->
        <tr><td style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0">
          <p style="margin:0;font-size:12px;color:#a0aec0">BrandMonitor · You are receiving this because a sign-in was requested for this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// send via SendGrid HTTP API — works from Railway (HTTPS port 443, never blocked)
// requires: SENDGRID_API_KEY  SENDGRID_FROM=verified-sender@yourdomain.com
async function sendViaSendGrid(to, magicUrl) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  const from = (process.env.SENDGRID_FROM || '').trim();
  try {
    await sgMail.send({
      to,
      from,
      replyTo: from,
      subject: 'Your BrandMonitor sign-in link',
      html:    buildMagicLinkHtml(magicUrl),
      text:    `Sign in to BrandMonitor\n\nUse this link to sign in (expires in 15 minutes, one-time use):\n\n${magicUrl}\n\nIf you didn't request this, ignore this email.`,
      // disable SendGrid click/open tracking — tracking redirects trigger spam filters
      trackingSettings: {
        clickTracking:  { enable: false, enableText: false },
        openTracking:   { enable: false },
      },
    });
  } catch (err) {
    const details = err.response?.body?.errors?.map(e => e.message).join(' | ') || err.message;
    console.error('[sendgrid] magic link send failed:', details);
    throw new Error(details);
  }
}

// send via Resend — works to any address ONLY when RESEND_FROM uses a verified custom domain
// (onboarding@resend.dev can only deliver to the Resend account owner's email)
async function sendViaResend(to, magicUrl) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const from   = process.env.RESEND_FROM || 'BrandMonitor <onboarding@resend.dev>';
  const { error } = await resend.emails.send({
    from,
    to,
    subject: 'Your Brand Monitor sign-in link',
    html:    buildMagicLinkHtml(magicUrl),
    text:    `Sign in to Brand Monitor\n\n${magicUrl}\n\nThis link expires in 15 minutes.`,
  });
  if (error) throw new Error(error.message);
}

// send the magic link email — picks provider automatically:
//   1. SendGrid HTTP API (SENDGRID_API_KEY set)  → any recipient, HTTPS, works on Railway ✓
//   2. Resend HTTP API   (RESEND_API_KEY set)     → any recipient IF custom domain configured ✓
//   3. Console log       (no keys set)            → logs link to terminal for dev testing
export async function sendMagicLinkEmail(email, magicUrl) {
  try {
    if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM) {
      await sendViaSendGrid(email, magicUrl);
      console.log('[email] magic link sent via SendGrid');
      return;
    }

    if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 'add_later') {
      await sendViaResend(email, magicUrl);
      console.log('[email] magic link sent via Resend');
      return;
    }

    // dev fallback — no email keys configured
    console.log('[email] ⚠ No email provider configured. Magic link printed for dev use:');
    console.log(`[email] ${magicUrl}`);
  } catch (err) {
    console.error('[email] ✗ Failed to send magic link:', err.message);
    throw err;
  }
}
