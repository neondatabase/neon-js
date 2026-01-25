import { getSessionDataFromCookie } from './operations';
import { NEON_AUTH_SESSION_DATA_COOKIE_NAME } from '@/server/constants';

/**
 * Attempts to retrieve session data from cookie cache
 * Returns Response with session data if cache hit, null otherwise
 *
 * This is the framework-agnostic session cache optimization used by API handlers.
 *
 * @param request - Standard Web API Request object
 * @param cookieSecret - Secret for validating signed session cookies
 * @returns Response with session data JSON if cache hit, null if miss/disabled
 */
export async function trySessionCache(
  request: Request,
  cookieSecret: string
): Promise<Response | null> {
  const url = new URL(request.url);
  const disableCookieCache = url.searchParams.get('disableCookieCache');

  // Skip cache if explicitly disabled
  if (disableCookieCache === 'true') {
    return null;
  }

  try {
    const sessionData = await getSessionDataFromCookie(
      request,
      NEON_AUTH_SESSION_DATA_COOKIE_NAME,
      cookieSecret
    );

    if (sessionData && sessionData.session) {
      // Cache hit - return immediately (no upstream call)
      return Response.json(sessionData);
    }
  } catch (error) {
    // Validation error - log appropriately based on error type
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.name : 'Unknown';

    // JWTExpired is expected behavior - use debug level
    if (errorName === 'JWTExpired') {
      console.debug('[trySessionCache] Session cookie expired (expected):', {
        error: errorMessage,
        errorType: errorName,
        url: request.url,
      });
    }
    // JWT validation failures could indicate tampering - use warning level
    else if (errorName === 'JWTInvalid' || errorName === 'JWTClaimValidationFailed') {
      console.warn('[trySessionCache] Invalid session cookie (possible tampering):', {
        error: errorMessage,
        errorType: errorName,
        url: request.url,
      });
    }
    // Unexpected errors - use error level
    else {
      console.error('[trySessionCache] Unexpected cookie validation error:', {
        error: errorMessage,
        errorType: errorName,
        url: request.url,
      });
    }
  }

  // Cache miss or error - return null to indicate upstream call needed
  return null;
}
