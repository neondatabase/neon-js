import { mintSessionDataFromToken, serializeSessionDataDeletion } from './minting';
import { NEON_AUTH_SESSION_COOKIE_NAME } from '../constants';
import type { SessionCookieConfig } from '../config';

interface RefreshArgs {
  requestCookieHeader: string | null;
  response: Response;
  baseUrl: string;
  cookieConfig: SessionCookieConfig;
  alreadyMintedFromHeader: boolean;
}

/**
 * After a proxy/server-client response, optionally refresh the session_data
 * cookie cache based on whether the response body carries fresh user/session
 * state.
 *
 * Why this exists:
 *   Better Auth solves cache staleness by calling `setSessionCookie`
 *   (which internally calls `setCookieCache`) inside every mutation route
 *   — so the cookie re-mints naturally on mutations like `/update-user`,
 *   `/phone-number/verify`, `/update-email` which do NOT rotate the
 *   opaque session_token. Our wrapper previously keyed re-mint on
 *   session_token rotation and therefore missed those mutations, serving
 *   pre-mutation state for up to the cache TTL.
 *
 * Ordering: call AFTER `mintSessionDataFromResponse`.
 *   - If that already minted (token rotation, sign-out), skip.
 *   - Otherwise, if the response body carries fresh `user`/`session`,
 *     re-mint from the existing session_token in the request.
 *   - If re-mint fails (upstream error, invalid token), delete
 *     session_data so the next read falls through to a fresh fetch.
 *
 * @returns A Set-Cookie string to append, or null when no action is needed.
 */
export async function maybeRefreshSessionDataAfterResponse(
  args: RefreshArgs
): Promise<string | null> {
  const {
    requestCookieHeader,
    response,
    baseUrl,
    cookieConfig,
    alreadyMintedFromHeader,
  } = args;

  if (alreadyMintedFromHeader) return null;
  if (!response.ok) return null;

  // Cheap content-type guard: avoid cloning + JSON-parsing HTML / SSE / etc.
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return null;

  let body: unknown;
  try {
    body = await response.clone().json();
  } catch {
    return null;
  }

  if (!carriesUserOrSession(body)) return null;

  const sessionToken = parseSessionTokenFromCookieHeader(requestCookieHeader);
  if (!sessionToken) return null; // Unauthenticated request — no cache to refresh.

  try {
    const refreshed = await mintSessionDataFromToken(
      sessionToken,
      baseUrl,
      cookieConfig
    );
    if (refreshed) return refreshed;
  } catch {
    // Fall through to deletion: clearing the stale cache is safer than
    // leaving it — next read will fetch fresh state from upstream.
  }

  return serializeSessionDataDeletion(cookieConfig);
}

/**
 * Does this JSON body carry fresh user/session state that should invalidate
 * the session_data cache?
 *
 * Matches both flat (`{user,...}` / `{session,...}`) and wrapped
 * (`{data:{user,...}}`) shapes — Better Auth uses both depending on route.
 */
function carriesUserOrSession(body: unknown): boolean {
  if (body == null || typeof body !== 'object') return false;
  const obj = body as Record<string, unknown>;

  if (isNonNullObject(obj.user)) return true;
  if (isNonNullObject(obj.session)) return true;

  const data = obj.data;
  if (isNonNullObject(data)) {
    const d = data as Record<string, unknown>;
    if (isNonNullObject(d.user)) return true;
    if (isNonNullObject(d.session)) return true;
  }

  return false;
}

function isNonNullObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

/**
 * Extract a session_token cookie pair (name=value) from a request Cookie
 * header for passing to `mintSessionDataFromToken`. Returns null when no
 * session_token is present (unauthenticated request).
 */
function parseSessionTokenFromCookieHeader(
  header: string | null
): string | null {
  if (!header) return null;
  for (const pair of header.split(/;\s*/)) {
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    const name = pair.slice(0, eq).trim();
    if (name === NEON_AUTH_SESSION_COOKIE_NAME) {
      // Return as "name=value" — mintSessionDataFromToken expects a
      // cookie-header fragment, not a bare value.
      return pair.trim();
    }
  }
  return null;
}
