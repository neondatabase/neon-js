import {
  BETTER_AUTH_METHODS_HOOKS,
  BETTER_AUTH_METHODS_IN_FLIGHT_REQUESTS,
  deriveBetterAuthMethodFromUrl,
} from '../core/better-auth-methods';

/**
 * Force-fetch escape hatch: when this header is present on an outbound
 * request, deduplication, before-fetch hooks, and the response clone are
 * skipped so the caller gets a bare fetch back. The header itself is stripped
 * before the request is sent on.
 */
export const FORCE_FETCH_HEADER = 'X-Force-Fetch';

/**
 * Creates a `customFetchImpl` that implements the fetch-level Neon behaviors
 * that cannot be expressed through a Better Auth fetch plugin (because the
 * plugin contract does not wrap the underlying `fetch()` call):
 *
 *  - `X-Force-Fetch` escape hatch — skip dedup + per-method `beforeFetch`
 *  - Per-method `beforeFetch` short-circuit (e.g. session cache, social
 *    sign-in popup) from `BETTER_AUTH_METHODS_HOOKS`
 *  - Body-aware in-flight deduplication via
 *    `BETTER_AUTH_METHODS_IN_FLIGHT_REQUESTS`
 *  - Response cloning so each deduplicated caller gets a fresh body stream
 *
 * Three other Neon behaviors that used to live here moved into
 * `neonFetchPlugin` hooks because they only need the request/response, not a
 * fetch-wrap:
 *
 *  - `injectClientInfo` headers → `onRequest`
 *  - `normalizeBetterAuthError` on non-OK → `onError`
 *  - `set-auth-jwt` capture → `onSuccess` (was already there)
 *
 * Used both by the legacy `createAuthClient(url, config)` wrapper (via
 * `NeonAuthAdapterCore`) and by tenants who install `neonClient()` standalone
 * and ALSO want dedup + force-fetch.
 */
export function createNeonCustomFetchImpl(): (
  url: string | URL | globalThis.Request,
  init?: RequestInit
) => Promise<Response> {
  return async (url, init) => {
    const headers = new Headers(init?.headers);

    // Force-fetch escape hatch: skip dedup + before-fetch. Strip the marker
    // header so it never reaches the server.
    if (headers.has(FORCE_FETCH_HEADER)) {
      headers.delete(FORCE_FETCH_HEADER);
      return fetch(url, { ...init, headers });
    }

    const betterAuthMethod = deriveBetterAuthMethodFromUrl(url.toString());
    if (betterAuthMethod) {
      const earlyResponse =
        await BETTER_AUTH_METHODS_HOOKS[betterAuthMethod].beforeFetch?.(
          url,
          init
        );
      if (earlyResponse) {
        return earlyResponse;
      }
    }

    // Body-aware deduplication key so concurrent calls with different bodies
    // do not collapse into the same in-flight entry.
    const method = init?.method || 'GET';
    const body = init?.body || '';
    const key = `${method}:${url}:${body}`;

    const response = await BETTER_AUTH_METHODS_IN_FLIGHT_REQUESTS.deduplicate(
      key,
      () => fetch(url, { ...init, headers })
    );

    // Clone so each deduplicated caller gets its own readable body stream.
    return response.clone();
  };
}
