import {
  getGlobalBroadcastChannel,
  type RequestContext,
} from 'better-auth/client';
import { InFlightRequestManager } from './in-flight-request-manager';
import {
  SessionCacheManager,
  type CachedSessionData,
} from './session-cache-manager';
import type { BetterAuthSession, BetterAuthUser } from './better-auth-types';
import { NEON_AUTH_SESSION_VERIFIER_PARAM_NAME } from './constants';
import { isBrowser } from '../utils/browser';

export const CURRENT_TAB_CLIENT_ID = crypto.randomUUID();

export const BETTER_AUTH_METHODS_IN_FLIGHT_REQUESTS =
  new InFlightRequestManager();

export const BETTER_AUTH_METHODS_CACHE = new SessionCacheManager();

/**
 * Auth change event types (adapter-agnostic).
 * Each adapter maps these to their specific event types if needed.
 */
export type NeonAuthChangeEvent =
  | 'SIGNED_IN'
  | 'SIGNED_OUT'
  | 'TOKEN_REFRESHED'
  | 'USER_UPDATED';

/** Internal canonical auth event types using Better Auth native format */
type InternalAuthEvent =
  | { type: 'SIGN_IN'; data: CachedSessionData }
  | { type: 'SIGN_OUT' }
  | { type: 'TOKEN_REFRESH'; data: CachedSessionData }
  | { type: 'USER_UPDATE'; data: CachedSessionData };

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
        const sessionData = {
          session: responseData.session,
          user: responseData.user,
        };
        BETTER_AUTH_METHODS_CACHE.setCachedSession(sessionData);
        emitAuthEvent({ type: 'SIGN_IN', data: sessionData });
      }
    },
  },
  signIn: {
    onRequest: () => {},
    onSuccess: (responseData) => {
      if (isSessionResponseData(responseData)) {
        const sessionData = {
          session: responseData.session,
          user: responseData.user,
        };
        BETTER_AUTH_METHODS_CACHE.setCachedSession(sessionData);
        emitAuthEvent({ type: 'SIGN_IN', data: sessionData });
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
        const sessionData = {
          session: responseData.session,
          user: responseData.user,
        };
        emitAuthEvent({ type: 'USER_UPDATE', data: sessionData });
      }
    },
  },
  getSession: {
    beforeRequest: () => {
      const cachedData = BETTER_AUTH_METHODS_CACHE.getCachedSession();
      if (!cachedData) {
        return null;
      }

      return Response.json(cachedData, {
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
        const sessionData = {
          session: responseData.session,
          user: responseData.user,
        };
        const wasRefreshed =
          BETTER_AUTH_METHODS_CACHE.wasTokenRefreshed(sessionData);
        BETTER_AUTH_METHODS_CACHE.setCachedSession(sessionData);

        if (wasRefreshed) {
          emitAuthEvent({ type: 'TOKEN_REFRESH', data: sessionData });
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
 * Unified event emission method that handles Better Auth broadcasts.
 * Broadcasts use Better Auth native format - each adapter handles
 * conversion to their specific format (e.g., Supabase Session).
 *
 * This ensures:
 * - Single source of truth for all event emissions
 * - Better Auth ecosystem compatibility via getGlobalBroadcastChannel()
 * - Adapter-agnostic event format
 * - Cross-tab synchronization via Better Auth's broadcast system
 */
export async function emitAuthEvent(event: InternalAuthEvent): Promise<void> {
  const eventType = mapToEventType(event);
  const sessionData = 'data' in event ? event.data : null;

  // Emit Better Auth broadcast for cross-tab sync + ecosystem compatibility
  const trigger = mapToTrigger(event);
  if (trigger) {
    getGlobalBroadcastChannel().post({
      event: 'session',
      data: { trigger },
      clientId: CURRENT_TAB_CLIENT_ID,
    });
  }

  // Broadcast with Better Auth native format
  getGlobalBroadcastChannel().post({
    event: 'session',
    data: { trigger: eventType, sessionData },
    clientId: CURRENT_TAB_CLIENT_ID,
  });
}

/** Maps internal event types to NeonAuthChangeEvent */
function mapToEventType(event: InternalAuthEvent): NeonAuthChangeEvent {
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

/**
 * Type guard that validates response data has non-null session and user.
 * Narrows the type to ensure session and user are not null.
 */
function isSessionResponseData(
  responseData: unknown
): responseData is { session: BetterAuthSession; user: BetterAuthUser } {
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

export function initBroadcastChannel() {
  getGlobalBroadcastChannel().subscribe((message) => {
    if (message.clientId === CURRENT_TAB_CLIENT_ID) {
      return;
    }

    // Only clear cache for Better Auth triggers that cause internal getSession
    // This ensures getSession makes a real request instead of returning cached data
    const trigger = message.data?.trigger;
    if (
      trigger === 'signout' ||
      trigger === 'updateUser' ||
      trigger === 'getSession'
    ) {
      BETTER_AUTH_METHODS_CACHE.clearSessionCache();
    }
    // For 'SIGNED_IN', 'TOKEN_REFRESHED', etc. - let adapter set cache from sessionData
  });
}
