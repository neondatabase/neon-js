import { AuthError, type AuthClient } from '@/auth/auth-interface';
import type { Session, AuthChangeEvent, Subscription } from '@supabase/auth-js';
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
  admin: AuthClient['admin'] = undefined as never;
  mfa: AuthClient['mfa'] = undefined as never;
  oauth: AuthClient['oauth'] = undefined as never;
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

  /** Last session state for detecting auth change events */
  private lastSessionState: Session | null = null;

  /** In-memory session cache with TTL expiration */
  #sessionCache: {
    session: Session;
    expiresAt: number;
  } | null = null;

  /** Deduplicates concurrent requests to prevent thundering herd */
  private inFlightRequests = new InFlightRequestManager();
  //#endregion

  //#region Constructor
  constructor(
    betterAuthClientOptions: NeonBetterAuthOptions,
    config?: OnAuthStateChangeConfig
  ) {
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
  initialize: AuthClient['initialize'] = async () => {
    try {
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
  getSession: AuthClient['getSession'] = async () => {
    try {
      const cachedSession = this.getCachedSession();
      if (cachedSession) {
        // Re-check cache to prevent stale data from concurrent signOut()
        if (this.#sessionCache === null) {
          return { data: { session: null }, error: null };
        }

        return { data: { session: cachedSession }, error: null };
      }

      return await this.inFlightRequests.deduplicate('getSession', async () => {
        let headerJwt: string | null = null;
        const response = await this.betterAuth.getSession({
          fetchOptions: {
            onSuccess: (ctx) => {
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

        session.access_token = headerJwt;
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

  refreshSession: AuthClient['refreshSession'] = async () => {
    try {
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
      const cachedSession = this.getCachedSession();
      if (cachedSession?.access_token) {
        const exp = this.getJwtExpiration(cachedSession.access_token);
        if (exp && !this.isExpired(exp)) {
          console.log('[BetterAuth] JWT cache hit: returning cached token');
          return cachedSession.access_token;
        }
        console.log('[BetterAuth] JWT cache miss: token expired');
      }

      return await this.inFlightRequests.deduplicate(
        'getJwtToken',
        async () => {
          console.log('[BetterAuth] Fetching fresh JWT from /token endpoint');
          const tokenResponse = await this.betterAuth.token();
          if (tokenResponse.error || !tokenResponse.data?.token) {
            return null;
          }
          const jwt = tokenResponse.data.token;

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
  signUp: AuthClient['signUp'] = async (credentials) => {
    try {
      if ('email' in credentials && credentials.email && credentials.password) {
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

        // Emit SIGNED_IN synchronously (matches Supabase pattern)
        await this.notifyAllSubscribers('SIGNED_IN', data.session);
        this.lastSessionState = data.session;

        return { data, error: null };
      } else if ('phone' in credentials && credentials.phone) {
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

  signInAnonymously: AuthClient['signInAnonymously'] = async () => {
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
      if ('email' in credentials && credentials.email) {
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

        // Emit SIGNED_IN synchronously (matches Supabase pattern)
        await this.notifyAllSubscribers('SIGNED_IN', data.session);
        this.lastSessionState = data.session;

        return { data, error: null };
      } else if ('phone' in credentials && credentials.phone) {
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

      await this.betterAuth.signIn.social({
        provider,
        callbackURL:
          options?.redirectTo ||
          (globalThis.window === undefined ? '' : globalThis.location.origin),
      });

      return {
        data: {
          provider,
          url:
            options?.redirectTo ||
            (globalThis.window === undefined ? '' : globalThis.location.origin),
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
   * @deprecated Better Auth uses OAuth authorization code flow and does not accept ID tokens.
   */
  signInWithIdToken: AuthClient['signInWithIdToken'] = async (credentials) => {
    const attemptedProvider = credentials.provider;
    const hasAccessToken = !!credentials.access_token;
    const hasNonce = !!credentials.nonce;

    return {
      data: {
        user: null,
        session: null,
      },
      error: new AuthError(
        `Better Auth does not support OIDC ID token authentication. Attempted with provider: ${attemptedProvider}${hasAccessToken ? ' (with access_token)' : ''}${hasNonce ? ' (with nonce)' : ''}. Use signInWithOAuth() instead.`,
        501,
        'id_token_provider_disabled'
      ),
    };
  };

  /**
   * @deprecated Better Auth only supports OAuth social providers, not enterprise SAML SSO.
   */
  signInWithSSO: AuthClient['signInWithSSO'] = async (params) => {
    const attemptedWith =
      'providerId' in params
        ? `provider ID: ${params.providerId}`
        : `domain: ${'domain' in params ? params.domain : 'unknown'}`;

    return {
      data: null,
      error: new AuthError(
        `Better Auth does not support enterprise SAML SSO. Attempted with ${attemptedWith}. Use signInWithOAuth() for OAuth providers instead.`,
        501,
        'sso_provider_disabled'
      ),
    };
  };

  /**
   * @deprecated Better Auth does not support Web3/crypto wallet authentication.
   */
  signInWithWeb3: AuthClient['signInWithWeb3'] = async (credentials) => {
    const attemptedChain = credentials.chain;

    return {
      data: {
        user: null,
        session: null,
      },
      error: new AuthError(
        `Better Auth does not support Web3 authentication. Attempted with chain: ${attemptedChain}. Supported: OAuth, email/password, magic link.`,
        501,
        'web3_provider_disabled'
      ),
    };
  };

  signOut: AuthClient['signOut'] = async () => {
    try {
      // Clear cache immediately to prevent race conditions with in-flight requests
      this.clearSessionCache();

      const result = await this.betterAuth.signOut();

      if (result.error) {
        return { error: normalizeBetterAuthError(result.error) };
      }

      // Emit SIGNED_OUT synchronously before component unmount
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

      const updatedSessionResult = await this.getSession();

      if (!updatedSessionResult.data.session) {
        throw new Error('Failed to retrieve updated user');
      }

      // Emit USER_UPDATED synchronously (matches Supabase pattern)
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

      return await this.inFlightRequests.deduplicate(
        'getUserIdentities',
        async () => {
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

  // @ts-expect-error - this should infer the overload correctly...
  linkIdentity: AuthClient['linkIdentity'] = async (credentials) => {
    if ('token' in credentials) {
      return {
        data: { user: null, session: null },
        error: new AuthError(
          'Better Auth does not support linking identities with ID tokens. Use OAuth credentials instead.',
          501,
          'id_token_provider_disabled'
        ),
      };
    }

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
        (globalThis.window === undefined ? '' : globalThis.location.origin);

      const scopes = oauthCredentials.options?.scopes
        ? oauthCredentials.options.scopes
            .split(' ')
            .filter((s: string) => s.length > 0)
        : undefined;

      await this.betterAuth.linkSocial({
        provider,
        callbackURL,
        scopes,
      });

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
  };

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

      const result = await this.betterAuth.unlinkAccount({
        providerId: identity.provider,
      });

      if (result?.error) {
        return {
          data: null,
          error: normalizeBetterAuthError(result.error),
        };
      }

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

  resetPasswordForEmail: AuthClient['resetPasswordForEmail'] = async (
    email,
    options
  ) => {
    try {
      // TODO: this will fail, we need to setup `sendResetPassword` in the server adapter
      const result = await this.betterAuth.forgetPassword({
        email,
        redirectTo:
          options?.redirectTo ||
          (globalThis.window === undefined ? '' : globalThis.location.origin),
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
   * @deprecated Better Auth uses password reset flow instead of nonce-based reauthentication.
   */
  reauthenticate: AuthClient['reauthenticate'] = async () => {
    return {
      data: { user: null, session: null },
      error: new AuthError(
        'Better Auth does not support nonce-based reauthentication. For password changes, use the password reset flow (resetPasswordForEmail) or access Better Auth directly.',
        400,
        'feature_not_supported'
      ),
    };
  };

  resend: AuthClient['resend'] = async (credentials) => {
    try {
      if ('email' in credentials) {
        const { email, type, options } = credentials;

        if (type === 'signup' || type === 'email_change') {
          const result = await this.betterAuth.sendVerificationEmail({
            email,
            callbackURL:
              options?.emailRedirectTo ||
              (globalThis.window === undefined
                ? ''
                : globalThis.location.origin),
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

        return {
          data: { user: null, session: null },
          error: new AuthError(
            `Unsupported resend type: ${type}`,
            400,
            'validation_failed'
          ),
        };
      }

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

  exchangeCodeForSession: AuthClient['exchangeCodeForSession'] = async (
    _authCode: string
  ) => {
    try {
      const sessionResult = await this.getSession();

      if (sessionResult.data.session) {
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
  onAuthStateChange: AuthClient['onAuthStateChange'] = (callback) => {
    const id = crypto.randomUUID();

    const subscription: Subscription = {
      id,
      callback,
      unsubscribe: () => {
        this.stateChangeEmitters.delete(id);

        if (this.stateChangeEmitters.size === 0) {
          this.stopTokenRefreshDetection();
          this.closeBroadcastChannel();
        }
      },
    };

    this.stateChangeEmitters.set(id, subscription);

    if (this.stateChangeEmitters.size === 1) {
      this.initializeBroadcastChannel();
      this.startTokenRefreshDetection();
    }

    this.emitInitialSession(callback);

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
  isThrowOnErrorEnabled: AuthClient['isThrowOnErrorEnabled'] = () => false;

  startAutoRefresh: AuthClient['startAutoRefresh'] = async () => {
    return;
  };

  stopAutoRefresh: AuthClient['stopAutoRefresh'] = async () => {
    return;
  };
  //#endregion

  //#region PRIVATE HELPERS - Session Cache
  private getCachedSession(): Session | null {
    if (!this.#sessionCache) {
      console.log('[BetterAuth] Cache miss: no cached session');
      return null;
    }

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
  }

  private clearSessionCache(): void {
    this.#sessionCache = null;
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
    } catch {
      await callback('INITIAL_SESSION', null);
    }
  }

  private async notifyAllSubscribers(
    event: AuthChangeEvent,
    session: Session | null,
    broadcast = true
  ): Promise<void> {
    if (broadcast && this.#broadcastChannel) {
      try {
        this.#broadcastChannel.postMessage({
          event,
          session,
          timestamp: Date.now(),
        });
      } catch {
        // BroadcastChannel may fail in some environments (e.g., Node.js)
      }
    }

    const promises = [...this.stateChangeEmitters.values()].map(
      (subscription) => {
        try {
          return Promise.resolve(subscription.callback(event, session));
        } catch {
          return Promise.resolve();
        }
      }
    );

    await Promise.allSettled(promises);
  }

  private initializeBroadcastChannel(): void {
    if (!supportsBroadcastChannel()) {
      return;
    }

    if (!this.#broadcastChannel) {
      try {
        this.#broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);

        this.#broadcastChannel.addEventListener(
          'message',
          async (event: MessageEvent) => {
            const { event: authEvent, session } = event.data;

            // Sync in-memory cache with cross-tab auth state
            if (session) {
              const ttl = this.calculateCacheTTL(session.access_token);
              console.log(
                '[BroadcastChannel] Setting cached session with TTL:',
                ttl,
                'for session:',
                session.access_token
              );
              this.setCachedSession(session, ttl);
            } else {
              this.clearSessionCache();
            }

            await this.notifyAllSubscribers(authEvent, session, false);
            this.lastSessionState = session;
          }
        );
      } catch (error) {
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
    if (!this.config.enableTokenRefreshDetection) {
      return;
    }

    if (this.#tokenRefreshCheckInterval) {
      return;
    }

    this.#tokenRefreshCheckInterval = setInterval(async () => {
      try {
        const sessionResult = await this.getSession();

        if (!sessionResult.data.session) {
          return;
        }

        const session = sessionResult.data.session;
        const now = Math.floor(Date.now() / 1000);
        const expiresAt = session.expires_at ?? now;
        const expiresInSeconds = expiresAt - now;

        if (expiresInSeconds <= 0) {
          await this.notifyAllSubscribers('SIGNED_OUT', null);
          this.lastSessionState = null;
          return;
        }

        // Detect token refresh (matches Supabase pattern)
        if (
          expiresInSeconds <= Math.floor(TOKEN_REFRESH_THRESHOLD_MS / 1000) &&
          expiresInSeconds > 0
        ) {
          await this.notifyAllSubscribers('TOKEN_REFRESHED', session);
          this.lastSessionState = session;
        }
      } catch {
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
