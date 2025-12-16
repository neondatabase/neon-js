/**
 * API endpoint configuration for server-side auth methods.
 * This is the single source of truth for mapping method names to REST endpoints.
 *
 * To add a new API:
 * 1. Add the endpoint configuration here (must match a key in VanillaBetterAuthClient)
 * 2. The types will automatically flow from VanillaBetterAuthClient
 *
 * TypeScript will error if you try to add a key that doesn't exist in VanillaBetterAuthClient.
 */

import type { VanillaBetterAuthClient } from '../neon-auth';

export interface EndpointConfig {
  path: string;
  method: 'GET' | 'POST';
}

/**
 * Generic endpoint tree type for internal proxy use.
 */
export type EndpointTree = {
  [key: string]: EndpointConfig | EndpointTree;
};

/**
 * Constrain endpoint keys to only those that exist in VanillaBetterAuthClient.
 * This ensures type safety - you can't add an endpoint that doesn't exist in the client.
 *
 * Handles both:
 * - Simple methods (getSession) → EndpointConfig
 * - Nested methods (signIn.email) → recursive ValidEndpointTree
 * - Callable objects with nested props → EndpointConfig OR recursive
 */
type ValidEndpointTree<T> = {
  [K in keyof T]?: T[K] extends (...args: never[]) => unknown
    ? // It's callable - allow EndpointConfig, or if it also has nested props, allow nesting
      EndpointConfig | (T[K] extends object ? ValidEndpointTree<T[K]> : never)
    : T[K] extends object
      ? ValidEndpointTree<T[K]> // Pure object - recurse
      : never;
};

export const API_ENDPOINTS = {
  // Session & token
  getSession: { path: 'get-session', method: 'GET' },
  getAccessToken: { path: 'get-access-token', method: 'GET' },
  listSessions: { path: 'list-sessions', method: 'GET' },
  revokeSession: { path: 'revoke-session', method: 'POST' },
  revokeSessions: { path: 'revoke-sessions', method: 'POST' },
  revokeOtherSessions: { path: 'revoke-all-sessions', method: 'POST' },
  refreshToken: { path: 'refresh-token', method: 'POST' },

  // Auth
  signIn: {
    email: { path: 'sign-in/email', method: 'POST' },
    social: { path: 'sign-in/social', method: 'POST' },
    emailOtp: { path: 'sign-in/email-otp', method: 'POST' },
    
  },
  signUp: {
    email: { path: 'sign-up/email', method: 'POST' },
  },
  signOut: { path: 'sign-out', method: 'POST' },

  // Accounts
  listAccounts: { path: 'list-accounts', method: 'GET' },
  accountInfo: { path: 'account-info', method: 'GET' },
  // TODO: Verify if neon-auth supports these two
  // unlinkAccount: { path: 'unlink-account', method: 'POST' },
  // linkSocial: { path: 'link-account', method: 'POST' },

  // User
  updateUser: { path: 'update-user', method: 'POST' },
  deleteUser: { path: 'delete-user', method: 'POST' },
  // changeEmail: { path: 'change-email', method: 'POST' }
  changePassword: { path: 'change-password', method: 'POST' },
  sendVerificationEmail: { path: 'send-verification-email', method: 'POST' },
  verifyEmail: { path: 'verify-email', method: 'POST' },
  resetPassword: { path: 'reset-password', method: 'POST' },
  requestPasswordReset: { path: 'request-password-reset', method: 'POST' },

  // JWT
  token: { path: 'token', method: 'GET' },
} as const satisfies ValidEndpointTree<VanillaBetterAuthClient>;

export type ApiEndpoints = typeof API_ENDPOINTS;
