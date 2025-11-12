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
import type {
  OnAuthStateChangeConfig,
  NeonBetterAuthOptions,
} from './better-auth-types';
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
import { InFlightRequestManager } from './in-flight-request-manager';
import {
  SESSION_CACHE_TTL_MS,
  TOKEN_REFRESH_CHECK_INTERVAL_MS,
  CLOCK_SKEW_BUFFER_MS,
  TOKEN_REFRESH_THRESHOLD_MS,
  BROADCAST_CHANNEL_NAME,
} from './constants';

/**
 * Better Auth adapter implementing the Supabase-compatible AuthClient interface.
 * See CLAUDE.md for architecture details and API mappings.
 */
const defaultBetterAuthClientOptions = {
  plugins: [jwtClient(), adminClient(), organizationClient()],
} satisfies BetterAuthClientOptions;

export class BetterAuthAdapter implements AuthClient {
  //#region Public Properties
  /**
   * Admin API access (unsupported in Better Auth adapter)
   * @group Unsupported Features
   */
  admin: AuthClient['admin'] = undefined as never;

  /**
   * MFA management (unsupported in Better Auth adapter)
   * @group Unsupported Features
   */
  mfa: AuthClient['mfa'] = undefined as never;

  /**
   * OAuth management (unsupported in Better Auth adapter)
   * @group Unsupported Features
   */
  oauth: AuthClient['oauth'] = undefined as never;

  /**
   * Links a new identity to the current user
   * @group User Management
   */
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
  //#endregion

  //#region Private Fields
  private betterAuth: ReturnType<
    typeof createAuthClient<typeof defaultBetterAuthClientOptions>
  >;

  private stateChangeEmitters = new Map<string, Subscription>();
  #broadcastChannel: InstanceType<typeof BroadcastChannel> | null = null;
  #tokenRefreshCheckInterval: NodeJS.Timeout | null = null;
  private config: OnAuthStateChangeConfig = {
    enableTokenRefreshDetection: true,
    tokenRefreshCheckInterval: TOKEN_REFRESH_CHECK_INTERVAL_MS,
  };

  /**
   * Last known session state for detecting auth state change event types.
   * Updated after each auth state change to determine which event to emit.
   */
  private lastSessionState: Session | null = null;

