import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import { lookup } from 'dns';
import { promisify } from 'util';

const dnsLookup = promisify(lookup);

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

// send via Gmail SMTP using nodemailer — can reach ANY email address, no domain needed
// requires: GMAIL_USER=you@gmail.com  GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
// Pre-resolves smtp.gmail.com to an IPv4 address — Railway has no outbound IPv6.
// family:4 alone is unreliable; explicit DNS lookup guarantees IPv4 connection.
async function sendViaGmail(to, magicUrl) {
  // resolve hostname to IPv4 before creating the transport
  const { address: smtpIp } = await dnsLookup('smtp.gmail.com', { family: 4 });
  console.log(`[email] resolved smtp.gmail.com → ${smtpIp} (IPv4)`);

  const transporter = nodemailer.createTransport({
    host:   smtpIp,               // use IPv4 address directly
    port:   587,
    secure: false,                // STARTTLS on 587
    tls:    { servername: 'smtp.gmail.com' }, // keep cert validation against hostname
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
  await transporter.sendMail({
    from:    `"BrandMonitor" <${process.env.GMAIL_USER}>`,
    to,
    subject: 'Your Brand Monitor sign-in link',
    html:    buildMagicLinkHtml(magicUrl),
    text:    `Sign in to Brand Monitor\n\n${magicUrl}\n\nThis link expires in 15 minutes.`,
  });
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
//   1. Gmail SMTP  (GMAIL_USER + GMAIL_APP_PASSWORD set)   → any recipient ✓
//   2. Resend      (RESEND_API_KEY set, custom domain)      → any recipient ✓
//   3. Console log (dev fallback — no email keys set)       → logs link to terminal
export async function sendMagicLinkEmail(email, magicUrl) {
  try {
    if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
      console.log(`[email] sending via Gmail SMTP to ${email}`);
      await sendViaGmail(email, magicUrl);
      console.log(`[email] ✓ sent to ${email}`);
      return;
    }

    if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 'add_later') {
      console.log(`[email] sending via Resend to ${email}`);
      await sendViaResend(email, magicUrl);
      console.log(`[email] ✓ sent to ${email}`);
      return;
    }

    // dev fallback — print link to console so dev can still test without email keys
    console.log(`[email] ⚠ No email provider configured. Magic link for ${email}:`);
    console.log(`[email] ${magicUrl}`);
  } catch (err) {
    console.error(`[email] ✗ Failed to send to ${email}:`, err.message);
    throw err;
  }
}
