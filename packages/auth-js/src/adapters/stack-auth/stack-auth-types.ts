import type {
  StackServerApp,
  StackClientApp,
  CurrentUser,
} from '@stackframe/js';
import type { StackClientInterface } from '@stackframe/stack-shared';
import type { InternalSession } from '@stackframe/stack-shared/dist/sessions';
import type { ReadonlyJson } from '@stackframe/stack-shared/dist/utils/json';

// Define the internal API you're using (not publicly exported)
interface StackAppInternals {
  // Session management
  _getSession(overrideTokenStoreInit?: any): Promise<InternalSession>;
  _getSessionFromTokenStore(tokenStore: any): InternalSession;

  // Token store management
  _getOrCreateTokenStore(cookieHelper: any, overrideTokenStoreInit?: any): any;
  _createCookieHelper(): Promise<any>;

  // Interface access (this one IS typed properly!)
  _interface: StackClientInterface;

  // Redirects
  redirectToAfterSignOut(): Promise<void>;
}

/**
 * Stack Auth client
 * This type extends StackServerApp or StackClientApp to include the _interface property
 * This is a workaround to get the _interface property from the StackAuthAdapter
 */
export type StackAuthClient = (StackServerApp | StackClientApp) &
  StackAppInternals;

/**
 * Stack Auth User with internal session access
 * CurrentUser from Stack Auth has _internalSession property
 * This type extends CurrentUser to include the internal session for type safety
 */
export interface StackAuthUserWithInternalSession extends CurrentUser {
  _internalSession: InternalSession;
}

/**
 * Stack Auth error response format
 */
export interface StackAuthErrorResponse {
  status: 'error';
  error: {
    message: string;
  };
  httpStatus?: number; // Optional HTTP status code from the API
}

/**
 * Stack Auth user update options
 * Based on UserUpdateOptions from Stack Auth (not exported)
 */
export interface StackAuthUserUpdateOptions {
  displayName?: string;
  clientMetadata?: ReadonlyJson;
  selectedTeamId?: string | null;
  totpMultiFactorSecret?: Uint8Array | null;
  profileImageUrl?: string | null;
  otpAuthEnabled?: boolean;
  passkeyAuthEnabled?: boolean;
}

/**
 * OnAuthStateChangeConfig type
 * This type is used to configure the onAuthStateChange function
 * It is based on the OnAuthStateChangeConfig type from Stack Auth (not exported)
 */
export interface OnAuthStateChangeConfig {
  enableTokenRefreshDetection?: boolean; // Default: true (matches Supabase)
  tokenRefreshCheckInterval?: number; // Default: 30000 (30s, like Supabase)
}