  /**
   * In-memory session cache with TTL-based expiration.
   * Provides <1ms synchronous reads for same-page navigation.
   */
  #sessionCache: {
    session: Session;
    expiresAt: number;
  } | null = null;

  /**
   * Invalidation flag prevents race conditions during sign-out.
   * Set before cache clear, checked before returning cached data.
   */
  #sessionCacheInvalidated: boolean = false;

  /**
   * Deduplicates in-flight requests by key to prevent thundering herd.
   * Used by getSession(), getJwtToken(), and potentially other methods.
   */
  private inFlightRequests = new InFlightRequestManager();
  //#endregion

  //#region Constructor
  constructor(
    betterAuthClientOptions: NeonBetterAuthOptions,
    config?: OnAuthStateChangeConfig
  ) {
    // Merge config
    if (config) {
      this.config = { ...this.config, ...config };
    }

    this.betterAuth = createAuthClient({
      ...betterAuthClientOptions,
      ...defaultBetterAuthClientOptions,
    });
  }
  //#endregion

  //#region PUBLIC API - Initialization
  /**
   * Initializes the Better Auth adapter
   * @group Initialization
   */
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
  //#endregion

  //#region PUBLIC API - Session Management
  /**
   * Retrieves the current user session
   * @group Session Management
   */
  getSession: AuthClient['getSession'] = async () => {
    try {
      // Step 1: Fast Path - Read from in-memory cache
      const cachedSession = this.getCachedSession();
      if (cachedSession) {
        // CRITICAL: Check invalidation flag one more time before returning
        // This catches the race condition where signOut() was called after we read
        // from cache but before we return. Without this check, we'd return stale data.
        if (this.isSessionCacheInvalidated()) {
          return { data: { session: null }, error: null };
        }

        return { data: { session: cachedSession }, error: null };
      }

      // Step 2: Deduplicate network request
      return await this.inFlightRequests.deduplicate('getSession', async () => {
        // Step 3: Slow Path - Fetch fresh session (network request)
        // Optimization: Extract JWT if server provides it in response header
        let headerJwt: string | null = null;
        const response = await this.betterAuth.getSession({
          fetchOptions: {
            onSuccess: (ctx) => {
              // Try to extract JWT from response header
              const jwt = ctx.response.headers.get('set-auth-jwt');
              if (jwt) {
                headerJwt = jwt;
              }
            },
          },
        });

        if (response.error) {
          return {
            data: { session: null },
            error: normalizeBetterAuthError(response.error),
          };
        }

        if (!response.data?.session || !response.data?.user) {
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
          return {
            data: { session: null },
            error: new AuthError(
              'Failed to map session',
              500,
              'unexpected_failure'
            ),
          };
        }

        if (!headerJwt) {
          return {
            data: { session: null },
            error: new AuthError(
              'Failed to get JWT token from response header. Please check if the server is configured correctly.',
              500,
              'unexpected_failure'
            ),
          };
        }

        // Enrich session with JWT token
        session.access_token = headerJwt;
        // Cache enriched session with TTL based on JWT expiration
        const ttl = this.calculateCacheTTL(headerJwt);
        this.setCachedSession(session, ttl);

        return { data: { session }, error: null };
      });
    } catch (error) {
      return {
        data: { session: null },
        error: normalizeBetterAuthError(error),
      };
    }
  };

  /**
   * Refreshes the current user session
   * @group Session Management
   */
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

  /**
   * Sets a user session
   * @group Session Management
   */
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
      const cachedSession = this.getCachedSession();
      if (cachedSession?.access_token) {
        // Verify JWT hasn't expired
        const exp = this.getJwtExpiration(cachedSession.access_token);
        if (exp && !this.isExpired(exp)) {
          console.log('[BetterAuth] JWT cache hit: returning cached token');
          return cachedSession.access_token;
        }
        console.log('[BetterAuth] JWT cache miss: token expired');
      }

      // Step 2: Deduplicate JWT fetch
      return await this.inFlightRequests.deduplicate(
        'getJwtToken',
        async () => {
          console.log('[BetterAuth] Fetching fresh JWT from /token endpoint');
          // Step 3: Fetch fresh JWT from /token endpoint
          const tokenResponse = await this.betterAuth.token();
          if (tokenResponse.error || !tokenResponse.data?.token) {
            return null;
          }
          const jwt = tokenResponse.data.token;

          // Step 4: Update session cache with new JWT if we have a session
          const currentSession = this.getCachedSession();
          if (currentSession) {
            currentSession.access_token = jwt;
            const ttl = this.calculateCacheTTL(jwt);
            this.setCachedSession(currentSession, ttl);
          }

          return jwt;
        }
      );
    } catch (error) {
      console.error('[getJwtToken] Error fetching JWT:', error);
      return null;
    }
  };
  //#endregion

  //#region PUBLIC API - Authentication
  /**
   * Signs up a new user with email and password
   * @group Authentication
   */
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

        // Emit SIGNED_IN event synchronously (matches Supabase)
        // Session is already cached, safe to emit now
        await this.notifyAllSubscribers('SIGNED_IN', data.session);
        this.lastSessionState = data.session;

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

  /**
   * Signs in anonymously
   * @group Authentication
   */
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

  /**
   * Signs in a user with email and password
   * @group Authentication
   */
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

        // Emit SIGNED_IN event synchronously (matches Supabase)
        // Session is already cached, safe to emit now
        await this.notifyAllSubscribers('SIGNED_IN', data.session);
        this.lastSessionState = data.session;

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

  /**
   * Signs in a user with an OAuth provider
   * @group Authentication
   */
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

  /**
   * Signs in a user with OTP (One-Time Password)
   * @group Authentication
   * @todo Add email-otp plugin to server
   */
  signInWithOtp: AuthClient['signInWithOtp'] = async () => {
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

  /**
   * Signs in with an ID token
   * @group Authentication
   * @deprecated Better Auth does not support direct OIDC ID token authentication.
   */
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

  /**
   * Signs in with SSO (Single Sign-On)
   * @group Authentication
   * @deprecated Better Auth does not support enterprise SAML SSO.
   */
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

  /**
   * Signs in with Web3 wallet
   * @group Authentication
   * @deprecated Better Auth does not support Web3/crypto wallet authentication.
   */
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

  /**
   * Signs out the current user
   * @group Authentication
   */
  signOut: AuthClient['signOut'] = async () => {
    try {
      // Clear cache IMMEDIATELY to prevent race conditions with concurrent getSession() calls
      // Setting invalidation flag ensures any in-flight getSession() calls will see the flag
      // and return null instead of stale cached data
      this.clearSessionCache();

      const result = await this.betterAuth.signOut();

      if (result.error) {
        return { error: normalizeBetterAuthError(result.error) };
      }

      // Emit SIGNED_OUT event immediately (synchronously) before application unmounts components
      // This prevents race condition where app unsubscribes before useSession detects sign-out
      if (this.lastSessionState) {
        await this.notifyAllSubscribers('SIGNED_OUT', null);
        this.lastSessionState = null;
      }

      return { error: null };
    } catch (error) {
      return { error: normalizeBetterAuthError(error) };
    }
  };
  //#endregion

  //#region PUBLIC API - User Management
  /**
   * Gets the currently authenticated user
   * @group User Management
   */
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

  /**
   * Gets the claims from a JWT token
   * @group User Management
   */
  getClaims: AuthClient['getClaims'] = async (jwt?: string) => {
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
   * Updates the current user
   * @group User Management
   */
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

      // Emit USER_UPDATED event synchronously (matches Supabase)
      await this.notifyAllSubscribers(
        'USER_UPDATED',
        updatedSessionResult.data.session
      );
      this.lastSessionState = updatedSessionResult.data.session;

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

  /**
   * Gets the identities linked to the current user
   * @group User Management
   */
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

      // Deduplicate account list fetch to prevent thundering herd
      return await this.inFlightRequests.deduplicate(
        'getUserIdentities',
        async () => {
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
        }
      );
    } catch (error) {
      return {
        data: null,
        error: normalizeBetterAuthError(error),
      };
    }
  };

  /**
   * Unlinks an identity from the current user
   * @group User Management
   */
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

      // Emit USER_UPDATED event synchronously (identity unlinked)
      // Get fresh session to reflect unlinked identity
      const updatedSession = await this.getSession();
      if (updatedSession.data.session) {
        await this.notifyAllSubscribers(
          'USER_UPDATED',
          updatedSession.data.session
        );
        this.lastSessionState = updatedSession.data.session;
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
  //#endregion

  //#region PUBLIC API - Verification & Password Reset
  /**
   * Verifies an OTP (One-Time Password)
   * @group Verification & Password Reset
   */
  verifyOtp: AuthClient['verifyOtp'] = async (params) => {
    try {
      if ('email' in params && params.email) {
        return await this.verifyEmailOtp(params);
      }
      if ('phone' in params && params.phone) {
        return await this.verifyPhoneOtp(params);
      }
      if ('token_hash' in params && params.token_hash) {
        return await this.verifyTokenHashOtp(params);
      }
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

  /**
   * Resets a user's password by sending a reset email
   * @group Verification & Password Reset
   */
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

  /**
   * Reauthenticates the user
   * @group Verification & Password Reset
   */
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

  /**
   * Resends a verification email
   * @group Verification & Password Reset
   */
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

  /**
   * Exchanges an authorization code for a session
   * @group Verification & Password Reset
   */
  exchangeCodeForSession: AuthClient['exchangeCodeForSession'] = async (
    _authCode: string
  ) => {
    try {
      // Better Auth handles OAuth callbacks automatically
      // Just check if we have a session now
      const sessionResult = await this.getSession();

      if (sessionResult.data.session) {
        // Emit SIGNED_IN event synchronously (OAuth callback completed)
        await this.notifyAllSubscribers(
          'SIGNED_IN',
          sessionResult.data.session
        );
        this.lastSessionState = sessionResult.data.session;

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
  //#endregion

  //#region PUBLIC API - Event System
  /**
   * Listens for authentication state changes
   * @group Event System
   */
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
  //#endregion

  //#region PUBLIC API - Auto Refresh & Configuration
  /**
   * Checks if error throwing is enabled
   * @group Auto Refresh & Configuration
   */
  isThrowOnErrorEnabled: AuthClient['isThrowOnErrorEnabled'] = () => false;

  /**
   * Starts automatic token refresh
   * @group Auto Refresh & Configuration
   */
  startAutoRefresh: AuthClient['startAutoRefresh'] = async () => {
    // Better Auth handles auto-refresh automatically
    // No explicit start needed
    return Promise.resolve();
  };

  /**
   * Stops automatic token refresh
   * @group Auto Refresh & Configuration
   */
  stopAutoRefresh: AuthClient['stopAutoRefresh'] = async () => {
    // Better Auth handles auto-refresh automatically
    // No explicit stop needed
    return Promise.resolve();
  };
  //#endregion

  //#region PRIVATE HELPERS - Session Cache
  private getCachedSession(): Session | null {
    // Check invalidation flag first - prevents returning stale data during sign-out
    if (this.#sessionCacheInvalidated) {
      console.log('[BetterAuth] Cache miss: session invalidated');
      return null;
    }

    if (!this.#sessionCache) {
      console.log('[BetterAuth] Cache miss: no cached session');
      return null;
    }

    // Lazy expiration check
    if (Date.now() > this.#sessionCache.expiresAt) {
      console.log('[BetterAuth] Cache miss: session expired');
      this.#sessionCache = null;
      return null;
    }

    console.log('[BetterAuth] Cache hit: returning cached session');
    return this.#sessionCache.session;
  }

  private setCachedSession(session: Session, ttl = SESSION_CACHE_TTL_MS): void {
    console.log(`[BetterAuth] Setting cached session (TTL: ${ttl}ms)`);
    this.#sessionCache = {
      session,
      expiresAt: Date.now() + ttl,
    };
    this.#sessionCacheInvalidated = false;
  }

  private clearSessionCache(): void {
    this.#sessionCache = null;
    this.#sessionCacheInvalidated = true;
  }

  private isSessionCacheInvalidated(): boolean {
    return this.#sessionCacheInvalidated;
  }
  //#endregion

  //#region PRIVATE HELPERS - JWT Utilities
  private isExpired(expiresAt: Date | number | null | undefined): boolean {
    if (!expiresAt) return true;
    const now = Math.floor(Date.now() / 1000);

    const expiresAtNumber =
      typeof expiresAt === 'number'
        ? expiresAt
        : Math.floor(expiresAt.getTime() / 1000);

    return expiresAtNumber <= now + Math.floor(CLOCK_SKEW_BUFFER_MS / 1000);
  }

  private getJwtExpiration(jwt: string): number | null {
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

  private calculateCacheTTL(jwt: string | undefined): number {
    if (!jwt) {
      return SESSION_CACHE_TTL_MS;
    }

    const exp = this.getJwtExpiration(jwt);
    if (!exp) {
      return SESSION_CACHE_TTL_MS;
    }

    const now = Date.now();
    const expiresAtMs = exp * 1000;
    const ttl = expiresAtMs - now - CLOCK_SKEW_BUFFER_MS;

    return Math.max(ttl, 1000);
  }
  //#endregion

  //#region PRIVATE HELPERS - Verification
  private async verifyEmailOtp(
    params: Extract<Parameters<AuthClient['verifyOtp']>[0], { email: string }>
  ) {
    const { token, type } = params;

    // Magic link verification
    if (type === 'magiclink' || type === 'email') {
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

      await this.notifyAllSubscribers('SIGNED_IN', sessionResult.data.session);
      this.lastSessionState = sessionResult.data.session;

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
      const result = await this.betterAuth.verifyEmail?.({
        query: { token },
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

    // Password recovery verification
    if (type === 'recovery') {
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

      const sessionResult = await this.getSession();

      if (sessionResult.data.session) {
        await this.notifyAllSubscribers(
          'USER_UPDATED',
          sessionResult.data.session
        );
        this.lastSessionState = sessionResult.data.session;
      }

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

  private async verifyPhoneOtp(
    _params: Extract<Parameters<AuthClient['verifyOtp']>[0], { phone: string }>
  ) {
    return {
      data: { user: null, session: null },
      error: new AuthError(
        'Phone OTP verification not supported by Better Auth',
        501,
        'phone_provider_disabled'
      ),
    };
  }

  private async verifyTokenHashOtp(
    params: Extract<
      Parameters<AuthClient['verifyOtp']>[0],
      { token_hash: string }
    >
  ) {
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

      await this.notifyAllSubscribers('SIGNED_IN', sessionResult.data.session);
      this.lastSessionState = sessionResult.data.session;

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

      if (sessionResult.data.session) {
        await this.notifyAllSubscribers(
          'USER_UPDATED',
          sessionResult.data.session
        );
        this.lastSessionState = sessionResult.data.session;
      }

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
  //#endregion

  //#region PRIVATE HELPERS - Event System
  private async emitInitialSession(
    callback: (
      event: AuthChangeEvent,
      session: Session | null
    ) => void | Promise<void>
  ): Promise<void> {
    try {
      const { data, error } = await this.getSession();

      if (error) {
        await callback('INITIAL_SESSION', null);
        return;
      }

      await callback('INITIAL_SESSION', data.session);
      this.lastSessionState = data.session;
    } catch (_error) {
      await callback('INITIAL_SESSION', null);
    }
  }

  private async notifyAllSubscribers(
    event: AuthChangeEvent,
    session: Session | null,
    broadcast = true
  ): Promise<void> {
    // Broadcast to other tabs first
    if (broadcast && this.#broadcastChannel) {
      try {
        this.#broadcastChannel.postMessage({
          event,
          session,
          timestamp: Date.now(),
        });
      } catch (_error) {
        // BroadcastChannel may fail in some environments (e.g., Node.js)
      }
    }

    // Notify all local subscribers
    const promises = Array.from(this.stateChangeEmitters.values()).map(
      (subscription) => {
        try {
          return Promise.resolve(subscription.callback(event, session));
        } catch (_error) {
          // Auth state change callback error - skip this subscriber
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
    if (!this.#broadcastChannel) {
      try {
        this.#broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);

        // Listen for messages from other tabs
        this.#broadcastChannel.onmessage = async (event: MessageEvent) => {
          const { event: authEvent, session } = event.data;

          // Update in-memory cache when receiving broadcast
          // This ensures Tab B's cache stays in sync with Tab A's auth state
          if (session) {
            // Tab B receives sign-in from Tab A → cache session in memory
            const ttl = this.calculateCacheTTL(session.access_token);
            console.log(
              '[BroadcastChannel] Setting cached session with TTL:',
              ttl,
              'for session:',
              session.access_token
            );
            this.setCachedSession(session, ttl);
          } else {
            // Tab B receives sign-out from Tab A → clear in-memory cache
            this.clearSessionCache();
          }

          // Emit event locally (do not broadcast back to avoid infinite loop)
          await this.notifyAllSubscribers(authEvent, session, false);
          this.lastSessionState = session;
        };
      } catch (error) {
        // BroadcastChannel creation failed - cross-tab sync unavailable
        console.warn('[BroadcastChannel] Failed to initialize:', error);
      }
    }
  }

  private closeBroadcastChannel(): void {
    if (this.#broadcastChannel) {
      this.#broadcastChannel.close();
      this.#broadcastChannel = null;
    }
  }

  private startTokenRefreshDetection(): void {
    // Only start if explicitly enabled
    if (!this.config.enableTokenRefreshDetection) {
      return;
    }

    // Don't start if already running
    if (this.#tokenRefreshCheckInterval) {
      return;
    }

    this.#tokenRefreshCheckInterval = setInterval(async () => {
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

        // Like Supabase: Detect if token was refreshed (< threshold seconds to expiry)
        // Better Auth auto-refreshes tokens, we just detect and emit the event
        if (
          expiresInSeconds <= Math.floor(TOKEN_REFRESH_THRESHOLD_MS / 1000) &&
          expiresInSeconds > 0
        ) {
          // Token is fresh (was likely just refreshed), emit TOKEN_REFRESHED
          await this.notifyAllSubscribers('TOKEN_REFRESHED', session);
          this.lastSessionState = session;
        }
      } catch (_error) {
        // Token refresh detection error - skip this check
      }
    }, this.config.tokenRefreshCheckInterval);
  }

  private stopTokenRefreshDetection(): void {
    if (this.#tokenRefreshCheckInterval) {
      clearInterval(this.#tokenRefreshCheckInterval);
      this.#tokenRefreshCheckInterval = null;
    }
  }
  //#endregion
}
