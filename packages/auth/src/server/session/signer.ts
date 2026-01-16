import { SignJWT } from 'jose';
import type { BetterAuthSession, BetterAuthUser } from '../../core/better-auth-types';

export interface SessionData {
  session: BetterAuthSession;
  user: BetterAuthUser;
}

export interface SessionCookieData {
  sessionData: string;
  expiresAt: Date;
}

/**
 * Create and sign session data cookie from session/user data using HS256
 * @param sessionData - Session and user data
 * @param expiresAt - Expiration time (Date or timestamp in milliseconds)
 * @param secret - HS256 secret for signing
 * @returns Signed session data string
 */
export async function signSessionData(
  sessionData: SessionData,
  expiresAt: Date | number,
  secret: string
): Promise<string> {
  const encodedSecret = new TextEncoder().encode(secret);

  // Convert expiresAt to seconds (JWT exp uses seconds, not milliseconds)
  const expSeconds = typeof expiresAt === 'number'
    ? Math.floor(expiresAt / 1000)
    : Math.floor(expiresAt.getTime() / 1000);

  // Sign the entire SessionData object (nested structure)
  const signedData = await new SignJWT(sessionData as any)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime(expSeconds)
    .setSubject(sessionData.user.id)
    .sign(encodedSecret);

  return signedData;
}

/**
 * Get cookie secret from environment variable
 * @returns Cookie secret for session data signing
 * @throws Error if secret is missing or too short
 */
export function getCookieSecret(): string {
  const secret = process.env.NEON_AUTH_COOKIE_SECRET;

  if (!secret) {
    throw new Error(
      'Cookie secret is required. Set NEON_AUTH_COOKIE_SECRET environment variable (minimum 32 characters)'
    );
  }

  if (secret.length < 32) {
    throw new Error('NEON_AUTH_COOKIE_SECRET must be at least 32 characters long');
  }

  return secret;
}
