import { jwtVerify } from 'jose';
import type { SessionData } from '@/server/types';
import { getCookieSecret } from './signer';
import { parseSessionData } from './operations';

interface SessionValidationResult {
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
    const parsedPayload = parseSessionData(payload);
    return { valid: true, payload: parsedPayload };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid session data',
    };
  }
}
