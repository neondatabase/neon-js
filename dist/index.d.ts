import { AdminUserAttributes, AuthApiError, AuthChangeEvent, AuthClient as AuthClient$1, AuthError, AuthResponse, Provider as OAuthProvider, Session, SignInWithOAuthCredentials, SignInWithPasswordCredentials as SignInCredentials, SignUpWithPasswordCredentials as SignUpCredentials, Subscription, User, UserAttributes, UserResponse, VerifyOtpParams as VerifyOTPParams, isAuthError } from "@supabase/auth-js";
import { StackClientApp, StackClientAppConstructorOptions, StackServerApp, StackServerAppConstructorOptions } from "@stackframe/js";
import { PostgrestClient } from "@supabase/postgrest-js";

//#region src/auth/auth-interface.d.ts
type _AuthClientSupabaseInstance = InstanceType<typeof AuthClient$1>;
type AuthClient = { [K in keyof _AuthClientSupabaseInstance as _AuthClientSupabaseInstance[K] extends never ? never : K]: _AuthClientSupabaseInstance[K] };
//#endregion
//#region src/auth/adapters/stack-auth/stack-auth-adapter.d.ts
type OnAuthStateChangeConfig = {
  enableTokenRefreshDetection?: boolean;
  tokenRefreshCheckInterval?: number;
};
/**
 * Stack Auth adapter implementing the AuthClient interface
 */
declare class StackAuthAdapter<HasTokenStore extends boolean = boolean, ProjectId extends string = string> implements AuthClient {
  stackAuth: StackServerApp | StackClientApp;
  private stateChangeEmitters;
  private cachedSession;
  private broadcastChannel;
  private tokenRefreshCheckInterval;
  private config;
  constructor(params: StackServerAppConstructorOptions<HasTokenStore, ProjectId>, config?: OnAuthStateChangeConfig);
  admin: AuthClient['admin'];
  mfa: AuthClient['mfa'];
  initialize: AuthClient['initialize'];
  signUp: AuthClient['signUp'];
  signInAnonymously: AuthClient['signInAnonymously'];
  signInWithPassword: AuthClient['signInWithPassword'];
  signInWithOAuth: AuthClient['signInWithOAuth'];
  signInWithOtp: AuthClient['signInWithOtp'];
  signInWithIdToken: AuthClient['signInWithIdToken'];
  signInWithSSO: AuthClient['signInWithSSO'];
  signInWithWeb3: AuthClient['signInWithWeb3'];
  signOut: AuthClient['signOut'];
  verifyOtp: AuthClient['verifyOtp'];
  private _getCachedTokensFromStackAuthInternals;
  getSession: AuthClient['getSession'];
  refreshSession: AuthClient['refreshSession'];
  setSession: AuthClient['setSession'];
  getUser: AuthClient['getUser'];
  getClaims: AuthClient['getClaims'];
  updateUser: AuthClient['updateUser'];
  getUserIdentities: AuthClient['getUserIdentities'];
  linkIdentity: AuthClient['linkIdentity'];
  unlinkIdentity: AuthClient['unlinkIdentity'];
  resetPasswordForEmail: AuthClient['resetPasswordForEmail'];
  reauthenticate: AuthClient['reauthenticate'];
  resend: AuthClient['resend'];
  onAuthStateChange: AuthClient['onAuthStateChange'];
  private emitInitialSession;
  private notifyAllSubscribers;
  private initializeBroadcastChannel;
  private closeBroadcastChannel;
  private startTokenRefreshDetection;
  private stopTokenRefreshDetection;
  exchangeCodeForSession: AuthClient['exchangeCodeForSession'];
  startAutoRefresh: AuthClient['startAutoRefresh'];
  stopAutoRefresh: AuthClient['stopAutoRefresh'];
}
//#endregion
//#region src/client/neon-client.d.ts
type StackAuthOptions<HasTokenStore extends boolean = boolean, ProjectId extends string = string> = StackClientAppConstructorOptions<HasTokenStore, ProjectId> | StackServerAppConstructorOptions<HasTokenStore, ProjectId>;
type NeonClientConstructorOptions<HasTokenStore extends boolean = boolean, ProjectId extends string = string> = {
  url: string;
  auth: StackAuthOptions<HasTokenStore, ProjectId>;
  fetch?: typeof fetch;
};
type CreateClientOptions<HasTokenStore extends boolean = boolean, ProjectId extends string = string> = {
  url: string;
  auth: StackAuthOptions<HasTokenStore, ProjectId>;
};
declare class NeonClient extends PostgrestClient {
  auth: AuthClient;
  constructor({
    url,
    auth,
    fetch: customFetch
  }: NeonClientConstructorOptions);
}
/**
 * Factory function to create NeonClient with seamless auth integration
 *
 * @param options - Configuration options
 * @returns NeonClient instance with auth-aware fetch wrapper
 * @throws AuthRequiredError when making requests without authentication
 */
declare function createClient<HasTokenStore extends boolean = boolean, ProjectId extends string = string>({
  url,
  auth: authOptions
}: CreateClientOptions<HasTokenStore, ProjectId>): NeonClient;
//#endregion
export { type AdminUserAttributes, AuthApiError, type AuthChangeEvent, type AuthClient, AuthError, type AuthResponse, type CreateClientOptions, NeonClient, type OAuthProvider, type Session, type SignInCredentials, type SignInWithOAuthCredentials, type SignUpCredentials, StackAuthAdapter, type Subscription, type User, type UserAttributes, type UserResponse, type VerifyOTPParams, createClient, isAuthError };