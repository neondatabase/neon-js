import type { BetterAuthClientOptions } from 'better-auth/client';
import type { BetterFetchError } from '@better-fetch/fetch';
import { createAuthClient } from 'better-auth/client';

/**
 * Better Auth client type
 * Return type of createAuthClient() with standard email/password and OAuth plugins
 */
export type BetterAuthClient<T extends BetterAuthClientOptions> = ReturnType<
  typeof createAuthClient<T>
>;

/**
 * Better Auth session structure
 * Based on Better Auth's standard session format
 */
export interface BetterAuthSession {
  id: string;
  userId: string;
  expiresAt: Date | string;
  token: string; // JWT access token
  refreshToken?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Better Auth user structure
 * Based on Better Auth's standard user format
 */
export interface BetterAuthUser {
  id: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  image?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  [key: string]: unknown; // Additional fields from plugins
}

/**
 * Better Auth getSession response structure
 */
export interface BetterAuthSessionResponse {
  data: {
    session: BetterAuthSession | null;
    user: BetterAuthUser | null;
  } | null;
  error: BetterFetchError | null;
}

/**
 * Better Auth error response format
 * Better Auth uses BetterFetchError format
 */
export interface BetterAuthErrorResponse {
  message?: string;
  status: number;
  statusText: string;
}

/**
 * Better Auth sign up response
 */
export interface BetterAuthSignUpResponse {
  data?: {
    user?: BetterAuthUser;
    session?: BetterAuthSession;
  };
  error?: BetterFetchError;
}

/**
 * Better Auth sign in response
 */
export interface BetterAuthSignInResponse {
  data?: {
    user?: BetterAuthUser;
    session?: BetterAuthSession;
  };
  error?: BetterFetchError;
}

/**
 * Better Auth account/identity structure
 * Used for linked accounts (OAuth providers)
 */
export interface BetterAuthAccount {
  id: string;
  userId: string;
  provider: string;
  providerAccountId: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * Better Auth account list response
 */
export interface BetterAuthAccountListResponse {
  data?: {
    accounts: BetterAuthAccount[];
  };
  error?: BetterFetchError;
}

/**
 * OnAuthStateChangeConfig type
 * Configuration for auth state change monitoring
 */
export interface OnAuthStateChangeConfig {
  enableTokenRefreshDetection?: boolean; // Default: true (matches Supabase)
  tokenRefreshCheckInterval?: number; // Default: 30000 (30s, like Supabase)
}

/**
 * Neon-specific Better Auth configuration
 * Extends Better Auth client options
 */
export interface NeonBetterAuthOptions extends BetterAuthClientOptions {}
