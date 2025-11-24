import type { createAuthClient as createReactAuthClient } from 'better-auth/react';
import type { createAuthClient as createVanillaAuthClient } from 'better-auth/client';

// Main interface
export { AuthError, AuthApiError, isAuthError } from './auth-interface';
export type { AuthClient } from './auth-interface';

// Supabase types re-exports
export type { Session, User } from '@supabase/auth-js';

// Adapters
export { BetterAuthAdapter as NeonAuthClient } from './adapters/better-auth';
export type { NeonBetterAuthOptions as NeonAuthClientOptions } from './adapters/better-auth';

export type ReactBetterAuthClient = ReturnType<typeof createReactAuthClient>;
export type VanillaBetterAuthClient = ReturnType<
  typeof createVanillaAuthClient
>;
export { useStore as useBetterAuthStore } from 'better-auth/react';
