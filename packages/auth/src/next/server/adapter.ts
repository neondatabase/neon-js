import { cookies, headers } from 'next/headers';
import { workUnitAsyncStorage } from 'next/dist/server/app-render/work-unit-async-storage.external';
import { areCookiesMutableInCurrentPhase } from 'next/dist/server/web/spec-extension/adapters/request-cookies';
import type { RequestContext } from '../../server';
import { extractNeonAuthCookies } from '../../server/utils/cookies';

/**
 * Creates a Next.js-specific RequestContext that reads cookies and headers
 * from next/headers and handles cookie setting.
 */
export async function createNextRequestContext(): Promise<RequestContext> {
  const cookieStore = await cookies();
  const headerStore = await headers();

  return {
    getCookies() {
      return extractNeonAuthCookies(headerStore);
    },

    setCookie(name, value, options) {
      cookieStore.set(name, value, options);
    },

    canSetCookies() {
      const store = workUnitAsyncStorage.getStore();
      if (!store || store.type !== 'request') {
        return false;
      }
      return areCookiesMutableInCurrentPhase(store);
    },

    getHeader(name) {
      return headerStore.get(name) ?? null;
    },

    getOrigin() {
      return (
        headerStore.get('origin') ||
        headerStore.get('referer')?.split('/').slice(0, 3).join('/') ||
        ''
      );
    },

    getFramework() {
      return 'nextjs';
    },
  };
}
