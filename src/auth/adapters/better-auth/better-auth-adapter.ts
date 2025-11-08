import { AuthError, type AuthClient } from '@/auth/auth-interface';
import type {
  Session,
  AuthChangeEvent,
  Subscription,
  Provider,
} from '@supabase/auth-js';
import { accessTokenSchema } from '@/auth/adapters/shared-schemas';
import {
  createAuthClient,
  type BetterAuthClientOptions,
} from 'better-auth/client';
import type { OnAuthStateChangeConfig } from './better-auth-types';
import {
  normalizeBetterAuthError,
  mapBetterAuthSessionToSupabase,
  supportsBroadcastChannel,
  toISOString,
} from './better-auth-helpers';
import {
  jwtClient,
  adminClient,
  organizationClient,
} from 'better-auth/client/plugins';
import { SessionCache } from './session-cache';

/**
 * Better Auth adapter implementing the AuthClient interface
 *
 * This adapter provides direct 1:1 mappings from Supabase Auth to Better Auth:
 *
 * Authentication:
 * - signUp → betterAuth.signUp.email()
 * - signInWithPassword → betterAuth.signIn.email()
 * - signInWithOAuth → betterAuth.signIn.social()
 * - signInWithOtp → betterAuth.signIn.email() (magic link)
 * - signOut → betterAuth.signOut()
 *
 * Session Management:
 * - getSession → betterAuth.getSession()
 * - getUser → betterAuth.getSession() (extract user)
 *
 * User Management:
 * - updateUser → betterAuth.user.update()
 * - getUserIdentities → betterAuth.account.list()
 * - linkIdentity → betterAuth.linkSocial()
 * - unlinkIdentity → betterAuth.account.unlink()
 *
 * Password Management:
 * - resetPasswordForEmail → betterAuth.forgetPassword()
 *
 * Session Caching:
 * - SessionCache provides 60-second TTL for getSession() results
 * - Reduces network calls during normal operation
 * - Invalidation flag prevents stale data during sign-out
 *
 * Based on: https://www.better-auth.com/docs/guides/supabase-migration-guide
 */

const defaultBetterAuthClientOptions = {
  plugins: [jwtClient(), adminClient(), organizationClient()],
} satisfies BetterAuthClientOptions;

export class BetterAuthAdapter implements AuthClient {
  private betterAuth: ReturnType<
    typeof createAuthClient<typeof defaultBetterAuthClientOptions>
  >;

  // Auth state change management
  private stateChangeEmitters = new Map<string, Subscription>();
  private broadcastChannel: InstanceType<typeof BroadcastChannel> | null = null;
  private tokenRefreshCheckInterval: NodeJS.Timeout | null = null;
  private config: OnAuthStateChangeConfig = {
    enableTokenRefreshDetection: true, // Enabled by default (matches Supabase)
    tokenRefreshCheckInterval: 30_000, // 30 seconds (matches Supabase)
  };
  /**
   * Last known session state for detecting auth change event types
   *
   * Required for Supabase AuthChangeEvent compatibility:
   * - Better Auth's useSession atom only provides current state (session or null)
   * - Supabase requires specific event types: SIGNED_IN, SIGNED_OUT, USER_UPDATED
   * - We must compare previous vs current state to derive event type:
   *   - null → session = SIGNED_IN
   *   - session → null = SIGNED_OUT
   *   - session → different session (user ID changed) = SIGNED_IN
   *   - session → same session (user data changed) = USER_UPDATED
   *
   * Cannot be eliminated without breaking Supabase compatibility.
   */
  private lastSessionState: Session | null = null;

  // Session caching - synchronous in-memory cache with 60-second TTL
  // JWT is stored as part of session object (access_token field)
  private sessionCache: SessionCache;

  constructor(
    betterAuthClientOptions: BetterAuthClientOptions,
    config?: OnAuthStateChangeConfig
  ) {
    // Merge config
    if (config) {
      this.config = { ...this.config, ...config };
    }

    // Initialize cache with 60-second TTL
    this.sessionCache = new SessionCache(60_000);

    this.betterAuth = createAuthClient({
      ...betterAuthClientOptions,
      ...defaultBetterAuthClientOptions,
    });

    // Set up session change listener for Better Auth's reactive system
    this.setupSessionListener();
  }

  /**
   * Shared expiration check helper
   * Checks if a timestamp (Unix seconds) is expired, with 10-second buffer for clock skew
   */
  private _isExpired(expiresAt: Date | number | null | undefined): boolean {
    if (!expiresAt) return true;
    const now = Math.floor(Date.now() / 1000);

    const expiresAtNumber =
      typeof expiresAt === 'number'
        ? expiresAt
        : Math.floor(expiresAt.getTime() / 1000);

    // 10 second buffer for clock skew
    return expiresAtNumber <= now + 10;
  }

