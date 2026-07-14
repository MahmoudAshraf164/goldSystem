import * as crypto from 'crypto';

/** Generates a cryptographically secure 6-digit OTP */
export function generateOtp(): string {
  // crypto.randomInt is uniformly distributed — no modulo bias
  return crypto.randomInt(100000, 999999).toString();
}

/** Returns the OTP expiry date (default: 10 minutes from now) */
export function getOtpExpiry(minutes = 10): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}
