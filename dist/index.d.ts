import { AdminUserAttributes, AuthApiError, AuthChangeEvent, AuthClient as AuthClient$1, AuthError, AuthResponse, Provider as OAuthProvider, Session, SignInWithOAuthCredentials, SignInWithPasswordCredentials as SignInCredentials, SignUpWithPasswordCredentials as SignUpCredentials, Subscription, User, UserAttributes, UserResponse, VerifyOtpParams as VerifyOTPParams, isAuthError } from "@supabase/auth-js";
import { StackClientApp, StackClientAppConstructorOptions, StackServerApp, StackServerAppConstructorOptions } from "@stackframe/js";
import { PostgrestClient } from "@supabase/postgrest-js";
import { StackClientInterface } from "@stackframe/stack-shared";
import { InternalSession } from "@stackframe/stack-shared/dist/sessions";

//#region src/auth/auth-interface.d.ts
type _AuthClientSupabaseInstance = InstanceType<typeof AuthClient$1>;
type AuthClient = { [K in keyof _AuthClientSupabaseInstance as _AuthClientSupabaseInstance[K] extends never ? never : K]: _AuthClientSupabaseInstance[K] };
//#endregion
//#region src/auth/adapters/stack-auth/stack-auth-types.d.ts
interface StackAppInternals {
  _getSession(overrideTokenStoreInit?: any): Promise<InternalSession>;
  _getSessionFromTokenStore(tokenStore: any): InternalSession;
  _getOrCreateTokenStore(cookieHelper: any, overrideTokenStoreInit?: any): any;
  _createCookieHelper(): Promise<any>;
  _interface: StackClientInterface;
  redirectToAfterSignOut(): Promise<void>;
}
/**
 * Stack Auth client
 * This type extends StackServerApp or StackClientApp to include the _interface property
 * This is a workaround to get the _interface property from the StackAuthAdapter
 */
type StackAuthClient = (StackServerApp | StackClientApp) & StackAppInternals;
/**
 * OnAuthStateChangeConfig type
 * This type is used to configure the onAuthStateChange function
 * It is based on the OnAuthStateChangeConfig type from Stack Auth (not exported)
 */
interface OnAuthStateChangeConfig {
  enableTokenRefreshDetection?: boolean;
  tokenRefreshCheckInterval?: number;
}
//#endregion
//#region src/auth/adapters/stack-auth/stack-auth-adapter.d.ts
/**
 * Stack Auth adapter implementing the AuthClient interface
 */
declare class StackAuthAdapter<HasTokenStore extends boolean = boolean, ProjectId extends string = string> implements AuthClient {
  stackAuth: StackAuthClient;
  private stateChangeEmitters;
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
  private _getSessionFromStackAuthInternals;
  private _getCachedTokensFromStackAuthInternals;
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
declare class NeonClient<Database = any> extends PostgrestClient<Database> {
  auth: AuthClient;
  constructor({
    url,
    auth,
    fetch: customFetch
  }: NeonClientConstructorOptions);
}
//#endregion
//#region src/client/client-factory.d.ts
type CreateClientOptions = {
  url: string;
  auth: StackAuthOptions;
};
/**
 * Factory function to create NeonClient with seamless auth integration
 *
 * @param options - Configuration options
 * @returns NeonClient instance with auth-aware fetch wrapper
 * @throws AuthRequiredError when making requests without authentication
 */
declare function createClient<Database = any>({
  url,
  auth: authOptions
}: CreateClientOptions): NeonClient<Database>;
//#endregion
export { type AdminUserAttributes, AuthApiError, type AuthChangeEvent, type AuthClient, AuthError, type AuthResponse, type CreateClientOptions, NeonClient, type OAuthProvider, type Session, type SignInCredentials, type SignInWithOAuthCredentials, type SignUpCredentials, StackAuthAdapter, type Subscription, type User, type UserAttributes, type UserResponse, type VerifyOTPParams, createClient, isAuthError };