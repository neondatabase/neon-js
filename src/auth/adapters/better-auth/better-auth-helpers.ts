import { AuthError, AuthApiError } from '@/auth/auth-interface';
import type { BetterFetchError } from '@better-fetch/fetch';
import type {
  BetterAuthErrorResponse,
  BetterAuthSession,
  BetterAuthUser,
} from './better-auth-types';
import type { Session, User } from '@supabase/auth-js';
import { toISOString } from '../shared-helpers';
import { DEFAULT_SESSION_EXPIRY_MS } from './constants';

/**
 * Map Better Auth errors to Supabase error format
 */
export function normalizeBetterAuthError(
  error: BetterFetchError | BetterAuthErrorResponse | Error | unknown
): AuthError {
  // Handle BetterFetchError format: { message?, status, statusText }
  if (
    error !== null &&
    error !== undefined &&
    typeof error === 'object' &&
    'status' in error &&
    'statusText' in error
  ) {
    const betterError = error as BetterFetchError | BetterAuthErrorResponse;
    const message =
      betterError.message || betterError.statusText || 'Authentication failed';
    const status = betterError.status;
    let code = 'unknown_error';

    // Map HTTP status codes to Supabase error codes
    if (status === 401) {
      code = 'bad_jwt';
    } else if (status === 404) {
      code = 'user_not_found';
    } else if (status === 422) {
      code = 'user_already_exists';
    } else if (status === 429) {
      code = 'over_request_rate_limit';
    } else if (status === 500) {
      code = 'unexpected_failure';
    } else {
      // Fall back to message-based detection
      const lowerMessage = message.toLowerCase();
      if (
        lowerMessage.includes('invalid login') ||
        lowerMessage.includes('incorrect') ||
        lowerMessage.includes('wrong password')
      ) {
        code = 'invalid_credentials';
      } else if (
        lowerMessage.includes('already exists') ||
        lowerMessage.includes('already registered')
      ) {
        code = 'user_already_exists';
      } else if (lowerMessage.includes('not found')) {
        code = 'user_not_found';
      } else if (
        lowerMessage.includes('token') &&
        (lowerMessage.includes('invalid') || lowerMessage.includes('expired'))
      ) {
        code = 'bad_jwt';
      } else if (
        lowerMessage.includes('rate limit') ||
        lowerMessage.includes('too many requests')
      ) {
        code = 'over_request_rate_limit';
      } else if (
        lowerMessage.includes('email') &&
        lowerMessage.includes('invalid')
      ) {
        code = 'email_address_invalid';
      }
    }

    // Use AuthApiError for API-related errors (non-500 status)
    if (status !== 500) {
      return new AuthApiError(message, status, code);
    }
    return new AuthError(message, status, code);
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    const message = error.message;
    let status = 500;
    let code = 'unexpected_failure';

    const lowerMessage = message.toLowerCase();
    if (
      lowerMessage.includes('already exists') ||
      lowerMessage.includes('already registered')
    ) {
      status = 422;
      code = 'user_already_exists';
    } else if (
      lowerMessage.includes('invalid login') ||
      lowerMessage.includes('incorrect')
    ) {
      status = 400;
      code = 'invalid_credentials';
    } else if (lowerMessage.includes('not found')) {
      status = 404;
      code = 'user_not_found';
    } else if (
      lowerMessage.includes('token') &&
      (lowerMessage.includes('invalid') || lowerMessage.includes('expired'))
    ) {
      status = 401;
      code = 'bad_jwt';
    } else if (
      lowerMessage.includes('rate limit') ||
      lowerMessage.includes('too many requests')
    ) {
      status = 429;
      code = 'over_request_rate_limit';
    } else if (
      lowerMessage.includes('email') &&
      lowerMessage.includes('invalid')
    ) {
      status = 400;
      code = 'email_address_invalid';
    }

    // Use AuthApiError for API-related errors (non-500 status)
    if (status !== 500) {
      return new AuthApiError(message, status, code);
    }
    return new AuthError(message, status, code);
  }

  // Fallback
  return new AuthError(
    'An unexpected error occurred',
    500,
    'unexpected_failure'
  );
}

/**
 * Map Better Auth session to Supabase Session format
 */
export function mapBetterAuthSessionToSupabase(
  betterAuthSession: BetterAuthSession | null,
  betterAuthUser: BetterAuthUser | null
): Session | null {
  if (!betterAuthSession || !betterAuthUser) {
    return null;
  }

  // Parse expiresAt
  const expiresAt =
    typeof betterAuthSession.expiresAt === 'string'
      ? Math.floor(new Date(betterAuthSession.expiresAt).getTime() / 1000)
      : typeof betterAuthSession.expiresAt === 'object' &&
          betterAuthSession.expiresAt instanceof Date
        ? Math.floor(betterAuthSession.expiresAt.getTime() / 1000)
        : Math.floor(Date.now() / 1000) + Math.floor(DEFAULT_SESSION_EXPIRY_MS / 1000); // Default 1 hour if can't parse

  const now = Math.floor(Date.now() / 1000);
  const expiresIn = Math.max(0, expiresAt - now);

  // Note: betterAuthSession.token is an OPAQUE token (random string), not a JWT
  // We cannot decode it to extract claims. Better Auth stores session data server-side.
  // The adapter will replace this with the JWT token when available for Supabase compatibility
  const session: Session = {
    access_token: betterAuthSession.token, // Opaque token (will be replaced with JWT by adapter)
    refresh_token: betterAuthSession.refreshToken || '',
    expires_at: expiresAt,
    expires_in: expiresIn,
    token_type: 'bearer' as const,
    user: mapBetterAuthUserToSupabase(betterAuthUser),
  };

  return session;
}

/**
 * Map Better Auth user to Supabase User format
 */
export function mapBetterAuthUserToSupabase(
  betterAuthUser: BetterAuthUser
): User {
  const createdAt = toISOString(betterAuthUser.createdAt);
  const updatedAt = toISOString(betterAuthUser.updatedAt);

  // Extract user metadata from Better Auth user
  const userMetadata: Record<string, unknown> = {};
  if (betterAuthUser.name) {
    userMetadata.displayName = betterAuthUser.name;
  }
  if (betterAuthUser.image) {
    userMetadata.profileImageUrl = betterAuthUser.image;
  }

  // Extract any additional metadata from Better Auth user
  Object.keys(betterAuthUser).forEach((key) => {
    if (
      ![
        'id',
        'email',
        'emailVerified',
        'name',
        'image',
        'createdAt',
        'updatedAt',
      ].includes(key)
    ) {
      userMetadata[key] = betterAuthUser[key];
    }
  });

  const user: User = {
    id: betterAuthUser.id,
    email: betterAuthUser.email || '',
    email_confirmed_at: betterAuthUser.emailVerified ? createdAt : undefined,
    phone: undefined,
    confirmed_at: betterAuthUser.emailVerified ? createdAt : undefined,
    last_sign_in_at: updatedAt,
    app_metadata: {},
    user_metadata: userMetadata,
    identities: [],
    created_at: createdAt,
    updated_at: updatedAt,
    aud: 'authenticated',
    role: 'authenticated',
  };

  return user;
}

// Re-export shared helpers for backward compatibility
export {
  isBrowser,
  supportsBroadcastChannel,
  toISOString,
} from '../shared-helpers';
