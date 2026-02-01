import type { VanillaBetterAuthClient } from '@/types';
import type { API_ENDPOINTS } from './endpoints';
import type {
  BetterAuthSession as Session,
  BetterAuthUser as User,
} from '@/core/better-auth-types';

export type RequireSessionData = {
  session: Session;
  user: User;
};

export type SessionData =
  | RequireSessionData
  | {
      session: null;
      user: null;
    };


export interface SessionDataCookie {
  value: string;
  expiresAt: Date;
}

/**
 * Extract top-level keys from API_ENDPOINTS.
 * For nested endpoints like signIn.email, this extracts 'signIn' (not 'email').
 */
type TopLevelEndpointKeys<T> = {
  [K in keyof T]: K;
}[keyof T];

type ServerAuthMethods = TopLevelEndpointKeys<typeof API_ENDPOINTS>;
export type NeonAuthServer = Pick<VanillaBetterAuthClient, ServerAuthMethods>;
