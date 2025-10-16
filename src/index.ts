// Export auth interface and types
export type { AuthClient } from '@/auth/auth-interface';
export { AuthError, AuthApiError, isAuthError } from '@/auth/auth-interface';

// Re-export commonly used types from Supabase
export type {
  AuthResponse,
  UserResponse,
  User,
  Session,
  AuthChangeEvent,
  Subscription,
  SignUpWithPasswordCredentials as SignUpCredentials,
  SignInWithPasswordCredentials as SignInCredentials,
  SignInWithOAuthCredentials,
  Provider as OAuthProvider,
  VerifyOtpParams as VerifyOTPParams,
  UserAttributes,
  AdminUserAttributes,
} from '@supabase/auth-js';

// Export Stack Auth adapter
export { StackAuthAdapter } from '@/auth/adapters/stack-auth/stack-auth-adapter';

// Export NeonClient and factory
export { NeonClient } from '@/client/neon-client';
export {
  createClient,
  type CreateClientOptions,
} from '@/client/client-factory';
