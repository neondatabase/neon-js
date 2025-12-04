import type { AuthChangeEvent, Session } from '@supabase/auth-js';
import {
  getGlobalBroadcastChannel,
  type RequestContext,
} from 'better-auth/client';
import { InFlightRequestManager } from './in-flight-request-manager';
import { SessionCacheManager } from './session-cache-manager';
import { mapBetterAuthSession } from './better-auth-helpers';
import type { BetterAuthSessionResponse } from './better-auth-types';
import { NEON_AUTH_SESSION_VERIFIER_PARAM_NAME } from './constants';
import { isBrowser } from '../utils/browser';

export const CURRENT_TAB_CLIENT_ID = crypto.randomUUID();

export const BETTER_AUTH_METHODS_IN_FLIGHT_REQUESTS =
  new InFlightRequestManager();

export const BETTER_AUTH_METHODS_CACHE = new SessionCacheManager();

/** Internal canonical auth event types */
type InternalAuthEvent =
  | { type: 'SIGN_IN'; session: Session }
  | { type: 'SIGN_OUT' }
  | { type: 'TOKEN_REFRESH'; session: Session }
  | { type: 'USER_UPDATE'; session: Session };

type MethodHook = {
  beforeRequest?: (
    input: string | URL | globalThis.Request,
    init?: RequestInit
  ) => Promise<Response> | null | Response;
  onRequest: (request: RequestContext) => void | RequestContext;
  onSuccess: (responseData: unknown) => void;
};

export const BETTER_AUTH_ENDPOINTS = {
  signUp: '/sign-up',
  signIn: '/sign-in',
  signOut: '/sign-out',
  updateUser: '/update-user',
  getSession: '/get-session',
  token: '/token',
} as const;

export const BETTER_AUTH_METHODS_HOOKS: Record<string, MethodHook> = {
  signUp: {
    onRequest: () => {},
    onSuccess: (responseData) => {
      if (isSessionResponseData(responseData)) {
        const session = mapBetterAuthSession(
          responseData.session,
          responseData.user
        );
        if (session) {
          BETTER_AUTH_METHODS_CACHE.setCachedSession(session);
          emitAuthEvent({ type: 'SIGN_IN', session });
        }
      }
    },
  },
  signIn: {
    onRequest: () => {},
    onSuccess: (responseData) => {
      if (isSessionResponseData(responseData)) {
        const session = mapBetterAuthSession(
          responseData.session,
          responseData.user
        );
        if (session) {
          BETTER_AUTH_METHODS_CACHE.setCachedSession(session);
          emitAuthEvent({ type: 'SIGN_IN', session });
        }
      }
    },
  },
  signOut: {
    onRequest: () => {
      BETTER_AUTH_METHODS_CACHE.invalidateSessionCache();
      BETTER_AUTH_METHODS_IN_FLIGHT_REQUESTS.clearAll();
    },
    onSuccess: () => {
      BETTER_AUTH_METHODS_CACHE.clearSessionCache();
      emitAuthEvent({ type: 'SIGN_OUT' });
    },
  },
  updateUser: {
    onRequest: () => {},
    onSuccess: (responseData) => {
      if (isSessionResponseData(responseData)) {
        const session = mapBetterAuthSession(
          responseData.session,
          responseData.user
        );
        if (session) {
          emitAuthEvent({ type: 'USER_UPDATE', session });
        }
      }
    },
  },
  getSession: {
    beforeRequest: () => {
      const cachedSession = BETTER_AUTH_METHODS_CACHE.getCachedSession();
      if (!cachedSession) {
        return null;
      }

      return Response.json(cachedSession, {
        status: 200,
      });
    },
    onRequest: (ctx) => {
      if (!isBrowser()) {
        return;
      }

      const urlSearchParams = new URLSearchParams(
        globalThis.window.location.search
      );
      const neonAuthSessionVerifierParam = urlSearchParams.get(
        NEON_AUTH_SESSION_VERIFIER_PARAM_NAME
      );

      if (neonAuthSessionVerifierParam) {
        const url = typeof ctx.url === 'string' ? new URL(ctx.url) : ctx.url;
        url.searchParams.set(
          NEON_AUTH_SESSION_VERIFIER_PARAM_NAME,
          neonAuthSessionVerifierParam
        );

        return {
          ...ctx,
          url,
        };
      }
    },
    onSuccess: (responseData) => {
      if (isSessionResponseData(responseData)) {
        const session = mapBetterAuthSession(
          responseData.session,
          responseData.user
        );

        if (session) {
          BETTER_AUTH_METHODS_CACHE.setCachedSession(session);
          if (BETTER_AUTH_METHODS_CACHE.wasTokenRefreshed(session)) {
            emitAuthEvent({ type: 'TOKEN_REFRESH', session });
          }
        }

        // remove the session verifier parameter from the URL if it exists on success
        if (isBrowser()) {
          const url = new URL(globalThis.window.location.href);
          const neonAuthSessionVerifierParam = url.searchParams.get(
            NEON_AUTH_SESSION_VERIFIER_PARAM_NAME
          );
          if (neonAuthSessionVerifierParam) {
            url.searchParams.delete(NEON_AUTH_SESSION_VERIFIER_PARAM_NAME);
            history.replaceState(history.state, '', url.href);
          }
        }
      }
    },
  },
};

