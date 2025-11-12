import {
  AuthError,
  AuthApiError,
  type AuthClient,
} from '@/auth/auth-interface';
import type { Session, AuthChangeEvent, Subscription } from '@supabase/auth-js';
import {
  StackClientApp,
  StackServerApp,
  type StackServerAppConstructorOptions,
} from '@stackframe/js';
import type { InternalSession } from '@stackframe/stack-shared/dist/sessions';
import { accessTokenSchema } from '@/auth/adapters/shared-schemas';
import {
  supportsBroadcastChannel,
  toISOString,
} from '@/auth/adapters/shared-helpers';
import type {
  StackAuthUserWithInternalSession,
  StackAuthErrorResponse,
  StackAuthUserUpdateOptions,
  StackAuthClient,
  OnAuthStateChangeConfig,
} from '@/auth/adapters/stack-auth/stack-auth-types';
import type { ProviderType } from '@stackframe/stack-shared/dist/utils/oauth';
import type { ReadonlyJson } from '@stackframe/stack-shared/dist/utils/json';

/**
 * Type guard to check if Stack Auth user has internal session access
 * Stack Auth exposes _internalSession with caching methods that we can leverage
 */
function hasInternalSession(
  user: unknown
): user is StackAuthUserWithInternalSession {
  return (
    user !== null &&
    user !== undefined &&
    typeof user === 'object' &&
    '_internalSession' in user &&
    user._internalSession !== null &&
    user._internalSession !== undefined &&
    typeof user._internalSession === 'object' &&
    'getAccessTokenIfNotExpiredYet' in user._internalSession &&
    typeof user._internalSession.getAccessTokenIfNotExpiredYet === 'function' &&
    '_refreshToken' in user._internalSession
  );
}

/**
 * Map Stack Auth errors to Supabase error format
 * This is Stack Auth-specific logic
 */