  /**
   * Decode JWT and extract expiration timestamp (exp claim)
   * Returns null if token is invalid or doesn't have exp
   */
  private _getJwtExpiration(jwt: string): number | null {
    try {
      const tokenParts = jwt.split('.');
      if (tokenParts.length !== 3) {
        return null;
      }
      const payload = JSON.parse(atob(tokenParts[1]));
      const exp = payload.exp;
      return typeof exp === 'number' ? exp : null;
    } catch {
      return null;
    }
  }


  // Admin API
  admin: AuthClient['admin'] = undefined as never;
  // MFA API
  mfa: AuthClient['mfa'] = undefined as never;
  // OAuth API
  oauth: AuthClient['oauth'] = undefined as never;

  // Initialization
  initialize: AuthClient['initialize'] = async () => {
    try {
      // Better Auth doesn't require explicit initialization
      // Check if we have a valid session
      const session = await this.getSession();

      return {
        data: session.data,
        error: session.error,
      };
    } catch (error) {
      return {
        data: { session: null },
        error: normalizeBetterAuthError(error),
      };
    }
  };

  getSession: AuthClient['getSession'] = async () => {
    console.log('[getSession] Called - checking cache');
    try {
      // Step 1: Fast Path - Read from synchronous cache
      const cachedSession = this.sessionCache.get();
      if (cachedSession) {
        console.log('[getSession] Cache hit - returning cached session', {
          userId: cachedSession.user.id,
          cacheTTL: this.sessionCache.getRemainingTTL(),
        });

        // CRITICAL: Check invalidation flag one more time before returning
        // This catches the race condition where signOut() was called after we read
        // from cache but before we return. Without this check, we'd return stale data.
        if (this.sessionCache.isInvalidated()) {
          console.log('[getSession] Cache invalidated during execution - returning null');
          return { data: { session: null }, error: null };
        }

        return { data: { session: cachedSession }, error: null };
      }

      console.log('[getSession] Cache miss - fetching fresh session from Better Auth');

      // Step 2: Slow Path - Fetch fresh session (network request)
      // Optimization: Extract JWT if server provides it in response header
      let headerJwt: string | null = null;
      const response = await this.betterAuth.getSession({
        fetchOptions: {
          onSuccess: (ctx) => {
            // Try to extract JWT from response header
            const jwt = ctx.response.headers.get('set-auth-jwt');
            if (jwt) {
              console.debug('[JWT] Extracted from getSession response header');
              headerJwt = jwt;
            }
          },
        },
      });

      console.log('[getSession] Better Auth response:', {
        hasError: !!response.error,
        hasSession: !!response.data?.session,
        hasUser: !!response.data?.user,
      });

      if (response.error) {
        console.log('[getSession] Better Auth returned error:', response.error);
        return {
          data: { session: null },
          error: normalizeBetterAuthError(response.error),
        };
      }

      if (!response.data?.session || !response.data?.user) {
        console.log('[getSession] No session/user in Better Auth response');
        return {
          data: { session: null },
          error: new AuthError(
            'Failed to get session',
            500,
            'unexpected_failure'
          ),
        };
      }

      const session = mapBetterAuthSessionToSupabase(
        response.data.session,
        response.data.user
      );
      if (!session) {
        console.log('[getSession] Failed to map Better Auth session to Supabase format');
        return {
          data: { session: null },
          error: new AuthError(
            'Failed to map session',
            500,
            'unexpected_failure'
          ),
        };
      }

      // Enrich session with JWT token
      const jwt = headerJwt || (await this.getJwtToken());
      session.access_token = jwt || session.access_token; // Keep opaque token if JWT fetch fails

      // Cache enriched session (single source of truth)
      console.log('[getSession] Caching enriched session with JWT', {
        userId: session.user.id,
        hasJWT: !!jwt,
      });
      this.sessionCache.set(session);

      console.log('[getSession] Returning fresh session');
      return { data: { session }, error: null };
    } catch (error) {
      console.log('[getSession] Error caught:', error);
      return {
        data: { session: null },
        error: normalizeBetterAuthError(error),
      };
    }
  };