/**
 * Unified event emission method that handles both Better Auth broadcasts
 * and compatible event notifications from a single point.
 *
 * This ensures:
 * - Single source of truth for all event emissions
 * - Better Auth ecosystem compatibility via getGlobalBroadcastChannel()
 * - Compatible API via onAuthStateChange callbacks
 * - Cross-tab synchronization via Better Auth's broadcast system
 */
export async function emitAuthEvent(event: InternalAuthEvent): Promise<void> {
  // Map internal event to auth event and extract session
  const authEvent = mapToAuthEvent(event);
  const session = 'session' in event ? event.session : null;

  // 1. Emit Better Auth broadcast for cross-tab sync + ecosystem compatibility
  const trigger = mapToTrigger(event);
  if (trigger) {
    getGlobalBroadcastChannel().post({
      event: 'session',
      data: { trigger },
      clientId: CURRENT_TAB_CLIENT_ID,
    });
  }

  getGlobalBroadcastChannel().post({
    event: 'session',
    data: { trigger: authEvent, session },
    clientId: CURRENT_TAB_CLIENT_ID,
  });
}

/** Maps internal event types to compatible event names */
function mapToAuthEvent(event: InternalAuthEvent): AuthChangeEvent {
  switch (event.type) {
    case 'SIGN_IN': {
      return 'SIGNED_IN';
    }
    case 'SIGN_OUT': {
      return 'SIGNED_OUT';
    }
    case 'TOKEN_REFRESH': {
      return 'TOKEN_REFRESHED';
    }
    case 'USER_UPDATE': {
      return 'USER_UPDATED';
    }
  }
}

/** Maps internal event types to Better Auth broadcast triggers */
function mapToTrigger(
  event: InternalAuthEvent
): 'signout' | 'getSession' | 'updateUser' | null {
  switch (event.type) {
    case 'SIGN_OUT': {
      return 'signout';
    }
    case 'TOKEN_REFRESH': {
      return null;
    }
    case 'USER_UPDATE': {
      return 'updateUser';
    }
    case 'SIGN_IN': {
      return null; // No Better Auth broadcast for sign-in
    }
  }
}

function isSessionResponseData(
  responseData: unknown
): responseData is BetterAuthSessionResponse['data'] & {} {
  return Boolean(
    responseData &&
      typeof responseData === 'object' &&
      'session' in responseData &&
      'user' in responseData &&
      responseData.session !== null &&
      responseData.user !== null
  );
}

export function deriveBetterAuthMethodFromUrl(
  url: string
): keyof typeof BETTER_AUTH_METHODS_HOOKS | undefined {
  if (url.includes(BETTER_AUTH_ENDPOINTS.signIn)) {
    return 'signIn';
  }
  if (url.includes(BETTER_AUTH_ENDPOINTS.signUp)) {
    return 'signUp';
  }
  if (url.includes(BETTER_AUTH_ENDPOINTS.signOut)) {
    return 'signOut';
  }
  if (url.includes(BETTER_AUTH_ENDPOINTS.updateUser)) {
    return 'updateUser';
  }
  if (
    url.includes(BETTER_AUTH_ENDPOINTS.getSession) ||
    url.includes(BETTER_AUTH_ENDPOINTS.token)
  ) {
    return 'getSession';
  }
  return undefined;
}
