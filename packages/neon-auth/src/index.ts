// Main interface
export { AuthError, AuthApiError, isAuthError } from './auth-interface';
export type { AuthClient } from './auth-interface';

// Supabase types re-exports
export type { Session, User } from '@supabase/auth-js';

// Adapters
export { BetterAuthAdapter as NeonAuthClient } from './adapters/better-auth';
export type { NeonBetterAuthOptions as NeonAuthClientOptions } from './adapters/better-auth';
