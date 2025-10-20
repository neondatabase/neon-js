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
import { accessTokenSchema } from '@/auth/adapters/stack-auth/stack-auth-schemas';
import type {
  StackAuthUserWithInternalSession,
  StackAuthErrorResponse,
  StackAuthUserUpdateOptions,
  StackAuthClient,
  OnAuthStateChangeConfig,
} from '@/auth/adapters/stack-auth/stack-auth-types';

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

    // Map common error messages to Supabase error codes
    let code = 'unknown_error';
    let status = 400;

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
    } else if (message.includes('rate limit')) {
      code = 'over_request_rate_limit';
      status = 429;
    } else if (message.includes('email') && message.includes('invalid')) {
      code = 'email_address_invalid';
      status = 400;
    }

    return new AuthApiError(message, status, code);
  }

  // Handle standard errors
  if (error instanceof Error) {
    return new AuthError(error.message, 500, 'unexpected_failure');
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
  stackAuth: StackAuthClient;

  // Auth state change management
  private stateChangeEmitters = new Map<string, Subscription>();
  private broadcastChannel: InstanceType<typeof BroadcastChannel> | null = null;
  private tokenRefreshCheckInterval: NodeJS.Timeout | null = null;
  private config: OnAuthStateChangeConfig = {
    enableTokenRefreshDetection: true, // Enabled by default (matches Supabase)
    tokenRefreshCheckInterval: 30_000, // 30 seconds (matches Supabase)
  };
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

  // Admin API
  admin: AuthClient['admin'] = undefined as never;

  // MFA API
  mfa: AuthClient['mfa'] = undefined as never;

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
        const result = await this.stackAuth.signUpWithCredential({
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

        // Get session after sign-up (includes user from token)
        const sessionResult = await this.getSession();

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

        // Get session (includes user from token)
        const sessionResult = await this.getSession();

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
        const result = await this.stackAuth.sendMagicLinkEmail(
          credentials.email,
          {
            callbackUrl: credentials.options?.emailRedirectTo,
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

  signInWithIdToken: AuthClient['signInWithIdToken'] = async () => {
    throw new Error('signInWithIdToken not implemented yet');
  };

  signInWithSSO: AuthClient['signInWithSSO'] = async () => {
    throw new Error('signInWithSSO not implemented yet');
  };

  signInWithWeb3: AuthClient['signInWithWeb3'] = async () => {
    throw new Error('signInWithWeb3 not implemented yet');
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
  verifyOtp: AuthClient['verifyOtp'] = async () => {
    throw new Error('verifyOtp not implemented yet');
  };

  // Session management
  getSession: AuthClient['getSession'] = async () => {
    try {
      let session: Session | null = null;

      // Step 1: Try to get cached tokens (no network request)
      const cachedTokens = await this._getCachedTokensFromStackAuthInternals();
      if (cachedTokens?.accessToken) {
        const payload = accessTokenSchema.parse(
          JSON.parse(atob(cachedTokens.accessToken.split('.')[1]))
        );

        session = {
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
      } else {
        // Step 2: Fallback - fetch user (makes network request and auto refreshes tokens)
        const user = await this.stackAuth.getUser();
        if (user) {
          const tokens = await user.currentSession.getTokens();
          if (tokens.accessToken) {
            const payload = accessTokenSchema.parse(
              JSON.parse(atob(tokens.accessToken.split('.')[1]))
            );

            session = {
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
                  ? user.signedUpAt.toISOString()
                  : undefined,
                last_sign_in_at: user.signedUpAt.toISOString(),
                created_at: user.signedUpAt.toISOString(),
                updated_at: user.signedUpAt.toISOString(),
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
          }
        }
      }

      // Return with properly narrowed types
      if (session) {
        return { data: { session }, error: null };
      } else {
        return { data: { session: null }, error: null };
      }
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
              ? user.signedUpAt.toISOString()
              : undefined,
            phone: undefined,
            confirmed_at: user.primaryEmailVerified
              ? user.signedUpAt.toISOString()
              : undefined,
            last_sign_in_at: user.signedUpAt.toISOString(),
            app_metadata: {},
            user_metadata: {
              displayName: user.displayName,
              profileImageUrl: user.profileImageUrl,
              ...user.clientMetadata,
            },
            identities: [],
            created_at: user.signedUpAt.toISOString(),
            updated_at: user.signedUpAt.toISOString(),
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

      // Handle password update separately (Stack Auth uses setPassword method)
      if (attributes.password) {
        await user.setPassword({ password: attributes.password });
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

      const data = {
        user: {
          id: updatedUser.id,
          aud: 'authenticated',
          role: 'authenticated',
          email: updatedUser.primaryEmail || '',
          email_confirmed_at: updatedUser.primaryEmailVerified
            ? updatedUser.signedUpAt.toISOString()
            : undefined,
          phone: undefined,
          confirmed_at: updatedUser.primaryEmailVerified
            ? updatedUser.signedUpAt.toISOString()
            : undefined,
          last_sign_in_at: updatedUser.signedUpAt.toISOString(),
          app_metadata: {},
          user_metadata: {
            displayName: updatedUser.displayName,
            profileImageUrl: updatedUser.profileImageUrl,
            ...updatedUser.clientMetadata,
          },
          identities: [],
          created_at: updatedUser.signedUpAt.toISOString(),
          updated_at: updatedUser.signedUpAt.toISOString(),
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
    throw new Error('getUserIdentities not implemented yet');
  };

  linkIdentity: AuthClient['linkIdentity'] = async () => {
    throw new Error('linkIdentity not implemented yet');
  };

  unlinkIdentity: AuthClient['unlinkIdentity'] = async () => {
    throw new Error('unlinkIdentity not implemented yet');
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

  // Reauthentication
  reauthenticate: AuthClient['reauthenticate'] = async () => {
    throw new Error('reauthenticate not implemented yet');
  };

  // Resend
  resend: AuthClient['resend'] = async () => {
    throw new Error('resend not implemented yet');
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
    } catch (error) {
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
    if (typeof BroadcastChannel === 'undefined') {
      return;
    }

    // Create channel if not exists
    if (!this.broadcastChannel) {
      this.broadcastChannel = new BroadcastChannel('stack-auth-state-changes');

      // Listen for messages from other tabs
      this.broadcastChannel.onmessage = async (event: MessageEvent) => {
        const { event: authEvent, session } = event.data;

        // Emit event locally (do not broadcast back)
        await this.notifyAllSubscribers(authEvent, session, false);
      };
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
    authCode: string
  ) => {
    try {
      // Stack Auth's callOAuthCallback() automatically:
      // - Retrieves code and state from URL parameters
      // - Retrieves code verifier from cookies (stored during signInWithOAuth)
      // - Exchanges code for tokens
      // - Updates the session
      const success = await this.stackAuth.callOAuthCallback();

      if (success) {
        // Get the newly created session
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

      // Callback failed
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
}
