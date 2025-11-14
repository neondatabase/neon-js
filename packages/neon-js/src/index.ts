// Re-export auth from auth package for convenience
export type { AuthClient } from '@neon-js/auth';
export { BetterAuthAdapter, StackAuthAdapter, AuthError, AuthApiError, isAuthError, toISOString } from '@neon-js/auth';

// Export client and related utilities
export { NeonClient, createClient, createClientStackAuth, fetchWithAuth } from './client';
