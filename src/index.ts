export const myFunction = () => {
  return 'Hello, world!';
};

// Export auth interface and types
export type {
  AuthClient,
} from './auth/auth-interface';

export {
  AuthError,
  AuthApiError,
  isAuthError,
} from './auth/auth-interface';

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
export { StackAuthAdapter } from './auth/adapters/stack-auth';

// Export NeonClient and factory
export { NeonClient, createClient } from './client/neon-client';
export type { CreateClientOptions } from './client/neon-client';
