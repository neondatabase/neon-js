import {
  type AuthClient as AuthClientSupabase,
  AuthError,
  AuthApiError,
  isAuthError,
} from '@supabase/auth-js';

type _AuthClientSupabaseInstance = InstanceType<typeof AuthClientSupabase>;
type _AuthClientBase = {
  [K in keyof _AuthClientSupabaseInstance as _AuthClientSupabaseInstance[K] extends never
    ? never
    : K]: _AuthClientSupabaseInstance[K]; // This filters out protected/private members by checking if they are accessible
};

export type AuthClient = _AuthClientBase;

// Re-export Supabase error types
export { AuthError, AuthApiError, isAuthError };
