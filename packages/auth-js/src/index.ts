// Main interface
export { AuthError, AuthApiError, isAuthError } from './auth-interface';

// Adapters
export { BetterAuthAdapter as NeonAuthClient } from './adapters/better-auth';
export type { NeonBetterAuthOptions as NeonAuthClientOptions } from './adapters/better-auth';