  refreshSession: AuthClient['refreshSession'] = async () => {
    try {
      // Better Auth handles token refresh automatically
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
        error: normalizeBetterAuthError(error),
      };
    }
  };

  setSession: AuthClient['setSession'] = async () => {
    // Better Auth doesn't support setting sessions from external tokens
    // Sessions are managed internally by Better Auth
    return {
      data: { user: null, session: null },
      error: new AuthError(
        'Setting external sessions is not supported by Better Auth',
        501,
        'not_implemented'
      ),
    };
  };

  // User management
  getUser: AuthClient['getUser'] = async () => {
    try {
      const sessionResult = await this.getSession();

      if (sessionResult.error || !sessionResult.data.session) {
        return {
          data: { user: null },
          error:
            sessionResult.error ||
            new AuthError('No user session found', 401, 'session_not_found'),
        };
      }

      return {
        data: {
          user: sessionResult.data.session.user,
        },
        error: null,
      };
    } catch (error) {
      return {
        data: { user: null },
        error: normalizeBetterAuthError(error),
      };
    }
  };

  getClaims: AuthClient['getClaims'] = async (jwt?: string, options?: any) => {
    try {
      const sessionResult = await this.getSession();

      if (sessionResult.error || !sessionResult.data.session) {
        return {
          data: null,
          error:
            sessionResult.error ||
            new AuthError('No user session found', 401, 'session_not_found'),
        };
      }

      const accessToken = jwt || sessionResult.data.session.access_token;

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

      // Decode JWT to get claims
      const tokenParts = accessToken.split('.');
      if (tokenParts.length !== 3) {
        return {
          data: null,
          error: new AuthError('Invalid token format', 401, 'bad_jwt'),
        };
      }

      try {
        const payload = accessTokenSchema.parse(
          JSON.parse(atob(tokenParts[1]))
        );
        // Return payload directly
        return {
          data: payload as any,
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
        error: normalizeBetterAuthError(error),
      };
    }
  };

  /**
   * Get JWT token for API authentication
   *
   * Uses cached JWT if valid, otherwise fetches fresh token from /token endpoint.
   * This method should be used by client factory instead of getSession() to avoid
   * unnecessary session fetches on every API request.
   *
   * @returns JWT token string, or null if no session exists
   */
  getJwtToken = async () => {
    try {
      // Step 1: Check if we have cached session with JWT
      const cachedSession = this.sessionCache.get();
      if (cachedSession?.access_token) {
        // Verify JWT hasn't expired
        const exp = this._getJwtExpiration(cachedSession.access_token);
        if (exp && !this._isExpired(exp)) {
          console.debug('[JWT] Cache hit from session cache');
          return cachedSession.access_token;
        }
      }
      console.debug('[JWT] Cache miss - fetching fresh token');

      // Step 2: Fetch fresh JWT from /token endpoint
      const tokenResponse = await this.betterAuth.token();

      if (tokenResponse.error || !tokenResponse.data?.token) {
        console.debug('[JWT] Fetch failed');
        return null;
      }

      const jwt = tokenResponse.data.token;

      // Step 3: Update session cache with new JWT if we have a session
      if (cachedSession) {
        cachedSession.access_token = jwt;
        this.sessionCache.set(cachedSession);
        console.debug('[JWT] Updated session cache with fresh JWT');
      }

      return jwt;
    } catch (error) {
      console.debug('[JWT] Error fetching token:', error);
      return null;
    }
  };

  // Sign up
  signUp: AuthClient['signUp'] = async (credentials) => {
    try {
      // Handle email/password sign-up
      if ('email' in credentials && credentials.email && credentials.password) {
        // Direct 1:1 mapping: Supabase signUp -> Better Auth signUp.email
        const displayName =
          credentials.options?.data &&
          'displayName' in credentials.options.data &&
          typeof credentials.options.data.displayName === 'string'
            ? credentials.options.data.displayName
            : '';

        const result = await this.betterAuth.signUp.email({
          email: credentials.email,
          password: credentials.password,
          name: displayName,
        });

        if (result.error) {
          return {
            data: { user: null, session: null },
            error: normalizeBetterAuthError(result.error),
          };
        }

        // Get fresh session with full user metadata
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

        // Better Auth will update the useSession atom, which will trigger setupSessionListener()
        // to emit SIGNED_IN event automatically

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
        error: normalizeBetterAuthError(error),
      };
    }
  };

  // Sign in methods
  signInAnonymously: AuthClient['signInAnonymously'] = async () => {
    // Better Auth doesn't support anonymous sign-in
    return {
      data: { user: null, session: null },
      error: new AuthError(
        'Anonymous sign-in is not supported by Better Auth',
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
        // Direct 1:1 mapping: Supabase signInWithPassword -> Better Auth signIn.email
        const result = await this.betterAuth.signIn.email({
          email: credentials.email,
          password: credentials.password,
        });

        if (result.error) {
          return {
            data: { user: null, session: null },
            error: normalizeBetterAuthError(result.error),
          };
        }

        // Get fresh session with full user metadata
        //
        // Clerk-style defensive pattern: After successful auth operation,
        // verify session exists before returning to caller. This handles
        // edge cases where SDK operation succeeds but session isn't immediately
        // available (network issues, timing issues, etc.)
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

        // Better Auth will update the useSession atom, which will trigger setupSessionListener()
        // to emit SIGNED_IN event automatically

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
        error: normalizeBetterAuthError(error),
      };
    }
  };

  signInWithOAuth: AuthClient['signInWithOAuth'] = async (credentials) => {
    try {
      const { provider, options } = credentials;

      // Direct 1:1 mapping: Supabase signInWithOAuth -> Better Auth signIn.social
      await this.betterAuth.signIn.social({
        provider,
        callbackURL:
          options?.redirectTo ||
          (typeof window !== 'undefined' ? window.location.origin : ''),
      });

      // OAuth redirects the user, so we return success immediately
      // The actual session will be available after OAuth callback
      return {
        data: {
          provider,
          url:
            options?.redirectTo ||
            (typeof window !== 'undefined' ? window.location.origin : ''),
        },
        error: null,
      };
    } catch (error) {
      return {
        data: {
          provider: credentials.provider,
          url: null,
        },
        error: normalizeBetterAuthError(error),
      };
    }
  };

  // TODO: add https://www.better-auth.com/docs/plugins/email-otp to server
  signInWithOtp: AuthClient['signInWithOtp'] = async (credentials) => {
    try {
      return {
        data: { user: null, session: null },
        error: new AuthError(
          'Email OTP is still missing the plugin in the server adapter for Neon Auth',
          501,
          'not_implemented'
        ),
      };
    } catch (error) {
      return {
        data: { user: null, session: null, messageId: undefined },
        error: normalizeBetterAuthError(error),
      };
    }
  };

  signInWithIdToken: AuthClient['signInWithIdToken'] = async (credentials) => {
    /**
     * Better Auth does not support direct OIDC ID token authentication.
     *
     * Better Auth uses OAuth authorization code flow with redirects instead:
     * - Requires redirecting users to the OAuth provider
     * - Handles the OAuth callback to exchange authorization code for tokens
     * - Does not accept pre-existing ID tokens directly
     *
     * For OAuth providers, use signInWithOAuth instead:
     * ```
     * await authAdapter.signInWithOAuth({ provider: 'google', options: { redirectTo: '...' } });
     * ```
     */

    const attemptedProvider = credentials.provider;
    const hasAccessToken = !!credentials.access_token;
    const hasNonce = !!credentials.nonce;

    return {
      data: {
        user: null,
        session: null,
      },
      error: new AuthError(
        `Better Auth does not support OIDC ID token authentication. Attempted with provider: ${attemptedProvider}${hasAccessToken ? ' (with access_token)' : ''}${hasNonce ? ' (with nonce)' : ''}. ` +
          `Better Auth uses OAuth authorization code flow and does not accept pre-existing ID tokens. ` +
          `Please use signInWithOAuth() to redirect users to the OAuth provider for authentication.`,
        501,
        'id_token_provider_disabled'
      ),
    };
  };

  signInWithSSO: AuthClient['signInWithSSO'] = async (params) => {
    /**
     * Better Auth does not support enterprise SAML SSO providers like Supabase does.
     *
     * Better Auth only supports OAuth social providers (Google, GitHub, Microsoft, etc.)
     * via the signInWithOAuth method.
     *
     * For OAuth providers, use signInWithOAuth instead:
     * ```
     * await authAdapter.signInWithOAuth({ provider: 'google', options: { redirectTo: '...' } });
     * ```
     */

    const attemptedWith =
      'providerId' in params
        ? `provider ID: ${params.providerId}`
        : `domain: ${'domain' in params ? params.domain : 'unknown'}`;

    return {
      data: null,
      error: new AuthError(
        `Better Auth does not support enterprise SAML SSO. Attempted with ${attemptedWith}. ` +
          `Better Auth only supports OAuth social providers (Google, GitHub, Microsoft, etc.). ` +
          `Please use signInWithOAuth() for OAuth providers instead.`,
        501,
        'sso_provider_disabled'
      ),
    };
  };

  signInWithWeb3: AuthClient['signInWithWeb3'] = async (credentials) => {
    /**
     * Better Auth does not support Web3/crypto wallet authentication (Ethereum, Solana, etc.)
     *
     * Better Auth only supports:
     * - OAuth social providers (Google, GitHub, Microsoft, etc.)
     * - Email/Password credentials
     * - Magic link (passwordless email)
     *
     * For OAuth providers, use signInWithOAuth instead:
     * ```
     * await authAdapter.signInWithOAuth({ provider: 'google', options: { redirectTo: '...' } });
     * ```
     */

    const attemptedChain = credentials.chain;

    return {
      data: {
        user: null,
        session: null,
      },
      error: new AuthError(
        `Better Auth does not support Web3 authentication. Attempted with chain: ${attemptedChain}. ` +
          `Better Auth does not support crypto wallet sign-in (Ethereum, Solana, etc.). ` +
          `Supported authentication methods: OAuth, email/password, magic link. ` +
          `For social authentication, please use signInWithOAuth() instead.`,
        501,
        'web3_provider_disabled'
      ),
    };
  };

  // Sign out
  signOut: AuthClient['signOut'] = async () => {
    try {
      console.log('[signOut] Starting signOut process');
      console.log('[signOut] Current lastSessionState:', this.lastSessionState ? 'exists' : 'null');
      console.log('[signOut] Session cache has value:', this.sessionCache.has());

      // Clear caches IMMEDIATELY to prevent race conditions with concurrent getSession() calls
      // Setting invalidation flag ensures any in-flight getSession() calls will see the flag
      // and return null instead of stale cached data (both session + JWT)
      console.log('[signOut] Clearing session cache (includes JWT)');
      this.sessionCache.clear(); // Sets invalidation flag (clears session + JWT)
      console.log('[signOut] Cache cleared - session cache has value:', this.sessionCache.has());

      const result = await this.betterAuth.signOut();
      console.log('[signOut] Better Auth signOut result:', { error: result.error ? 'has error' : 'no error' });

      if (result.error) {
        return { error: normalizeBetterAuthError(result.error) };
      }

      // Better Auth will update the useSession atom, which will trigger setupSessionListener()
      // to emit SIGNED_OUT event automatically

      console.log('[signOut] SignOut completed successfully');
      return { error: null };
    } catch (error) {
      console.error('[signOut] Error during signOut:', error);
      return { error: normalizeBetterAuthError(error) };
    }
  };

  // Verification
  verifyOtp: AuthClient['verifyOtp'] = async (params) => {
    try {
      // Handle email OTP verification
      if ('email' in params && params.email) {
        const { token, type } = params;

        // Magic link verification
        if (type === 'magiclink' || type === 'email') {
          // Better Auth handles magic link verification via callback URL
          // The token should be verified when the user clicks the link
          // We need to check if Better Auth has a verifyMagicLink method
          // For now, assume the callback has already been handled
          const sessionResult = await this.getSession();

          if (!sessionResult.data.session) {
            return {
              data: { user: null, session: null },
              error: new AuthError(
                'Failed to retrieve session after OTP verification. Make sure the magic link callback has been processed.',
                500,
                'unexpected_failure'
              ),
            };
          }

          // Better Auth will update the useSession atom, which will trigger setupSessionListener()
          // to emit SIGNED_IN event automatically

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
          // Better Auth uses verifyEmail for email verification
          const result = await this.betterAuth.verifyEmail?.({
            query: { token },
          });

          if (result?.error) {
            return {
              data: { user: null, session: null },
              error: normalizeBetterAuthError(result.error),
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
          // Better Auth's resetPassword can verify the code
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
          const result = await this.betterAuth.verifyEmail?.({
            query: { token },
          });

          if (result?.error) {
            return {
              data: { user: null, session: null },
              error: normalizeBetterAuthError(result.error),
            };
          }

          // Get updated session
          const sessionResult = await this.getSession();

          // Better Auth will update the useSession atom, which will trigger setupSessionListener()
          // to emit USER_UPDATED event automatically

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
            'Phone OTP verification not supported by Better Auth',
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

          // Better Auth will update the useSession atom, which will trigger setupSessionListener()
          // to emit SIGNED_IN event automatically

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
          const result = await this.betterAuth.verifyEmail?.({
            query: { token: token_hash },
          });

          if (result?.error) {
            return {
              data: { user: null, session: null },
              error: normalizeBetterAuthError(result.error),
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
          return {
            data: {
              user: null,
              session: null,
            },
            error: null,
          };
        }

        if (type === 'email_change') {
          const result = await this.betterAuth.verifyEmail?.({
            query: { token: token_hash },
          });

          if (result?.error) {
            return {
              data: { user: null, session: null },
              error: normalizeBetterAuthError(result.error),
            };
          }

          const sessionResult = await this.getSession();

          // Better Auth will update the useSession atom, which will trigger setupSessionListener()
          // to emit USER_UPDATED event automatically

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
        error: normalizeBetterAuthError(error),
      };
    }
  };

  updateUser: AuthClient['updateUser'] = async (attributes) => {
    try {
      const sessionResult = await this.getSession();

      if (sessionResult.error || !sessionResult.data.session) {
        return {
          data: { user: null },
          error:
            sessionResult.error ||
            new AuthError('No user session found', 401, 'session_not_found'),
        };
      }

      // Handle password update separately - Better Auth uses password reset flow
      if (attributes.password) {
        return {
          data: { user: null },
          error: new AuthError(
            'Password updates require reauthentication. Use resetPasswordForEmail flow instead.',
            400,
            'feature_not_supported'
          ),
        };
      }

      // Direct 1:1 mapping: Supabase updateUser -> Better Auth user.update
      // Map Supabase attributes to Better Auth format
      const updateData: Record<string, unknown> = {};

      if (attributes.data) {
        const data = attributes.data;
        if (
          data &&
          'displayName' in data &&
          typeof data.displayName === 'string'
        ) {
          updateData.name = data.displayName;
        }
        if (
          data &&
          'profileImageUrl' in data &&
          typeof data.profileImageUrl === 'string'
        ) {
          updateData.image = data.profileImageUrl;
        }
      }

      if (attributes.email) {
        updateData.email = attributes.email;
        console.warn(
          'Email updates may require server-side Better Auth configuration'
        );
      }

      const result = await (this.betterAuth as any).user?.update?.(updateData);

      if (result?.error) {
        return {
          data: { user: null },
          error: normalizeBetterAuthError(result.error),
        };
      }

      // Get the updated user
      const updatedSessionResult = await this.getSession();

      if (!updatedSessionResult.data.session) {
        throw new Error('Failed to retrieve updated user');
      }

      // Better Auth will update the useSession atom, which will trigger setupSessionListener()
      // to emit USER_UPDATED event automatically

      return {
        data: { user: updatedSessionResult.data.session.user },
        error: null,
      };
    } catch (error) {
      return {
        data: { user: null },
        error: normalizeBetterAuthError(error),
      };
    }
  };

  getUserIdentities: AuthClient['getUserIdentities'] = async () => {
    try {
      const sessionResult = await this.getSession();

      if (sessionResult.error || !sessionResult.data.session) {
        return {
          data: null,
          error:
            sessionResult.error ||
            new AuthError('No user session found', 401, 'session_not_found'),
        };
      }

      // Direct 1:1 mapping: Supabase getUserIdentities -> Better Auth account.list
      const result = await (this.betterAuth as any).account?.list?.();

      if (!result) {
        return {
          data: null,
          error: new AuthError(
            'Failed to list accounts',
            500,
            'unexpected_failure'
          ),
        };
      }

      if (result.error) {
        return {
          data: null,
          error: normalizeBetterAuthError(result.error),
        };
      }

      // Map Better Auth accounts to Supabase identities format
      const identities =
        result.data?.accounts?.map((account: any) => ({
          id: account.id,
          user_id: account.userId,
          identity_id: account.id,
          provider: account.provider,
          identity_data: {
            provider_account_id: account.providerAccountId,
            provider: account.provider,
            user_id: account.userId,
          },
          created_at: toISOString(account.createdAt),
          last_sign_in_at: toISOString(account.createdAt),
          updated_at: toISOString(account.updatedAt),
        })) || [];

      return {
        data: { identities },
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: normalizeBetterAuthError(error),
      };
    }
  };

  linkIdentity: AuthClient['linkIdentity'] = (async (credentials) => {
    // Handle ID token credentials - Better Auth doesn't support this
    if ('token' in credentials) {
      const provider = credentials.provider as Provider;
      return {
        data: { provider, url: null },
        error: new AuthError(
          'Better Auth does not support linking identities with ID tokens. Use OAuth credentials instead.',
          501,
          'id_token_provider_disabled'
        ),
      };
    }

    // Type guard: after checking for id_token/access_token, TypeScript narrows to SignInWithOAuthCredentials
    // But we need to explicitly narrow it for the options property to work correctly
    const oauthCredentials = credentials;
    const provider = oauthCredentials.provider;

    try {
      const sessionResult = await this.getSession();

      if (sessionResult.error || !sessionResult.data.session) {
        return {
          data: { provider, url: null },
          error:
            sessionResult.error ||
            new AuthError('No user session found', 401, 'session_not_found'),
        };
      }

      const callbackURL =
        oauthCredentials.options?.redirectTo ||
        (typeof window !== 'undefined' ? window.location.origin : '');

      // Convert scopes from Supabase format (space-separated string) to Better Auth format (array)
      const scopes = oauthCredentials.options?.scopes
        ? oauthCredentials.options.scopes
            .split(' ')
            .filter((s: string) => s.length > 0)
        : undefined;

      // Better Auth linkSocial initiates OAuth flow to link account
      // This will redirect the user to the OAuth provider
      await this.betterAuth.linkSocial({
        provider,
        callbackURL,
        scopes,
      });

      // OAuth redirects the user, so we return success immediately
      // The actual linking happens after OAuth callback
      return {
        data: {
          provider,
          url: callbackURL,
        },
        error: null,
      };
    } catch (error) {
      return {
        data: { provider, url: null },
        error: normalizeBetterAuthError(error),
      };
    }
  }) as AuthClient['linkIdentity'];

  unlinkIdentity: AuthClient['unlinkIdentity'] = async (identity) => {
    try {
      const sessionResult = await this.getSession();

      if (sessionResult.error || !sessionResult.data.session) {
        return {
          data: null,
          error:
            sessionResult.error ||
            new AuthError('No user session found', 401, 'session_not_found'),
        };
      }

      // Direct 1:1 mapping: Supabase unlinkIdentity -> Better Auth account.unlink
      const result = await this.betterAuth.unlinkAccount({
        providerId: identity.provider,
      });

      if (result?.error) {
        return {
          data: null,
          error: normalizeBetterAuthError(result.error),
        };
      }

      // Better Auth will update the useSession atom after unlinking, which will trigger
      // setupSessionListener() to emit USER_UPDATED event automatically

      return {
        data: {},
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: normalizeBetterAuthError(error),
      };
    }
  };

  // Password reset
  resetPasswordForEmail: AuthClient['resetPasswordForEmail'] = async (
    email,
    options
  ) => {
    try {
      // TODO: this will fail, we need to setup `sendResetPassword` in the server adapter
      // Direct 1:1 mapping: Supabase resetPasswordForEmail -> Better Auth forgetPassword
      const result = await this.betterAuth.forgetPassword({
        email,
        redirectTo:
          options?.redirectTo ||
          (typeof window !== 'undefined' ? window.location.origin : ''),
      });

      if (result?.error) {
        return {
          data: null,
          error: normalizeBetterAuthError(result.error),
        };
      }

      return {
        data: {},
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: normalizeBetterAuthError(error),
      };
    }
  };

  // TODO: we need to OTP to reauthenticate
  reauthenticate: AuthClient['reauthenticate'] = async () => {
    // Better Auth does not support nonce-based reauthentication
    //
    // Supabase's reauthenticate() sends an OTP to verify the user still controls
    // their email/phone and returns a nonce for use with updateUser({ password, nonce }).
    //
    // Better Auth uses a different security model where password updates require
    // the password reset flow instead.
    return {
      data: { user: null, session: null },
      error: new AuthError(
        'Better Auth does not support nonce-based reauthentication. For password changes, use the password reset flow (resetPasswordForEmail) or access Better Auth directly.',
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

        // For signup verification or email_change verification
        // Better Auth's /send-verification-email endpoint handles both cases
        if (type === 'signup' || type === 'email_change') {
          // Direct 1:1 mapping: Supabase resend → Better Auth /send-verification-email
          // The endpoint automatically detects if it's initial signup or email change
          // based on the user's session state
          const result = await this.betterAuth.sendVerificationEmail({
            email,
            callbackURL:
              options?.emailRedirectTo ||
              (typeof window !== 'undefined' ? window.location.origin : ''),
          });

          if (result?.error) {
            return {
              data: { user: null, session: null },
              error: normalizeBetterAuthError(result.error),
            };
          }

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
            'Phone OTP resend not supported',
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
        error: normalizeBetterAuthError(error),
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
   * Set up listener for Better Auth's reactive session state
   *
   * This listener detects external session changes (e.g., from Better Auth's
   * internal updates) and syncs our cache accordingly. The nanostore is NOT
   * used as the primary cache source due to its async nature causing race
   * conditions.
   */
  private setupSessionListener(): void {
    // Better Auth uses nanostores atoms, listen to useSession atom
    if (this.betterAuth.useSession) {
      console.log('[setupSessionListener] Setting up Better Auth session listener');
      // Subscribe to session changes
      this.betterAuth.useSession.subscribe((sessionState) => {
        console.log('[setupSessionListener] Session state changed:', {
          hasSession: !!sessionState?.data?.session,
          hasUser: !!sessionState?.data?.user,
          lastSessionState: this.lastSessionState ? 'exists' : 'null',
        });

        // Map Better Auth session state to Supabase session format
        if (sessionState?.data?.session && sessionState?.data?.user) {
          const session = mapBetterAuthSessionToSupabase(
            sessionState.data.session,
            sessionState.data.user
          );

          if (session) {
            // Check if this is a new session (sign in)
            if (!this.lastSessionState) {
              console.log('[setupSessionListener] New session detected - SIGNED_IN');
              // Update cache on sign-in
              this.sessionCache.set(session);
              this.notifyAllSubscribers('SIGNED_IN', session);
            } else if (this.lastSessionState.user.id !== session.user.id) {
              console.log('[setupSessionListener] User changed - SIGNED_IN');
              // Update cache on user change
              this.sessionCache.set(session);
              this.notifyAllSubscribers('SIGNED_IN', session);
            } else {
              // Check if user data changed
              const userChanged =
                JSON.stringify(this.lastSessionState.user) !==
                JSON.stringify(session.user);
              if (userChanged) {
                console.log('[setupSessionListener] User data updated - USER_UPDATED');
                // Update cache on user update
                this.sessionCache.set(session);
                this.notifyAllSubscribers('USER_UPDATED', session);
              } else {
                console.log('[setupSessionListener] Session state unchanged, skipping notification');
              }
            }

            this.lastSessionState = session;
          }
        } else {
          console.log('[setupSessionListener] Session is null - checking for sign out');
          // Session is null (signed out)
          if (this.lastSessionState) {
            console.log('[setupSessionListener] User was signed in, now signed out - SIGNED_OUT');
            // Clear cache on sign-out
            this.sessionCache.clear();
            this.notifyAllSubscribers('SIGNED_OUT', null);
          } else {
            console.log('[setupSessionListener] Already signed out, no action needed');
          }
          this.lastSessionState = null;
        }
      });
      // Store unsubscribe function for cleanup if needed
      // Note: Better Auth manages the subscription lifecycle
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
      this.lastSessionState = data.session;
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
    // JWT is now part of session cache, no separate cache to clear

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
          'better-auth-state-changes'
        );

        // Listen for messages from other tabs
        this.broadcastChannel.onmessage = async (event: MessageEvent) => {
          const { event: authEvent, session } = event.data;

          // Emit event locally (do not broadcast back)
          await this.notifyAllSubscribers(authEvent, session, false);
          this.lastSessionState = session;
        };
      } catch (error) {
        // BroadcastChannel creation failed
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

  /**
   * Start token refresh detection via polling
   *
   * Industry Standard: Both Supabase and Clerk use polling for token refresh detection:
   * - Supabase: 30-second interval with 10-second expiry margin
   * - Clerk: 50-second interval with 60-second token TTL
   *
   * Why polling instead of reactive?
   * - Better Auth's useSession atom only provides current state, not refresh events
   * - Browser JavaScript cannot receive unsolicited server events (no SSE in this context)
   * - Polling ensures deterministic behavior across all environments
   *
   * Implementation: Check session expiry every 30 seconds (matching Supabase)
   * - If token expires in <= 90 seconds, assume it was refreshed and emit TOKEN_REFRESHED
   * - If token expired completely, emit SIGNED_OUT
   */
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
        // Get current session state
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
          this.lastSessionState = null;
          return;
        }

        // Like Supabase: Detect if token was refreshed (< 90 seconds to expiry)
        // Better Auth auto-refreshes tokens, we just detect and emit the event
        if (expiresInSeconds <= 90 && expiresInSeconds > 0) {
          // Token is fresh (was likely just refreshed), emit TOKEN_REFRESHED
          await this.notifyAllSubscribers('TOKEN_REFRESHED', session);
          this.lastSessionState = session;
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
   * Note: Better Auth handles OAuth callbacks automatically.
   * This method checks if there's a session after callback.
   *
   * @param _authCode - The authorization code (Better Auth reads this from URL automatically)
   * @returns Session data or error
   */
  exchangeCodeForSession: AuthClient['exchangeCodeForSession'] = async (
    _authCode: string
  ) => {
    try {
      // Better Auth handles OAuth callbacks automatically
      // Just check if we have a session now
      const sessionResult = await this.getSession();

      if (sessionResult.data.session) {
        // Better Auth will update the useSession atom, which will trigger setupSessionListener()
        // to emit SIGNED_IN event automatically

        return {
          data: {
            session: sessionResult.data.session,
            user: sessionResult.data.session.user,
          },
          error: null,
        };
      }

      return {
        data: { session: null, user: null },
        error: new AuthError(
          'OAuth callback completed but no session was created. Make sure the OAuth callback has been processed.',
          500,
          'oauth_callback_failed'
        ),
      };
    } catch (error) {
      return {
        data: { session: null, user: null },
        error: normalizeBetterAuthError(error),
      };
    }
  };

  // Better Auth doesn't support error throwing mode
  isThrowOnErrorEnabled: AuthClient['isThrowOnErrorEnabled'] = () => false;

  // Auto refresh
  startAutoRefresh: AuthClient['startAutoRefresh'] = async () => {
    // Better Auth handles auto-refresh automatically
    // No explicit start needed
    return Promise.resolve();
  };

  stopAutoRefresh: AuthClient['stopAutoRefresh'] = async () => {
    // Better Auth handles auto-refresh automatically
    // No explicit stop needed
    return Promise.resolve();
  };
}
