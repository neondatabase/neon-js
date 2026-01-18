import { jwtVerify } from 'jose';
import type { SessionData } from '@/server/types';
import { getCookieSecret } from './signer';

export interface SessionValidationResult {
  valid: boolean;
  payload?: SessionData;
  error?: string;
}

/**
 * Validate session data signature and expiry using jose
 * @param sessionDataString - Session data string to validate
 * @returns Validation result with payload if valid
 */
export async function validateSessionData(
  sessionDataString: string
): Promise<SessionValidationResult> {
  try {
    const secret = new TextEncoder().encode(getCookieSecret());

    const { payload } = await jwtVerify<SessionData>(sessionDataString, secret, {
      algorithms: ['HS256'],
    });
    return { valid: true, payload };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid session data',
    };
  }
}
