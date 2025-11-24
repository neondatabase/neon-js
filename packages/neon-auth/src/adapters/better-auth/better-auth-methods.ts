import type { AuthChangeEvent, Session } from '@supabase/auth-js';
import { getGlobalBroadcastChannel } from 'better-auth/client';
import { InFlightRequestManager } from './in-flight-request-manager';
import { SessionCacheManager } from './session-cache-manager';
import { mapBetterAuthSessionToSupabase } from './better-auth-helpers';
import type { BetterAuthSessionResponse } from './better-auth-types';
import { BETTER_AUTH_TOKEN_STORAGE } from '../../utils/storage';

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
  onRequest: () => void;
  onSuccess: (responseData: unknown) => void;
};

export const BETTER_AUTH_METHODS_HOOKS = {
  signUp: {
    onRequest: () => {},
    onSuccess: (responseData) => {
      if (isSessionResponseData(responseData)) {
        const session = mapBetterAuthSessionToSupabase(
          responseData.session,
          responseData.user
        );
        if (session) {
          emitAuthEvent({ type: 'SIGN_IN', session });
        }
      }
    },
  },
  signIn: {
    onRequest: () => {},
    onSuccess: (responseData) => {
      if (isSessionResponseData(responseData)) {
        const session = mapBetterAuthSessionToSupabase(
          responseData.session,
          responseData.user
        );
        if (session) {
          emitAuthEvent({ type: 'SIGN_IN', session });
        }
      }
    },
  },
  signOut: {
    onRequest: () => {
      // Invalidate token immediately to prevent in-flight requests from using it
      BETTER_AUTH_TOKEN_STORAGE.invalidateToken();
      BETTER_AUTH_METHODS_CACHE.invalidateSessionCache();
      BETTER_AUTH_METHODS_IN_FLIGHT_REQUESTS.clearAll();
    },
    onSuccess: () => {
      // Clear token from persistent storage
      BETTER_AUTH_TOKEN_STORAGE.clearToken();
      BETTER_AUTH_METHODS_CACHE.clearSessionCache();
      emitAuthEvent({ type: 'SIGN_OUT' });
    },
  },
  updateUser: {
    onRequest: () => {},
    onSuccess: (responseData) => {
      if (isSessionResponseData(responseData)) {
        const session = mapBetterAuthSessionToSupabase(
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
    onRequest: () => {},
    onSuccess: (responseData) => {
      if (isSessionResponseData(responseData)) {
        const session = mapBetterAuthSessionToSupabase(
          responseData.session,
          responseData.user
        );
        if (session && BETTER_AUTH_METHODS_CACHE.wasTokenRefreshed(session)) {
          emitAuthEvent({ type: 'TOKEN_REFRESH', session });
        }
      }
    },
  },
} satisfies Record<string, MethodHook>;

/**
 * Unified event emission method that handles both Better Auth broadcasts
 * and Supabase-compatible event notifications from a single point.
 *
 * This ensures:
 * - Single source of truth for all event emissions
 * - Better Auth ecosystem compatibility via getGlobalBroadcastChannel()
 * - Supabase-compatible API via onAuthStateChange callbacks
 * - Cross-tab synchronization via Better Auth's broadcast system
 */
export async function emitAuthEvent(event: InternalAuthEvent): Promise<void> {
  // Map internal event to Supabase event and extract session
  const supabaseEvent = mapToSupabaseEvent(event);
  const session = 'session' in event ? event.session : null;

  // 1. Emit Better Auth broadcast for cross-tab sync + ecosystem compatibility
  const trigger = mapToTrigger(event);
  if (trigger) {
    getGlobalBroadcastChannel().post({
      event: 'session',
      data: { trigger },
      clientId: crypto.randomUUID(),
    });
  }

  getGlobalBroadcastChannel().post({
    event: 'session',
    data: { trigger: supabaseEvent, session },
    clientId: crypto.randomUUID(),
  });
}

/** Maps internal event types to Supabase-compatible event names */
function mapToSupabaseEvent(event: InternalAuthEvent): AuthChangeEvent {
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
  if (url.includes('/sign-in')) {
    return 'signIn';
  }
  if (url.includes('/sign-up')) {
    return 'signUp';
  }
  if (url.includes('/sign-out')) {
    return 'signOut';
  }
  if (url.includes('/update-user')) {
    return 'updateUser';
  }
  if (url.includes('/get-session') || url.includes('/token')) {
    return 'getSession';
  }
  return undefined;
}