function normalizeStackAuthError(
  error: StackAuthErrorResponse | Error | unknown
): AuthError {
  // Handle Stack Auth's { status: 'error', error: { message } } format
  if (
    error !== null &&
    error !== undefined &&
    typeof error === 'object' &&
    'status' in error &&
    error.status === 'error' &&
    'error' in error &&
    error.error !== null &&
    error.error !== undefined &&
    typeof error.error === 'object' &&
    'message' in error.error
  ) {
    const stackError = error as StackAuthErrorResponse;
    const message = stackError.error.message || 'Authentication failed';

    // Use httpStatus from response if available, otherwise infer from message
    let status = stackError.httpStatus || 400;
    let code = 'unknown_error';

    // Map HTTP status codes to error codes
    if (status === 429) {
      code = 'over_request_rate_limit';
    } else if (status === 422) {
      code = 'user_already_exists';
    } else if (status === 404) {
      code = 'user_not_found';
    } else if (status === 401) {
      code = 'bad_jwt';
    } else {
      // Fall back to message-based detection if no httpStatus or it's generic
      if (
        message.includes('Invalid login credentials') ||
        message.includes('incorrect')
      ) {
        code = 'invalid_credentials';
        status = 400;
      } else if (
        message.includes('already exists') ||
        message.includes('already registered')
      ) {
        code = 'user_already_exists';
        status = 422;
      } else if (message.includes('not found')) {
        code = 'user_not_found';
        status = 404;
      } else if (message.includes('token') && message.includes('invalid')) {
        code = 'bad_jwt';
        status = 401;
      } else if (message.includes('token') && message.includes('expired')) {
        code = 'bad_jwt';
        status = 401;
      } else if (
        message.includes('rate limit') ||
        message.includes('Too many requests')
      ) {
        code = 'over_request_rate_limit';
        status = 429;
      } else if (message.includes('email') && message.includes('invalid')) {
        code = 'email_address_invalid';
        status = 400;
      }
    }

    return new AuthApiError(message, status, code);
  }

  // Handle standard Error objects (Stack Auth SDK might throw these)
  if (error instanceof Error) {
    const message = error.message;
    let status = 500;
    let code = 'unexpected_failure';

    // Parse error message to determine status and code
    if (
      message.includes('already exists') ||
      message.includes('already registered')
    ) {
      status = 422;
      code = 'user_already_exists';
    } else if (
      message.includes('Invalid login credentials') ||
      message.includes('incorrect')
    ) {
      status = 400;
      code = 'invalid_credentials';
    } else if (message.includes('not found')) {
      status = 404;
      code = 'user_not_found';
    } else if (message.includes('token') && message.includes('invalid')) {
      status = 401;
      code = 'bad_jwt';
    } else if (message.includes('token') && message.includes('expired')) {
      status = 401;
      code = 'bad_jwt';
    } else if (
      message.includes('rate limit') ||
      message.includes('Too many requests') ||
      message.includes('too many requests')
    ) {
      status = 429;
      code = 'over_request_rate_limit';
    } else if (message.includes('email') && message.includes('invalid')) {
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
 * Stack Auth adapter implementing the AuthClient interface
 */
export class StackAuthAdapter<
  HasTokenStore extends boolean = boolean,
  ProjectId extends string = string,
> implements AuthClient
{
  //#region Public Properties
  stackAuth: StackAuthClient;

  // Admin API (unsupported)
  admin: AuthClient['admin'] = undefined as never;

  // MFA API (unsupported)
  mfa: AuthClient['mfa'] = undefined as never;

  // OAuth API (unsupported)
  oauth: AuthClient['oauth'] = undefined as never;
  //#endregion

  //#region Private Fields
  // Auth state change management
  private stateChangeEmitters = new Map<string, Subscription>();
  private broadcastChannel: InstanceType<typeof BroadcastChannel> | null = null;
  private tokenRefreshCheckInterval: NodeJS.Timeout | null = null;
  private config: OnAuthStateChangeConfig = {
    enableTokenRefreshDetection: true, // Enabled by default (matches Supabase)
    tokenRefreshCheckInterval: 30_000, // 30 seconds (matches Supabase)
  };
  //#endregion

  //#region Constructor
  constructor(
    params: StackServerAppConstructorOptions<HasTokenStore, ProjectId>,
    config?: OnAuthStateChangeConfig
  ) {
    // Merge config
    if (config) {
      this.config = { ...this.config, ...config };
    }

    this.stackAuth = params.secretServerKey
      ? (new StackServerApp(params) as StackAuthClient)
      : (new StackClientApp(params) as StackAuthClient);
  }
  //#endregion

  // Initialization
  initialize: AuthClient['initialize'] = async () => {
    try {
      // Stack Auth doesn't require explicit initialization
      // Check if we have a valid session
      const session = await this.getSession();

      return {
        data: session.data,
        error: session.error,
      };
    } catch (error) {
      return {
        data: { session: null },
        error: normalizeStackAuthError(error),
      };
    }
  };

  // Sign up
  signUp: AuthClient['signUp'] = async (credentials) => {
    try {
      // Handle email/password sign-up
      if ('email' in credentials && credentials.email && credentials.password) {
        // Stack Auth requires verificationCallbackUrl in non-browser environments
        const verificationCallbackUrl =
          credentials.options?.emailRedirectTo ||
          this.stackAuth.urls.emailVerification;

        const result = await this.stackAuth.signUpWithCredential({
          email: credentials.email,
          password: credentials.password,
          noRedirect: true,
          verificationCallbackUrl,
        });

        if (result.status === 'error') {
          return {
            data: { user: null, session: null },
            error: normalizeStackAuthError(result),
          };
        }

        // Set user metadata after signup if provided
        // Stack Auth's signUpWithCredential doesn't support metadata parameter
        if (credentials.options?.data) {
          const user = await this.stackAuth.getUser();
          if (user) {
            await user.update({
              clientMetadata: credentials.options.data as ReadonlyJson,
            });
          }
        }

        // Fetch fresh session with full user metadata
        const sessionResult = await this._fetchFreshSession();

        if (!sessionResult.data.session?.user) {
          return {
            data: { user: null, session: null },
            error: new AuthError(
              'Failed to retrieve user session',
              500,
              'unexpected_failure'
            ),
          };
        }

        const data = {
          user: sessionResult.data.session.user,
          session: sessionResult.data.session,
        };

        // Emit SIGNED_IN event
        await this.notifyAllSubscribers(
          'SIGNED_IN',
          sessionResult.data.session
        );

        return { data, error: null };
      }
      // Handle phone sign-up
      else if ('phone' in credentials && credentials.phone) {
        return {
          data: { user: null, session: null },
          error: new AuthError(
            'Phone sign-up not supported',
            501,
            'phone_provider_disabled'
          ),
        };
      } else {
        return {
          data: { user: null, session: null },
          error: new AuthError(
            'Invalid credentials format',
            400,
            'validation_failed'
          ),
        };
      }
    } catch (error) {
      return {
        data: { user: null, session: null },
        error: normalizeStackAuthError(error),
      };
    }
  };

  // Sign in methods
  signInAnonymously: AuthClient['signInAnonymously'] = async () => {
    // Stack Auth doesn't support anonymous sign-in
    return {
      data: { user: null, session: null },
      error: new AuthError(
        'Anonymous sign-in is not supported by Stack Auth',
        501,
        'anonymous_provider_disabled'
      ),
    };
  };

  signInWithPassword: AuthClient['signInWithPassword'] = async (
    credentials
  ) => {
    try {
      // Handle email/password sign-in
      if ('email' in credentials && credentials.email) {
        const result = await this.stackAuth.signInWithCredential({
          email: credentials.email,
          password: credentials.password,
          noRedirect: true,
        });

        if (result.status === 'error') {
          return {
            data: { user: null, session: null },
            error: normalizeStackAuthError(result),
          };
        }

        // Fetch fresh session with full user metadata
        const sessionResult = await this._fetchFreshSession();

        if (!sessionResult.data.session?.user) {
          return {
            data: { user: null, session: null },
            error: new AuthError(
              'Failed to retrieve user session',
              500,
              'unexpected_failure'
            ),
          };
        }

        const data = {
          user: sessionResult.data.session.user,
          session: sessionResult.data.session,
        };

        // Emit SIGNED_IN event
        await this.notifyAllSubscribers(
          'SIGNED_IN',
          sessionResult.data.session
        );

        return { data, error: null };
      }
      // Handle phone/password sign-in
      else if ('phone' in credentials && credentials.phone) {
        return {
          data: { user: null, session: null },
          error: new AuthError(
            'Phone sign-in not supported',
            501,
            'phone_provider_disabled'
          ),
        };
      } else {
        return {
          data: { user: null, session: null },
          error: new AuthError(
            'Invalid credentials format',
            400,
            'validation_failed'
          ),
        };
      }
    } catch (error) {
      return {
        data: { user: null, session: null },
        error: normalizeStackAuthError(error),
      };
    }
  };

  signInWithOAuth: AuthClient['signInWithOAuth'] = async (credentials) => {
    try {
      const { provider, options } = credentials;

      // Note: SIGNED_IN event will not fire here because OAuth redirects.
      // Event will fire when session is detected after redirect callback.

      // Stack Auth uses signInWithOAuth method
      await this.stackAuth.signInWithOAuth(provider, {
        returnTo: options?.redirectTo,
      });

      // OAuth redirects the user, so we return success immediately
      // The actual session will be available after OAuth callback
      return {
        data: {
          provider,
          url: options?.redirectTo || '', // Stack Auth handles the redirect internally
        },
        error: null,
      };
    } catch (error) {
      return {
        data: {
          provider: credentials.provider,
          url: null,
        },
        error: normalizeStackAuthError(error),
      };
    }
  };

  signInWithOtp: AuthClient['signInWithOtp'] = async (credentials) => {
    try {
      // Note: SIGNED_IN event will not fire here because OTP requires email verification.
      // Event will fire when session is detected after user clicks magic link.

      // Handle email OTP/Magic Link
      if ('email' in credentials && credentials.email) {
        // Stack Auth provides default callback URLs (e.g., "/handler/magic-link-callback")
        // Use provided emailRedirectTo or fall back to Stack Auth's configured/default magicLinkCallback
        const callbackUrl =
          credentials.options?.emailRedirectTo ||
          this.stackAuth.urls.magicLinkCallback;

        const result = await this.stackAuth.sendMagicLinkEmail(
          credentials.email,
          {
            callbackUrl,
          }
        );

        if (result.status === 'error') {
          return {
            data: {
              user: null,
              session: null,
              messageId: undefined,
            },
            error: normalizeStackAuthError(result),
          };
        }

        return {
          data: {
            user: null,
            session: null,
            messageId: undefined, // Stack Auth doesn't return message ID
          },
          error: null,
        };
      }
      // Handle phone OTP
      else if ('phone' in credentials && credentials.phone) {
        return {
          data: {
            user: null,
            session: null,
            messageId: undefined,
          },
          error: new AuthError(
            'Phone OTP not supported',
            501,
            'phone_provider_disabled'
          ),
        };
      } else {
        return {
          data: {
            user: null,
            session: null,
            messageId: undefined,
          },
          error: new AuthError(
            'Invalid credentials format',
            400,
            'validation_failed'
          ),
        };
      }
    } catch (error) {
      return {
        data: {
          user: null,
          session: null,
          messageId: undefined,
        },
        error: normalizeStackAuthError(error),
      };
    }
  };

  signInWithIdToken: AuthClient['signInWithIdToken'] = async (credentials) => {
    /**
     * Stack Auth does not support direct OIDC ID token authentication.
     *
     * Supabase's signInWithIdToken accepts pre-existing OIDC ID tokens from providers like:
     * - Google, Apple, Azure, Facebook, Kakao, Keycloak
     * - Validates the ID token server-side
     * - Can handle tokens with at_hash (requires access_token) and nonce claims
     *
     * Stack Auth uses OAuth authorization code flow with redirects instead:
     * - Requires redirecting users to the OAuth provider
     * - Handles the OAuth callback to exchange authorization code for tokens
     * - Does not accept pre-existing ID tokens directly
     *
     * For OAuth providers, use signInWithOAuth instead:
     * ```
     * await authAdapter.signInWithOAuth({ provider: 'google', options: { redirectTo: '...' } });
     * ```
     */

    // Log what was attempted for debugging
    const attemptedProvider = credentials.provider;
    const hasAccessToken = !!credentials.access_token;
    const hasNonce = !!credentials.nonce;

    return {
      data: {
        user: null,
        session: null,
      },
      error: new AuthError(
        `Stack Auth does not support OIDC ID token authentication. Attempted with provider: ${attemptedProvider}${hasAccessToken ? ' (with access_token)' : ''}${hasNonce ? ' (with nonce)' : ''}. ` +
          `Stack Auth uses OAuth authorization code flow and does not accept pre-existing ID tokens. ` +
          `Please use signInWithOAuth() to redirect users to the OAuth provider for authentication.`,
        501,
        'id_token_provider_disabled'
      ),
    };
  };

  signInWithSSO: AuthClient['signInWithSSO'] = async (params) => {
    /**
     * Stack Auth does not support enterprise SAML SSO providers like Supabase does.
     *
     * Supabase's signInWithSSO is designed for enterprise identity providers (SAML 2.0)
     * that can be identified by:
     * - providerId: UUID of a SAML SSO provider
     * - domain: Company domain associated with the SAML provider
     *
     * Stack Auth only supports OAuth social providers (Google, GitHub, Microsoft, etc.)
     * via the signInWithOAuth method.
     *
     * For OAuth providers, use signInWithOAuth instead:
     * ```
     * await authAdapter.signInWithOAuth({ provider: 'google', options: { redirectTo: '...' } });
     * ```
     */

    // Log what was attempted for debugging
    const attemptedWith =
      'providerId' in params
        ? `provider ID: ${params.providerId}`
        : `domain: ${'domain' in params ? params.domain : 'unknown'}`;

    return {
      data: null,
      error: new AuthError(
        `Stack Auth does not support enterprise SAML SSO. Attempted with ${attemptedWith}. ` +
          `Stack Auth only supports OAuth social providers (Google, GitHub, Microsoft, etc.). ` +
          `Please use signInWithOAuth() for OAuth providers instead.`,
        501,
        'sso_provider_disabled'
      ),
    };
  };

  signInWithWeb3: AuthClient['signInWithWeb3'] = async (credentials) => {
    /**
     * Stack Auth does not support Web3/crypto wallet authentication (Ethereum, Solana, etc.)
     *
     * Supabase's signInWithWeb3 enables authentication with crypto wallets like:
     * - Ethereum: MetaMask, WalletConnect, Coinbase Wallet (using EIP-1193)
     * - Solana: Phantom, Solflare (using Sign-In with Solana standard)
     *
     * Stack Auth only supports:
     * - OAuth social providers (Google, GitHub, Microsoft, etc.)
     * - Email/Password credentials
     * - Magic link (passwordless email)
     * - Passkey/WebAuthn
     * - Anonymous sign-in
     *
     * For OAuth providers, use signInWithOAuth instead:
     * ```
     * await authAdapter.signInWithOAuth({ provider: 'google', options: { redirectTo: '...' } });
     * ```
     */

    // Log what was attempted for debugging
    const attemptedChain = credentials.chain;

    return {
      data: {
        user: null,
        session: null,
      },
      error: new AuthError(
        `Stack Auth does not support Web3 authentication. Attempted with chain: ${attemptedChain}. ` +
          `Stack Auth does not support crypto wallet sign-in (Ethereum, Solana, etc.). ` +
          `Supported authentication methods: OAuth, email/password, magic link, passkey, or anonymous. ` +
          `For social authentication, please use signInWithOAuth() instead.`,
        501,
        'web3_provider_disabled'
      ),
    };
  };

  // Sign out
  signOut: AuthClient['signOut'] = async () => {
    try {
      // by using the internal API, we can avoid fetching the user data
      // the default API is `await user.signOut();`
      const internalSession = await this._getSessionFromStackAuthInternals();
      if (!internalSession) {
        throw new AuthError('No session found', 401, 'session_not_found');
      }

      // Sign out using internal API
      await this.stackAuth._interface.signOut(internalSession);
      // Emit SIGNED_OUT event
      await this.notifyAllSubscribers('SIGNED_OUT', null);

      return { error: null };
    } catch (error) {
      return { error: normalizeStackAuthError(error) };
    }
  };

  // Verification
  verifyOtp: AuthClient['verifyOtp'] = async (params) => {
    try {
      // Handle email OTP verification
      if ('email' in params && params.email) {
        const { token, type } = params;

        // Magic link verification - Stack Auth uses signInWithMagicLink
        if (type === 'magiclink' || type === 'email') {
          // Get or create internal session for sign-in
          let internalSession = await this._getSessionFromStackAuthInternals();

          if (!internalSession) {
            // Create a new session if none exists - but without refreshAccessTokenCallback
            // as it's omitted in the createSession method
            internalSession = this.stackAuth._interface.createSession({
              refreshToken: null,
              accessToken: null,
            });
          }

          // Use the internal API to sign in with magic link code
          // This automatically stores the session internally
          const result = await this.stackAuth._interface.signInWithMagicLink(
            token,
            internalSession
          );

          if (result.status === 'error') {
            return {
              data: { user: null, session: null },
              error: normalizeStackAuthError(result),
            };
          }

          // Stack Auth's signInWithMagicLink handles session storage internally
          // Just retrieve the current session which should now be populated
          const sessionResult = await this.getSession();

          if (!sessionResult.data.session) {
            return {
              data: { user: null, session: null },
              error: new AuthError(
                'Failed to retrieve session after OTP verification',
                500,
                'unexpected_failure'
              ),
            };
          }

          // Emit SIGNED_IN event
          await this.notifyAllSubscribers(
            'SIGNED_IN',
            sessionResult.data.session
          );

          return {
            data: {
              user: sessionResult.data.session.user,
              session: sessionResult.data.session,
            },
            error: null,
          };
        }

        // Email verification (signup confirmation)
        if (type === 'signup' || type === 'invite') {
          const result = await this.stackAuth._interface.verifyEmail(token);

          if (result.status === 'error') {
            return {
              data: { user: null, session: null },
              error: normalizeStackAuthError(result),
            };
          }

          // After email verification, user might be signed in already
          // Return current session if available
          const sessionResult = await this.getSession();

          return {
            data: {
              user: sessionResult.data.session?.user ?? null,
              session: sessionResult.data.session,
            },
            error: null,
          };
        }

        // Password recovery verification
        if (type === 'recovery') {
          // Stack Auth's resetPassword can verify the code without resetting
          const result = await this.stackAuth._interface.resetPassword({
            code: token,
            onlyVerifyCode: true,
          });

          if (result.status === 'error') {
            return {
              data: { user: null, session: null },
              error: normalizeStackAuthError(result),
            };
          }

          // For recovery, we verify the code but don't create a session yet
          // The user needs to reset their password first
          return {
            data: {
              user: null,
              session: null,
            },
            error: null,
          };
        }

        // Email change verification
        if (type === 'email_change') {
          // Stack Auth doesn't have a direct email_change verification
          // But we can use verifyEmail as it handles contact channel verification
          const result = await this.stackAuth._interface.verifyEmail(token);

          if (result.status === 'error') {
            return {
              data: { user: null, session: null },
              error: normalizeStackAuthError(result),
            };
          }

          // Get updated session
          const sessionResult = await this.getSession();

          // Emit USER_UPDATED event
          await this.notifyAllSubscribers(
            'USER_UPDATED',
            sessionResult.data.session
          );

          return {
            data: {
              user: sessionResult.data.session?.user ?? null,
              session: sessionResult.data.session,
            },
            error: null,
          };
        }

        return {
          data: { user: null, session: null },
          error: new AuthError(
            `Unsupported email OTP type: ${type}`,
            400,
            'validation_failed'
          ),
        };
      }

      // Handle phone OTP verification
      if ('phone' in params && params.phone) {
        return {
          data: { user: null, session: null },
          error: new AuthError(
            'Phone OTP verification not supported by Stack Auth',
            501,
            'phone_provider_disabled'
          ),
        };
      }

      // Handle token hash verification
      if ('token_hash' in params && params.token_hash) {
        // Token hash is similar to token, treat it the same way
        const { token_hash, type } = params;

        // Magic link token hash verification
        if (type === 'magiclink' || type === 'email') {
          let internalSession = await this._getSessionFromStackAuthInternals();

          if (!internalSession) {
            internalSession = this.stackAuth._interface.createSession({
              refreshToken: null,
              accessToken: null,
            });
          }

          const result = await this.stackAuth._interface.signInWithMagicLink(
            token_hash,
            internalSession
          );

          if (result.status === 'error') {
            return {
              data: { user: null, session: null },
              error: normalizeStackAuthError(result),
            };
          }

          // Stack Auth's signInWithMagicLink handles session storage internally
          // Just retrieve the current session
          const sessionResult = await this.getSession();

          if (!sessionResult.data.session) {
            return {
              data: { user: null, session: null },
              error: new AuthError(
                'Failed to retrieve session after token hash verification',
                500,
                'unexpected_failure'
              ),
            };
          }

          // Emit SIGNED_IN event
          await this.notifyAllSubscribers(
            'SIGNED_IN',
            sessionResult.data.session
          );

          return {
            data: {
              user: sessionResult.data.session.user,
              session: sessionResult.data.session,
            },
            error: null,
          };
        }

        // For other token hash types, use similar logic as email verification
        if (type === 'signup' || type === 'invite') {
          const result =
            await this.stackAuth._interface.verifyEmail(token_hash);

          if (result.status === 'error') {
            return {
              data: { user: null, session: null },
              error: normalizeStackAuthError(result),
            };
          }

          const sessionResult = await this.getSession();

          return {
            data: {
              user: sessionResult.data.session?.user ?? null,
              session: sessionResult.data.session,
            },
            error: null,
          };
        }

        if (type === 'recovery') {
          const result = await this.stackAuth._interface.resetPassword({
            code: token_hash,
            onlyVerifyCode: true,
          });

          if (result.status === 'error') {
            return {
              data: { user: null, session: null },
              error: normalizeStackAuthError(result),
            };
          }

          return {
            data: {
              user: null,
              session: null,
            },
            error: null,
          };
        }

        if (type === 'email_change') {
          const result =
            await this.stackAuth._interface.verifyEmail(token_hash);

          if (result.status === 'error') {
            return {
              data: { user: null, session: null },
              error: normalizeStackAuthError(result),
            };
          }

          const sessionResult = await this.getSession();

          await this.notifyAllSubscribers(
            'USER_UPDATED',
            sessionResult.data.session
          );

          return {
            data: {
              user: sessionResult.data.session?.user ?? null,
              session: sessionResult.data.session,
            },
            error: null,
          };
        }

        return {
          data: { user: null, session: null },
          error: new AuthError(
            `Unsupported token hash OTP type: ${type}`,
            400,
            'validation_failed'
          ),
        };
      }

      // Invalid params
      return {
        data: { user: null, session: null },
        error: new AuthError(
          'Invalid OTP verification parameters',
          400,
          'validation_failed'
        ),
      };
    } catch (error) {
      return {
        data: { user: null, session: null },
        error: normalizeStackAuthError(error),
      };
    }
  };

  // Session management
  /**
   * Fetches fresh session data from Stack Auth API.
   * Always makes a network request to get the latest user metadata.
   * Used when we need fresh data (after setSession, refreshSession, etc.)
   */
  getSession: AuthClient['getSession'] = async () => {
    try {
      // Step 1: Try to get cached tokens (fast path - no network request)
      const cachedTokens = await this._getCachedTokensFromStackAuthInternals();
      if (cachedTokens?.accessToken) {
        const payload = accessTokenSchema.parse(
          JSON.parse(atob(cachedTokens.accessToken.split('.')[1]))
        );

        const session: Session = {
          access_token: cachedTokens.accessToken,
          // ATTENTION: we allow sessions without refresh token
          refresh_token: cachedTokens.refreshToken ?? '',
          expires_at: payload.exp,
          expires_in: Math.max(0, payload.exp - Math.floor(Date.now() / 1000)),
          token_type: 'bearer' as const,
          user: {
            id: payload.sub,
            email: payload.email || '',
            created_at: new Date(payload.iat * 1000).toISOString(),
            aud: 'authenticated',
            role: 'authenticated',
            app_metadata: {},
            user_metadata: {},
          },
        };

        return { data: { session }, error: null };
      }

      // Step 2: Fallback - fetch fresh session with full metadata (slow path)
      return await this._fetchFreshSession();
    } catch (error) {
      console.error('Error getting session:', error);
      return { data: { session: null }, error: normalizeStackAuthError(error) };
    }
  };

  refreshSession: AuthClient['refreshSession'] = async () => {
    try {
      // Stack Auth handles token refresh automatically
      // We just need to get the current session which will be fresh
      const sessionResult = await this.getSession();

      if (sessionResult.error) {
        return {
          data: { user: null, session: null },
          error: sessionResult.error,
        };
      }

      return {
        data: {
          user: sessionResult.data.session?.user ?? null,
          session: sessionResult.data.session,
        },
        error: null,
      };
    } catch (error) {
      return {
        data: { user: null, session: null },
        error: normalizeStackAuthError(error),
      };
    }
  };

  setSession: AuthClient['setSession'] = async () => {
    // Stack Auth doesn't support setting sessions from external tokens
    // Sessions are managed internally by Stack Auth
    return {
      data: { user: null, session: null },
      error: new AuthError(
        'Setting external sessions is not supported by Stack Auth',
        501,
        'not_implemented'
      ),
    };
  };

  // User management
  getUser: AuthClient['getUser'] = async () => {
    try {
      const user = await this.stackAuth.getUser();

      if (!user) {
        return {
          data: { user: null },
          error: new AuthError(
            'No user session found',
            401,
            'session_not_found'
          ),
        };
      }

      return {
        data: {
          user: {
            id: user.id,
            aud: 'authenticated',
            role: 'authenticated',
            email: user.primaryEmail || '',
            email_confirmed_at: user.primaryEmailVerified
              ? toISOString(user.signedUpAt)
              : undefined,
            phone: undefined,
            confirmed_at: user.primaryEmailVerified
              ? toISOString(user.signedUpAt)
              : undefined,
            last_sign_in_at: toISOString(user.signedUpAt),
            app_metadata: {},
            user_metadata: {
              ...user.clientMetadata,
              ...(user.displayName ? { displayName: user.displayName } : {}),
              ...(user.profileImageUrl
                ? { profileImageUrl: user.profileImageUrl }
                : {}),
            },
            identities: [],
            created_at: toISOString(user.signedUpAt),
            updated_at: toISOString(user.signedUpAt),
          },
        },
        error: null,
      };
    } catch (error) {
      return {
        data: { user: null },
        error: normalizeStackAuthError(error),
      };
    }
  };

  getClaims: AuthClient['getClaims'] = async () => {
    try {
      const user = await this.stackAuth.getUser();

      if (!user) {
        return {
          data: null,
          error: new AuthError(
            'No user session found',
            401,
            'session_not_found'
          ),
        };
      }

      // OPTIMIZATION: Try to get cached token first
      let accessToken: string | null = null;

      if (hasInternalSession(user)) {
        // Fast path: Use cached token if available
        const internalSession = user._internalSession;
        const cachedToken = internalSession.getAccessTokenIfNotExpiredYet(0);
        accessToken = cachedToken?.token ?? null;
      }

      if (!accessToken) {
        // Slow path: Fetch fresh tokens (may trigger refresh)
        const tokens = await user.currentSession.getTokens();
        // Public API returns strings directly
        accessToken = tokens.accessToken;
      }

      if (!accessToken) {
        return {
          data: null,
          error: new AuthError(
            'No access token found',
            401,
            'session_not_found'
          ),
        };
      }

      // Decode JWT to get claims (basic implementation)
      const tokenParts = accessToken.split('.');
      if (tokenParts.length !== 3) {
        return {
          data: null,
          error: new AuthError('Invalid token format', 401, 'bad_jwt'),
        };
      }

      try {
        const payload = JSON.parse(atob(tokenParts[1]));
        return {
          data: payload,
          error: null,
        };
      } catch {
        return {
          data: null,
          error: new AuthError('Failed to decode token', 401, 'bad_jwt'),
        };
      }
    } catch (error) {
      return {
        data: null,
        error: normalizeStackAuthError(error),
      };
    }
  };

  /**
   * Get JWT token for API authentication
   *
   * Uses cached token if valid, otherwise fetches fresh token.
   * This method should be used by client factory instead of getSession() to avoid
   * unnecessary session fetches on every API request.
   *
   * @returns JWT token string, or null if no session exists
   */
  getJwtToken: AuthClient['getJwtToken'] = async () => {
    try {
      const user = await this.stackAuth.getUser();

      if (!user) {
        return null;
      }

      // OPTIMIZATION: Try to get cached token first
      let accessToken: string | null = null;

      if (hasInternalSession(user)) {
        // Fast path: Use cached token if available
        const internalSession = user._internalSession;
        const cachedToken = internalSession.getAccessTokenIfNotExpiredYet(0);
        accessToken = cachedToken?.token ?? null;
      }

      if (!accessToken) {
        // Slow path: Fetch fresh tokens (may trigger refresh)
        const tokens = await user.currentSession.getTokens();
        // Public API returns strings directly
        accessToken = tokens.accessToken;
      }

      return accessToken;
    } catch (_error) {
      return null;
    }
  };

  updateUser: AuthClient['updateUser'] = async (attributes) => {
    try {
      const user = await this.stackAuth.getUser();

      if (!user) {
        return {
          data: { user: null },
          error: new AuthError(
            'No user session found',
            401,
            'session_not_found'
          ),
        };
      }

      // Handle password update separately
      // Note: Supabase requires a nonce from reauthenticate() for password changes
      // Stack Auth doesn't support nonce-based reauthentication, but requires oldPassword
      // We cannot safely change passwords without verification
      if (attributes.password) {
        return {
          data: { user: null },
          error: new AuthError(
            'Password updates require reauthentication. Stack Auth does not support the nonce-based reauthentication flow (reauthenticate() method). ' +
              'For password changes, users must: 1) Sign out, 2) Use "Forgot Password" flow (resetPasswordForEmail), or ' +
              '3) Use Stack Auth directly with updatePassword({ oldPassword, newPassword }).',
            400,
            'feature_not_supported'
          ),
        };
      }

      // Map Supabase attributes to Stack Auth update format
      const updateData: StackAuthUserUpdateOptions = {};

      if (attributes.data) {
        // Handle user metadata - Stack Auth uses clientMetadata
        const data = attributes.data;
        if (
          data &&
          'displayName' in data &&
          typeof data.displayName === 'string'
        ) {
          updateData.displayName = data.displayName;
        }
        if (
          data &&
          'profileImageUrl' in data &&
          typeof data.profileImageUrl === 'string'
        ) {
          updateData.profileImageUrl = data.profileImageUrl;
        }
        // Store other metadata in clientMetadata
        updateData.clientMetadata = {
          ...user.clientMetadata,
          ...attributes.data,
        };
      }

      // Update the user (excludes email and password which are handled separately)
      await user.update(updateData);

      // Note: Email updates are not supported in Stack Auth's client API
      // They require server-side setPrimaryEmail method
      if (attributes.email) {
        console.warn(
          'Email updates require server-side Stack Auth configuration'
        );
      }

      // Get the updated user
      const updatedUser = await this.stackAuth.getUser();

      if (!updatedUser) {
        throw new Error('Failed to retrieve updated user');
      }

      const user_metadata = {
        ...updatedUser.clientMetadata,
        ...(updatedUser.displayName
          ? { displayName: updatedUser.displayName }
          : {}),
        ...(updatedUser.profileImageUrl
          ? { profileImageUrl: updatedUser.profileImageUrl }
          : {}),
      };

      const data = {
        user: {
          id: updatedUser.id,
          aud: 'authenticated',
          role: 'authenticated',
          email: updatedUser.primaryEmail || '',
          email_confirmed_at: updatedUser.primaryEmailVerified
            ? toISOString(updatedUser.signedUpAt)
            : undefined,
          phone: undefined,
          confirmed_at: updatedUser.primaryEmailVerified
            ? toISOString(updatedUser.signedUpAt)
            : undefined,
          last_sign_in_at: toISOString(updatedUser.signedUpAt),
          app_metadata: {},
          user_metadata,
          identities: [],
          created_at: toISOString(updatedUser.signedUpAt),
          updated_at: toISOString(updatedUser.signedUpAt),
        },
      };

      // Get updated session
      const sessionResult = await this.getSession();

      // Emit USER_UPDATED event
      await this.notifyAllSubscribers(
        'USER_UPDATED',
        sessionResult.data.session
      );

      return { data, error: null };
    } catch (error) {
      return {
        data: { user: null },
        error: normalizeStackAuthError(error),
      };
    }
  };

  getUserIdentities: AuthClient['getUserIdentities'] = async () => {
    try {
      const user = await this.stackAuth.getUser();

      if (!user) {
        return {
          data: null,
          error: new AuthError(
            'No user session found',
            401,
            'session_not_found'
          ),
        };
      }

      // Stack Auth provides listOAuthProviders() method to get connected accounts
      const oauthProviders = await user.listOAuthProviders();

      // Map Stack Auth's OAuth providers to Supabase's UserIdentity format
      const identities = oauthProviders.map((provider) => ({
        id: provider.id, // Unique identity ID from Stack Auth
        user_id: user.id, // User ID from Stack Auth
        identity_id: provider.id, // Same as id for compatibility
        provider: provider.type, // Provider type (e.g., "google", "github")
        identity_data: {
          email: provider.email || null,
          account_id: provider.accountId || null,
          provider_type: provider.type,
          user_id: provider.userId,
          allow_sign_in: provider.allowSignIn,
          allow_connected_accounts: provider.allowConnectedAccounts,
        },
        // Stack Auth doesn't provide timestamps for OAuth connections,
        // so we use the user's sign-up time as a fallback
        created_at: toISOString(user.signedUpAt),
        last_sign_in_at: toISOString(user.signedUpAt),
        updated_at: toISOString(user.signedUpAt),
      }));

      return {
        data: { identities },
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: normalizeStackAuthError(error),
      };
    }
  };

  linkIdentity: AuthClient['linkIdentity'] = async (credentials) => {
    try {
      const user = await this.stackAuth.getUser();

      if (!user) {
        return {
          data: { provider: credentials.provider, url: null },
          error: new AuthError(
            'No user session found',
            401,
            'session_not_found'
          ),
        };
      }

      // Stack Auth uses getConnectedAccount to link OAuth providers
      // The 'redirect' option will initiate the OAuth flow to connect the account
      // Note: This method triggers a redirect in the browser to connect the OAuth account

      // Convert scopes from Supabase format (space-separated string) to Stack Auth format (array)
      const scopes = credentials.options?.scopes
        ? credentials.options.scopes.split(' ')
        : undefined;

      // requires type assertion, because the Providers supported by Supabase and StackAuth are not 100% the same
      await user.getConnectedAccount(credentials.provider as ProviderType, {
        or: 'redirect',
        scopes,
      });

      // Similar to signInWithOAuth, this redirects the user to the OAuth provider
      // The actual linking happens after the OAuth callback
      return {
        data: {
          provider: credentials.provider,
          url: credentials.options?.redirectTo || '', // Stack Auth handles redirect internally
        },
        error: null,
      };
    } catch (error) {
      return {
        data: { provider: credentials.provider, url: null },
        error: normalizeStackAuthError(error),
      };
    }
  };

  unlinkIdentity: AuthClient['unlinkIdentity'] = async (identity) => {
    try {
      const user = await this.stackAuth.getUser();

      if (!user) {
        return {
          data: null,
          error: new AuthError(
            'No user session found',
            401,
            'session_not_found'
          ),
        };
      }

      // Stack Auth provides getOAuthProvider to retrieve a specific OAuth provider by ID
      const provider = await user.getOAuthProvider(identity.identity_id);

      if (!provider) {
        return {
          data: null,
          error: new AuthError(
            `OAuth provider with ID ${identity.identity_id} not found`,
            404,
            'identity_not_found'
          ),
        };
      }

      // Delete the OAuth provider (unlink the identity)
      await provider.delete();

      // Get updated session after unlinking
      const sessionResult = await this.getSession();

      // Emit USER_UPDATED event to notify subscribers
      await this.notifyAllSubscribers(
        'USER_UPDATED',
        sessionResult.data.session
      );

      return {
        data: {},
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: normalizeStackAuthError(error),
      };
    }
  };

  // Password reset
  resetPasswordForEmail: AuthClient['resetPasswordForEmail'] = async (
    email,
    options
  ) => {
    try {
      const result = await this.stackAuth.sendForgotPasswordEmail(email, {
        callbackUrl: options?.redirectTo,
      });

      if (result.status === 'error') {
        return {
          data: null,
          error: normalizeStackAuthError(result),
        };
      }

      return {
        data: {},
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: normalizeStackAuthError(error),
      };
    }
  };

  reauthenticate: AuthClient['reauthenticate'] = async () => {
    // Stack Auth does not support reauthentication with OTP/nonce flow
    //
    // Supabase's reauthenticate() sends an OTP to verify the user still controls
    // their email/phone and returns a nonce for use with updateUser({ password, nonce }).
    //
    // Stack Auth uses a different security model where password updates require
    // the old password directly via user.updatePassword({ oldPassword, newPassword }).
    //
    // Since we cannot implement the nonce-based flow, updateUser({ password }) will
    // also return an error directing users to use the password reset flow instead.
    return {
      data: { user: null, session: null },
      error: new AuthError(
        'Stack Auth does not support nonce-based reauthentication. For password changes, use the password reset flow (resetPasswordForEmail) or access Stack Auth directly.',
        400,
        'feature_not_supported'
      ),
    };
  };

  // Resend
  resend: AuthClient['resend'] = async (credentials) => {
    try {
      // Handle email resend
      if ('email' in credentials) {
        const { email, type, options } = credentials;

        // For signup verification
        if (type === 'signup') {
          // Try to get current user
          const user = await this.stackAuth.getUser();

          if (user && user.primaryEmail === email) {
            // User is logged in and email matches - resend verification
            await user.sendVerificationEmail();
          } else {
            // No session or different email - send magic link as verification
            const result = await this.stackAuth.sendMagicLinkEmail(email, {
              callbackUrl: options?.emailRedirectTo,
            });

            if (result.status === 'error') {
              return {
                data: { user: null, session: null },
                error: normalizeStackAuthError(result),
              };
            }
          }

          return {
            data: { user: null, session: null },
            error: null,
          };
        }

        // For email_change verification
        if (type === 'email_change') {
          const user = await this.stackAuth.getUser();

          if (!user) {
            return {
              data: { user: null, session: null },
              error: new AuthError(
                'No user session found',
                401,
                'session_not_found'
              ),
            };
          }

          // Get contact channels and find the one for this email
          const contactChannels = await user.listContactChannels();
          const targetChannel = contactChannels.find(
            (ch) => ch.value === email && ch.type === 'email'
          );

          if (!targetChannel) {
            return {
              data: { user: null, session: null },
              error: new AuthError(
                'Email not found in user contact channels',
                404,
                'email_not_found'
              ),
            };
          }

          // Send verification email for this contact channel
          await targetChannel.sendVerificationEmail({
            callbackUrl: options?.emailRedirectTo,
          });

          return {
            data: { user: null, session: null },
            error: null,
          };
        }

        // Unknown email type
        return {
          data: { user: null, session: null },
          error: new AuthError(
            `Unsupported resend type: ${type}`,
            400,
            'validation_failed'
          ),
        };
      }

      // Handle phone resend
      if ('phone' in credentials) {
        return {
          data: { user: null, session: null },
          error: new AuthError(
            'Phone OTP resend not supported by Stack Auth',
            501,
            'phone_provider_disabled'
          ),
        };
      }

      // Invalid credentials
      return {
        data: { user: null, session: null },
        error: new AuthError(
          'Invalid credentials format',
          400,
          'validation_failed'
        ),
      };
    } catch (error) {
      return {
        data: { user: null, session: null },
        error: normalizeStackAuthError(error),
      };
    }
  };

  // Auth state change
  onAuthStateChange: AuthClient['onAuthStateChange'] = (callback) => {
    // Generate unique subscription ID
    const id = crypto.randomUUID();

    // Create subscription object
    const subscription: Subscription = {
      id,
      callback,
      unsubscribe: () => {
        this.stateChangeEmitters.delete(id);

        // Clean up if no more subscribers
        if (this.stateChangeEmitters.size === 0) {
          this.stopTokenRefreshDetection();
          this.closeBroadcastChannel();
        }
      },
    };

    // Store subscription
    this.stateChangeEmitters.set(id, subscription);

    // Initialize cross-tab sync and polling if first subscriber
    if (this.stateChangeEmitters.size === 1) {
      this.initializeBroadcastChannel();
      this.startTokenRefreshDetection();
    }

    // Emit initial session immediately
    this.emitInitialSession(callback);

    // Return subscription with Supabase-compatible format
    return {
      data: {
        subscription: {
          id,
          callback,
          unsubscribe: subscription.unsubscribe,
        },
      },
    };
  };

  /**
   * Exchange an OAuth authorization code for a session.
   *
   * Note: Stack Auth handles OAuth callbacks automatically via callOAuthCallback().
   * This method delegates to Stack Auth's internal flow which:
   * - Retrieves the code and state from the current URL
   * - Retrieves the PKCE verifier from cookies (stored during signInWithOAuth)
   * - Exchanges the code for access/refresh tokens
   * - Creates and stores the user session
   *
   * @param authCode - The authorization code (Stack Auth reads this from URL automatically)
   * @returns Session data or error
   */
  exchangeCodeForSession: AuthClient['exchangeCodeForSession'] = async (
    _authCode: string
  ) => {
    try {
      // Stack Auth's callOAuthCallback() automatically:
      // - Retrieves code and state from URL parameters
      // - Retrieves code verifier from cookies (stored during signInWithOAuth)
      // - Exchanges code for tokens
      // - Updates the session
      const success = await this.stackAuth.callOAuthCallback();

      if (success) {
        const sessionResult = await this.getSession();

        if (sessionResult.data.session) {
          // Emit SIGNED_IN event
          await this.notifyAllSubscribers(
            'SIGNED_IN',
            sessionResult.data.session
          );

          return {
            data: {
              session: sessionResult.data.session,
              user: sessionResult.data.session.user,
            },
            error: null,
          };
        }
      }

      return {
        data: { session: null, user: null },
        error: new AuthError(
          'OAuth callback completed but no session was created',
          500,
          'oauth_callback_failed'
        ),
      };
    } catch (error) {
      return {
        data: { session: null, user: null },
        error: normalizeStackAuthError(error),
      };
    }
  };

  isThrowOnErrorEnabled: AuthClient['isThrowOnErrorEnabled'] = () => false;

  // Auto refresh
  startAutoRefresh: AuthClient['startAutoRefresh'] = async () => {
    // Stack Auth handles auto-refresh automatically
    // No explicit start needed
    return Promise.resolve();
  };

  stopAutoRefresh: AuthClient['stopAutoRefresh'] = async () => {
    // Stack Auth handles auto-refresh automatically
    // No explicit stop needed
    return Promise.resolve();
  };
  private async _fetchFreshSession(): Promise<
    ReturnType<AuthClient['getSession']>
  > {
    try {
      const user = await this.stackAuth.getUser();
      if (user) {
        const tokens = await user.currentSession.getTokens();
        if (tokens.accessToken) {
          const payload = accessTokenSchema.parse(
            JSON.parse(atob(tokens.accessToken.split('.')[1]))
          );

          const session: Session = {
            access_token: tokens.accessToken,
            // ATTENTION: we allow sessions without refresh token
            refresh_token: tokens.refreshToken ?? '',
            expires_at: payload.exp,
            expires_in: Math.max(
              0,
              payload.exp - Math.floor(Date.now() / 1000)
            ),
            token_type: 'bearer' as const,
            user: {
              id: user.id,
              email: user.primaryEmail || '',
              email_confirmed_at: user.primaryEmailVerified
                ? toISOString(user.signedUpAt)
                : undefined,
              last_sign_in_at: toISOString(user.signedUpAt),
              created_at: toISOString(user.signedUpAt),
              updated_at: toISOString(user.signedUpAt),
              aud: 'authenticated',
              role: 'authenticated',
              app_metadata: user.clientReadOnlyMetadata,
              user_metadata: {
                displayName: user.displayName,
                profileImageUrl: user.profileImageUrl,
                ...user.clientMetadata,
              },
              identities: [],
            },
          };

          return { data: { session }, error: null };
        }
      }

      return { data: { session: null }, error: null };
    } catch (error) {
      console.error('Error fetching fresh session:', error);
      return { data: { session: null }, error: normalizeStackAuthError(error) };
    }
  }

  private async _getSessionFromStackAuthInternals(): Promise<InternalSession | null> {
    const tokenStore = await this.stackAuth._getOrCreateTokenStore(
      await this.stackAuth._createCookieHelper()
    );
    return this.stackAuth._getSessionFromTokenStore(tokenStore);
  }

  private async _getCachedTokensFromStackAuthInternals(): Promise<{
    accessToken: string;
    refreshToken: string | null;
  } | null> {
    try {
      const session = await this._getSessionFromStackAuthInternals();

      // Get cached token - returns null if expired
      const accessToken = session?.getAccessTokenIfNotExpiredYet(0);
      if (!accessToken) return null;

      return {
        accessToken: accessToken.token,
        // @ts-expect-error - this should be accessible
        refreshToken: session?._refreshToken?.token ?? null,
      };
    } catch {
      return null;
    }
  }

  private async emitInitialSession(
    callback: (
      event: AuthChangeEvent,
      session: Session | null
    ) => void | Promise<void>
  ): Promise<void> {
    try {
      const { data, error } = await this.getSession();

      if (error) {
        // Emit with null session if error
        await callback('INITIAL_SESSION', null);
        return;
      }

      // Emit initial session
      await callback('INITIAL_SESSION', data.session);
    } catch (_error) {
      // Emit with null session on exception
      await callback('INITIAL_SESSION', null);
    }
  }

  private async notifyAllSubscribers(
    event: AuthChangeEvent,
    session: Session | null,
    broadcast = true
  ): Promise<void> {
    // Broadcast to other tabs first
    if (broadcast && this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          event,
          session,
          timestamp: Date.now(),
        });
      } catch (error) {
        // BroadcastChannel may fail in some environments (e.g., Node.js)
        console.warn('BroadcastChannel postMessage failed:', error);
      }
    }

    // Notify all local subscribers
    const promises = Array.from(this.stateChangeEmitters.values()).map(
      (subscription) => {
        try {
          return Promise.resolve(subscription.callback(event, session));
        } catch (error) {
          console.error('Auth state change callback error:', error);
          return Promise.resolve();
        }
      }
    );

    await Promise.allSettled(promises);
  }

  private initializeBroadcastChannel(): void {
    // Check if BroadcastChannel is available (browser only)
    if (!supportsBroadcastChannel()) {
      return;
    }

    // Create channel if not exists
    if (!this.broadcastChannel) {
      try {
        this.broadcastChannel = new BroadcastChannel(
          'stack-auth-state-changes'
        );

        // Listen for messages from other tabs
        this.broadcastChannel.onmessage = async (event: MessageEvent) => {
          const { event: authEvent, session } = event.data;

          // Emit event locally (do not broadcast back)
          await this.notifyAllSubscribers(authEvent, session, false);
        };
      } catch (error) {
        // BroadcastChannel creation failed (shouldn't happen if supportsBroadcastChannel() returned true)
        console.error(
          'Failed to create BroadcastChannel, cross-tab sync will not be available:',
          error
        );
      }
    }
  }

  private closeBroadcastChannel(): void {
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }
  }

  private startTokenRefreshDetection(): void {
    // Only start if explicitly enabled
    if (!this.config.enableTokenRefreshDetection) {
      return;
    }

    // Don't start if already running
    if (this.tokenRefreshCheckInterval) {
      return;
    }

    this.tokenRefreshCheckInterval = setInterval(async () => {
      try {
        // Get current session state (optimized to use cached tokens first)
        const sessionResult = await this.getSession();

        if (!sessionResult.data.session) {
          // No session available
          return;
        }

        const session = sessionResult.data.session;
        const now = Math.floor(Date.now() / 1000);
        const expiresAt = session.expires_at ?? now;
        const expiresInSeconds = expiresAt - now;

        // Check if session expired completely
        if (expiresInSeconds <= 0) {
          // Session expired, emit SIGNED_OUT
          await this.notifyAllSubscribers('SIGNED_OUT', null);
          return;
        }

        // Like Supabase: Detect if token was refreshed (< 90 seconds to expiry)
        // Stack Auth auto-refreshes tokens, we just detect and emit the event
        if (expiresInSeconds <= 90 && expiresInSeconds > 0) {
          // Token is fresh (was likely just refreshed), emit TOKEN_REFRESHED
          await this.notifyAllSubscribers('TOKEN_REFRESHED', session);
        }
      } catch (error) {
        console.error('Token refresh detection error:', error);
      }
    }, this.config.tokenRefreshCheckInterval);
  }

  private stopTokenRefreshDetection(): void {
    if (this.tokenRefreshCheckInterval) {
      clearInterval(this.tokenRefreshCheckInterval);
      this.tokenRefreshCheckInterval = null;
    }
  }

}
