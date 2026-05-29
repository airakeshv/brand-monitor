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

// build the magic link email HTML
function buildMagicLinkHtml(magicUrl) {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:40px auto;padding:32px;border-radius:8px;background:#0a0e27;color:#fff">
      <h2 style="margin:0 0 16px;font-size:22px">Sign in to Brand Monitor</h2>
      <p style="color:rgba(255,255,255,0.7);margin:0 0 24px">
        Click the button below to sign in. This link expires in <strong>15 minutes</strong> and can only be used once.
      </p>
      <a href="${magicUrl}"
         style="display:inline-block;padding:12px 28px;background:#5B63EB;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px">
        Sign in to Brand Monitor
      </a>
      <p style="color:rgba(255,255,255,0.4);font-size:12px;margin:24px 0 0">
        If you didn't request this, you can safely ignore this email.
      </p>
    </div>
  `;
}

// send via SendGrid HTTP API — works from Railway (HTTPS port 443, never blocked)
// requires: SENDGRID_API_KEY  SENDGRID_FROM=verified-sender@yourdomain.com
async function sendViaSendGrid(to, magicUrl) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  const from = (process.env.SENDGRID_FROM || '').trim(); // trim hidden newlines/spaces
  console.log(`[sendgrid] from=${from} to=${to}`);
  try {
    await sgMail.send({
      to,
      from,
      subject: 'Your Brand Monitor sign-in link',
      html:    buildMagicLinkHtml(magicUrl),
      text:    `Sign in to Brand Monitor\n\n${magicUrl}\n\nThis link expires in 15 minutes.`,
    });
  } catch (err) {
    // extract the real SendGrid error message from the response body
    const details = err.response?.body?.errors?.map(e => e.message).join(' | ') || err.message;
    console.error('[sendgrid] error details:', details);
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
      console.log(`[email] sending via SendGrid to ${email}`);
      await sendViaSendGrid(email, magicUrl);
      console.log(`[email] ✓ sent to ${email}`);
      return;
    }

    if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 'add_later') {
      console.log(`[email] sending via Resend to ${email}`);
      await sendViaResend(email, magicUrl);
      console.log(`[email] ✓ sent to ${email}`);
      return;
    }

    // dev fallback — print link to console so dev can test without email keys
    console.log(`[email] ⚠ No email provider configured. Magic link for ${email}:`);
    console.log(`[email] ${magicUrl}`);
  } catch (err) {
    console.error(`[email] ✗ Failed to send to ${email}:`, err.message);
    throw err;
  }
}
