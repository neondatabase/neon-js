import {
  appendResponseHeader,
  getRequestHeader,
  type H3Event,
} from 'h3';
import {
  extractNeonAuthCookies,
  serializeSetCookie,
  type RequestContext,
} from '../../server';

/**
 * Creates a request context bound to one H3 event.
 *
 * The event is captured explicitly so concurrent Nitro requests never share
 * cookies, headers, or response state.
 */
export function createNuxtRequestContext(event: H3Event): RequestContext {
  return {
    getCookies() {
      return extractNeonAuthCookies(getRequestHeader(event, 'cookie') ?? '');
    },

    setCookie(name, value, options) {
      appendResponseHeader(
        event,
        'set-cookie',
        serializeSetCookie({ name, value, ...options })
      );
    },

    getHeader(name) {
      return getRequestHeader(event, name) ?? null;
    },

    getOrigin() {
      const origin = getRequestHeader(event, 'origin');
      if (origin) return origin;

      const referer = getRequestHeader(event, 'referer');
      if (!referer) return '';

      try {
        return new URL(referer).origin;
      } catch {
        return '';
      }
    },

    getFramework() {
      return 'nuxt';
    },
  };
}
