import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { Resend } from 'resend';
import db from '../db';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
const OTP_EXPIRY_MINUTES = Number(process.env.OTP_EXPIRY_MINUTES) || 10;
const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS) || 3;

export class OtpRateLimitError extends Error { constructor(message: string) { super(message); this.name = 'OtpRateLimitError'; } }
export class OtpLockedError extends Error { constructor(message: string) { super(message); this.name = 'OtpLockedError'; } }
export class OtpExpiredError extends Error { constructor(message: string) { super(message); this.name = 'OtpExpiredError'; } }
export class OtpInvalidError extends Error { constructor(message: string) { super(message); this.name = 'OtpInvalidError'; } }

export function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString().padStart(6, '0');
}

export async function sendOtp(userId: number, email: string): Promise<{ sent: boolean, expiresAt: Date }> {
  // 1. Check rate limit
  const rateLimitWindowHours = Number(process.env.OTP_RATE_LIMIT_WINDOW_HOURS) || 1;
  const maxSends = Number(process.env.OTP_RATE_LIMIT_MAX_SENDS) || 3;
  
  const recentRequests = db.prepare(`
    SELECT COUNT(*) as count FROM otp_requests 
    WHERE user_id = ? AND sent_at > datetime('now', '-${rateLimitWindowHours} hours')
  `).get(userId) as { count: number };

  if (recentRequests.count >= maxSends) {
    throw new OtpRateLimitError(`Too many verification attempts. Try again in ${rateLimitWindowHours} hour(s).`);
  }

  // 2. Check lockout
  const user = db.prepare('SELECT otp_locked_until FROM users WHERE id = ?').get(userId) as { otp_locked_until: string | null };
  if (user.otp_locked_until && new Date(user.otp_locked_until) > new Date()) {
    const remainingMinutes = Math.ceil((new Date(user.otp_locked_until).getTime() - Date.now()) / 60000);
    throw new OtpLockedError(`Too many incorrect codes. Try again in ${remainingMinutes} minutes.`);
  }

  // 3. Generate and hash OTP
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
  const otpHash = await bcrypt.hash(otp, 10);

  // 4. Update DB
  db.prepare(`
    UPDATE users SET 
      otp_hash = ?, 
      otp_expires_at = ?, 
      otp_attempt_count = 0 
    WHERE id = ?
  `).run(otpHash, expiresAt.toISOString(), userId);

  db.prepare('INSERT INTO otp_requests (user_id) VALUES (?)').run(userId);

  // 5. Send Email
  try {
    await resend.emails.send({
      from: `Kredito <${FROM_EMAIL}>`,
      to: [email],
      subject: `Your Kredito verification code: ${otp}`,
      text: `Your verification code is: ${otp}\n\nThis code expires in ${OTP_EXPIRY_MINUTES} minutes.`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: auto; padding: 20px; border: 1px solid #eee;">
          <h2 style="text-align: center;">Your verification code is:</h2>
          <div style="text-align: center; font-family: monospace; font-size: 32px; letter-spacing: 8px; background: #f9f9f9; padding: 15px; margin: 20px 0;">
            ${otp}
          </div>
          <p style="text-align: center; color: #666;">This code expires in ${OTP_EXPIRY_MINUTES} minutes.</p>
          <p style="text-align: center; font-size: 14px; color: #999;">Enter this code on the Kredito app to verify your email and unlock your credit score.</p>
        </div>
      `
    });
  } catch (error) {
    console.error('Resend API error:', error);
    throw new Error('Couldn\'t send verification code. Please try again.');
  }

  return { sent: true, expiresAt };
}

export async function verifyOtp(userId: number, submittedOtp: string): Promise<{ verified: boolean }> {
  const user = db.prepare(`
    SELECT otp_hash, otp_expires_at, otp_attempt_count, otp_locked_until 
    FROM users WHERE id = ?
  `).get(userId) as { 
    otp_hash: string | null, 
    otp_expires_at: string | null, 
    otp_attempt_count: number, 
    otp_locked_until: string | null 
  };

  if (!user || !user.otp_hash) {
    throw new OtpInvalidError('No pending verification found.');
  }

  // Check lockout
  if (user.otp_locked_until && new Date(user.otp_locked_until) > new Date()) {
    const remainingMinutes = Math.ceil((new Date(user.otp_locked_until).getTime() - Date.now()) / 60000);
    throw new OtpLockedError(`Too many incorrect codes. Try again in ${remainingMinutes} minutes.`);
  }

  // Check expiry
  if (new Date(user.otp_expires_at!) < new Date()) {
    throw new OtpExpiredError('This code has expired. Request a new one.');
  }

  const isMatch = await bcrypt.compare(submittedOtp, user.otp_hash);

  if (!isMatch) {
    const newAttemptCount = user.otp_attempt_count + 1;
    if (newAttemptCount >= OTP_MAX_ATTEMPTS) {
      const lockedUntil = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes lockout
      db.prepare(`
        UPDATE users SET 
          otp_locked_until = ?, 
          otp_hash = NULL, 
          otp_expires_at = NULL 
        WHERE id = ?
      `).run(lockedUntil.toISOString(), userId);
      throw new OtpLockedError('Too many incorrect codes. Try again in 10 minutes.');
    } else {
      db.prepare('UPDATE users SET otp_attempt_count = ? WHERE id = ?').run(newAttemptCount, userId);
      throw new OtpInvalidError('Invalid code. Please check and try again.');
    }
  }

  // Success
  db.prepare(`
    UPDATE users SET 
      email_verified = 1, 
      otp_hash = NULL, 
      otp_expires_at = NULL, 
      otp_attempt_count = 0 
    WHERE id = ?
  `).run(userId);

  return { verified: true };
}
