import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Resend } from 'resend';

// hash a raw token with SHA-256 for safe DB storage
export function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

// generate a one-time magic link token — raw goes in the URL, hash goes in the DB
export function generateMagicToken() {
  const raw      = crypto.randomBytes(32).toString('hex');
  const hash     = hashToken(raw);
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

// send the magic link email via Resend
export async function sendMagicLinkEmail(email, magicUrl) {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const from   = process.env.RESEND_FROM || 'BrandMonitor <onboarding@resend.dev>';
    await resend.emails.send({
      from,
      to:      email,
      subject: 'Your Brand Monitor sign-in link',
      html: `
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
      `,
      text: `Sign in to Brand Monitor\n\n${magicUrl}\n\nThis link expires in 15 minutes and can only be used once.`,
    });
  } catch (err) {
    console.error('Magic link email error:', err.message);
    throw err;
  }
}
