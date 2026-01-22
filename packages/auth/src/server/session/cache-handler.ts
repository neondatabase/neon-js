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
    // Validation error - log and return null to fall through to upstream
    console.error('[trySessionCache] Cookie validation error:', {
      error: error instanceof Error ? error.message : String(error),
      url: request.url,
    });
  }

  // Cache miss or error - return null to indicate upstream call needed
  return null;
}
