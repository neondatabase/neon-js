import { AuthError, type AuthClient } from '../../auth-interface';
import type {
  Session,
  AuthChangeEvent,
  Subscription,
  JwtHeader,
  JwtPayload,
  Provider,
  VerifyMobileOtpParams,
  VerifyEmailOtpParams,
} from '@supabase/auth-js';
import {
  createAuthClient,
  type BetterAuthClientOptions,
} from 'better-auth/client';
import type { NeonBetterAuthOptions } from './better-auth-types';
import {
  normalizeBetterAuthError,
  mapBetterAuthSessionToSupabase,
  supportsBroadcastChannel,
  mapBetterAuthUserIdentityToSupabase,
} from './better-auth-helpers';
import {
  jwtClient,
  adminClient,
  organizationClient,
  emailOTPClient,
  phoneNumberClient,
  magicLinkClient,
} from 'better-auth/client/plugins';
import { InFlightRequestManager } from './in-flight-request-manager';
import {
  SESSION_CACHE_TTL_MS,
  CLOCK_SKEW_BUFFER_MS,
  BROADCAST_CHANNEL_NAME,
} from './constants';
import { base64url, decodeJwt, decodeProtectedHeader } from 'jose';

/**
 * Better Auth adapter implementing the Supabase-compatible AuthClient interface.
 * See CLAUDE.md for architecture details and API mappings.
 */
const defaultBetterAuthClientOptions = {
  plugins: [
    jwtClient(),
    adminClient(),
    organizationClient(),

    // TODO: add these in
    emailOTPClient(),
    phoneNumberClient(),
    magicLinkClient(),
  ],
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
  constructor(betterAuthClientOptions: NeonBetterAuthOptions) {
    // Preserve user's onSuccess callback if they provided one
    const userOnSuccess = betterAuthClientOptions.fetchOptions?.onSuccess;

    this.betterAuth = createAuthClient({
      ...betterAuthClientOptions,
      ...defaultBetterAuthClientOptions,
      fetchOptions: {
        ...betterAuthClientOptions.fetchOptions,
        onSuccess: async (ctx) => {
          const url = ctx.request.url.toString();
          const responseData = ctx.data;

          // Detect sign-in/sign-up
          if (url.includes('/sign-in') || url.includes('/sign-up')) {
            if (responseData?.session && responseData?.user) {
              const session = mapBetterAuthSessionToSupabase(
                responseData.session,
                responseData.user
              );
              if (session) {
                await this.notifyAllSubscribers('SIGNED_IN', session);
                this.lastSessionState = session;
              }
            }
          }

          // Detect sign-out
          else if (url.includes('/sign-out')) {
            await this.notifyAllSubscribers('SIGNED_OUT', null);
            this.lastSessionState = null;
          }

          // Detect token refresh in get-session or token endpoints
          else if (url.includes('/get-session') || url.includes('/token')) {
            if (responseData?.session && responseData?.user) {
              const session = mapBetterAuthSessionToSupabase(
                responseData.session,
                responseData.user
              );

              if (session?.access_token) {
                const oldToken = this.lastSessionState?.access_token;

                // Token refreshed if access_token changed
                if (oldToken && oldToken !== session.access_token) {
                  await this.notifyAllSubscribers('TOKEN_REFRESHED', session);
                }

                this.lastSessionState = session;
              }
            }
          }

          // Detect user updates
          else if (
            url.includes('/update-user') &&
            responseData?.session &&
            responseData?.user
          ) {
            const session = mapBetterAuthSessionToSupabase(
              responseData.session,
              responseData.user
            );
            if (session) {
              await this.notifyAllSubscribers('USER_UPDATED', session);
              this.lastSessionState = session;
            }
          }

          // Call user's onSuccess callback if they provided one
          if (userOnSuccess) {
            await userOnSuccess(ctx);
          }
        },
      },
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
  async getSession(options?: {
    forceFetch?: boolean;
  }): ReturnType<AuthClient['getSession']> {
    try {
      // Skip cache if forceFetch is true
      if (!options?.forceFetch) {
        const cachedSession = this.getCachedSession();
        if (cachedSession) {
          // Re-check cache to prevent stale data from concurrent signOut()
          if (this.#sessionCache === null) {
            return { data: { session: null }, error: null };
          }

          return { data: { session: cachedSession }, error: null };
        }
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
  }

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

  // TODO: we need to implement a custom plugin to allow setting external sessions
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

        // TODO: for channels (sms/whatsapp), we would need to implement the channel-based plugins
        // TODO: for captcha, we would need to implement the captcha plugin
        const result = await this.betterAuth.signUp.email({
          email: credentials.email,
          password: credentials.password,
          name: displayName,
          callbackURL: credentials.options?.emailRedirectTo,
          // TODO: user's metadata, we need to define them at the server adapter, else this won't be stored I think
          ...credentials.options?.data,
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

        return { data, error: null };
      } else if ('phone' in credentials && credentials.phone) {
        // TODO: we would need to add the phone-number plugin
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

  // TODO: we need to add the anonymous() plugin to the server adapter
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
        // TODO: for captcha, we would need to add the captcha plugin
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

        return { data, error: null };
      } else if ('phone' in credentials && credentials.phone) {
        // TODO: we would need to add the phone-number plugin
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

  // TODO: we should omit queryParams from the credentials
  signInWithOAuth: AuthClient['signInWithOAuth'] = async (credentials) => {
    try {
      const { provider, options } = credentials;

      await this.betterAuth.signIn.social({
        provider,
        // Convert scopes from Supabase format (space-separated string) to Better Auth format (array)
        scopes: options?.scopes?.split(' '),
        disableRedirect: options?.skipBrowserRedirect,
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
  // TODO: we need to add the email-otp plugin to the server adapter
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

  signInWithIdToken: AuthClient['signInWithIdToken'] = async (credentials) => {
    try {
      const result = await this.betterAuth.signIn.social({
        provider: credentials.provider,
        idToken: {
          token: credentials.token,
          accessToken: credentials.access_token,
          nonce: credentials.nonce,
        },
      });

      if (result.error) {
        return {
          data: { user: null, session: null },
          error: normalizeBetterAuthError(result.error),
        };
      }

      if (!('user' in result.data) || !result.data.user) {
        return {
          data: { user: null, session: null },
          error: new AuthError(
            'Failed to sign in with ID token',
            500,
            'unexpected_failure'
          ),
        };
      }

      const session = await this.getSession();
      if (session.error || !session.data.session) {
        return {
          data: { user: null, session: null },
          error:
            session.error ||
            new AuthError('Failed to get session', 500, 'unexpected_failure'),
        };
      }

      return {
        data: {
          user: session.data.session.user,
          session: session.data.session,
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

  // TODO: we need to add the sso plugin to the server adapter
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

  // TODO: we need to add the SIWE plugin to the server adapter
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
            new AuthError('No user session found', 404, 'not_found'),
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

  // TODO: we dont have the options param, like JWKS
  getClaims = async (jwtArg?: string) => {
    try {
      let jwt = jwtArg;

      // Get session if JWT not provided
      if (!jwt) {
        const sessionResult = await this.getSession();

        if (sessionResult.error || !sessionResult.data?.session) {
          return {
            data: null,
            error:
              sessionResult.error ||
              new AuthError('No user session found', 404, 'session_not_found'),
          };
        }

        jwt = sessionResult.data.session.access_token;
      }

      if (!jwt) {
        return {
          data: null,
          error: new AuthError(
            'No access token found',
            404,
            'session_not_found'
          ),
        };
      }

      // Split JWT into parts
      const tokenParts = jwt.split('.');
      if (tokenParts.length !== 3) {
        return {
          data: null,
          error: new AuthError('Invalid token format', 400, 'bad_jwt'),
        };
      }

      try {
        // Decode header using JOSE
        const header = decodeProtectedHeader(jwt) as JwtHeader;

        // Decode payload using JOSE
        const claims = decodeJwt(jwt) as JwtPayload;

        // Decode signature to Uint8Array using JOSE's base64url
        const signature = base64url.decode(jwt.split('.')[2]);

        return {
          data: {
            header,
            claims,
            signature,
          },
          error: null,
        };
      } catch (error) {
        return {
          data: null,
          error: normalizeBetterAuthError(error),
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
      if (attributes.password) {
        return {
          data: { user: null },
          error: new AuthError(
            'The password cannot be updated through the updateUser method, use the changePassword method instead.',
            400,
            'feature_not_supported'
          ),
        };
      }

      if (attributes.email) {
        return {
          data: { user: null },
          error: new AuthError(
            // TODO: check the changeEmail method in the better-auth docs
            'The email cannot be updated through the updateUser method, use the changeEmail method instead.',
            400,
            'feature_not_supported'
          ),
        };
      }

      const result = await this.betterAuth.updateUser({
        ...attributes.data,
      });

      if (result.data?.status) {
        return {
          data: { user: null },
          error: new AuthError('Failed to update user', 400, 'bad_request'),
        };
      }

      if (result?.error) {
        return {
          data: { user: null },
          error: normalizeBetterAuthError(result.error),
        };
      }

      const updatedSessionResult = await this.getSession({ forceFetch: true });
      if (!updatedSessionResult.data.session) {
        throw new Error('Failed to retrieve updated user');
      }

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
          const result = await this.betterAuth.listAccounts();

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

          const identitiesPromises = result.data.map(async (account) => {
            let accountInfo = null;
            try {
              const infoResult = await this.betterAuth.accountInfo({
                accountId: account.accountId,
              });
              accountInfo = infoResult.data;
            } catch (error) {
              // If getAccountInfo fails, continue with basic data
              console.warn(
                `Failed to get account info for ${account.providerId}:`,
                error
              );
            }

            return mapBetterAuthUserIdentityToSupabase(
              account,
              accountInfo ?? null
            );
          });

          const identities = await Promise.all(identitiesPromises);

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

  // TODO: we need to enable the account/accountLinking plugin to the server adapter
  linkIdentity: AuthClient['linkIdentity'] = async (credentials) => {
    const provider = credentials.provider as Provider;
    try {
      const sessionResult = await this.getSession();

      if (sessionResult.error || !sessionResult.data.session) {
        return {
          data: { provider, url: null, user: null, session: null },
          error:
            sessionResult.error ||
            new AuthError('No user session found', 401, 'session_not_found'),
        };
      }

      // Link with ID token (direct)
      if ('token' in credentials) {
        const result = await this.betterAuth.linkSocial({
          provider,
          idToken: {
            token: credentials.token,
            accessToken: credentials.access_token,
            nonce: credentials.nonce,
          },
        });

        if (result.error) {
          return {
            data: { user: null, session: null, provider, url: null },
            error: normalizeBetterAuthError(result.error),
          };
        }

        return {
          data: {
            user: sessionResult.data.session.user,
            session: sessionResult.data.session,
            provider,
            url: result.data?.url,
          },
          error: null,
        };
      }

      // OAuth flow (redirect)
      const callbackURL =
        credentials.options?.redirectTo ||
        (globalThis.window === undefined ? '' : globalThis.location.origin);
      const scopes = credentials.options?.scopes
        ?.split(' ')
        .filter((s: string) => s.length > 0);

      const result = await this.betterAuth.linkSocial({
        provider,
        callbackURL,
        errorCallbackURL: callbackURL
          ? `${callbackURL}?error=linking-failed`
          : undefined,
        scopes,
      });

      if (result.error) {
        return {
          data: { provider, url: null, user: null, session: null },
          error: normalizeBetterAuthError(result.error),
        };
      }

      return {
        data: {
          provider,
          url: result.data?.url,
          user: sessionResult.data.session.user,
          session: sessionResult.data.session,
        },
        error: null,
      };
    } catch (error) {
      return {
        data: { provider, url: null, user: null, session: null },
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

      const identities = await this.getUserIdentities();
      if (identities.error || !identities.data) {
        return {
          data: null,
          error:
            identities.error ||
            new AuthError('Failed to fetch identities', 500, 'internal_error'),
        };
      }

      // Find the identity by internal DB ID
      const targetIdentity = identities.data.identities.find(
        (i) => i.id === identity.identity_id
      );
      if (!targetIdentity) {
        return {
          data: null,
          error: new AuthError('Identity not found', 404, 'identity_not_found'),
        };
      }

      // Map to better-auth fields
      const providerId = targetIdentity.provider; // e.g., "google"
      const accountId = targetIdentity.identity_id; // e.g., "google-user-id-12345"

      // Call better-auth
      const result = await this.betterAuth.unlinkAccount({
        providerId,
        accountId,
      });

      if (result?.error) {
        return {
          data: null,
          error: normalizeBetterAuthError(result.error),
        };
      }

      const updatedSession = await this.getSession({ forceFetch: true });
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

  // TODO: add emailOTP plugin to the server adapter
  // TODO: add twoFactor plugin to the server adapter
  // TODO: add magiclink plugin to the server adapter
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
        // TODO: this will fail, we need handlers for this in this code
        return {
          data: { user: null, session: null },
          error: new AuthError(
            'Token hash verification not supported',
            400,
            'feature_not_supported'
          ),
        };
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

  // TODO: this will only work with a magic link and not with the OTP token flow
  // we need to derive which flow is being used and handle it accordingly
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

  // TODO: we would need a custom plugin to be able to actually recreate the session
  reauthenticate: AuthClient['reauthenticate'] = async () => {
    const newSession = await this.getSession();

    if (newSession.error || !newSession.data.session) {
      return {
        data: { user: null, session: null },
        error: new AuthError('No session found', 401, 'session_not_found'),
      };
    }

    return {
      data: {
        user: newSession.data.session?.user || null,
        session: newSession.data.session,
      },
      error: null,
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
        const { phone, type } = credentials;

        if (type === 'sms' || type === 'phone_change') {
          const result = await this.betterAuth.phoneNumber.sendOtp({
            phoneNumber: phone,
          });

          if (result?.error) {
            return {
              data: { user: null, session: null },
              error: normalizeBetterAuthError(result.error),
            };
          }

          const messageId =
            type === 'sms' ? 'sms-otp-sent' : 'phone-change-otp-sent';

          return {
            data: { messageId: messageId, user: null, session: null },
            error: null,
          };
        }
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
          this.closeBroadcastChannel();
        }
      },
    };

    this.stateChangeEmitters.set(id, subscription);

    if (this.stateChangeEmitters.size === 1) {
      this.initializeBroadcastChannel();
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
  private async verifyEmailOtp(params: VerifyEmailOtpParams) {
    const { type } = params;

    if (type === 'email') {
      const result = await this.betterAuth.signIn.emailOtp({
        email: params.email,
        otp: params.token,
      });
      if (result.error) {
        return {
          data: { user: null, session: null },
          error: normalizeBetterAuthError(result.error),
        };
      }
      const sessionResult = await this.getSession({ forceFetch: true });
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

      return {
        data: {
          user: sessionResult.data.session.user,
          session: sessionResult.data.session,
        },
        error: null,
      };
    }

    if (type === 'magiclink') {
      const result = await this.betterAuth.magicLink.verify({
        query: {
          token: params.token,
          callbackURL:
            params.options?.redirectTo ||
            (globalThis.window === undefined ? '' : globalThis.location.origin),
        },
      });
      if (result?.error) {
        return {
          data: { user: null, session: null },
          error: normalizeBetterAuthError(result.error),
        };
      }

      // Get session after magic link verification
      const sessionResult = await this.getSession({ forceFetch: true });
      if (!sessionResult.data?.session) {
        return {
          data: { user: null, session: null },
          error: new AuthError(
            'Failed to retrieve session after magic link verification',
            500,
            'unexpected_failure'
          ),
        };
      }

      return {
        data: {
          user: sessionResult.data.session?.user || null,
          session: sessionResult.data.session,
        },
        error: null,
      };
    }

    if (type === 'signup' || type === 'invite') {
      const result = await this.betterAuth.emailOtp.verifyEmail({
        email: params.email,
        otp: params.token,
      });

      if (result?.error) {
        return {
          data: { user: null, session: null },
          error: normalizeBetterAuthError(result.error),
        };
      }

      const sessionResult = await this.getSession({ forceFetch: true });

      return {
        data: {
          user: sessionResult.data.session?.user ?? null,
          session: sessionResult.data.session,
        },
        error: null,
      };
    }

    if (type === 'recovery') {
      // First, check if OTP is valid
      const checkResult = await this.betterAuth.emailOtp.checkVerificationOtp({
        email: params.email,
        otp: params.token,
        type: 'forget-password',
      });

      if (checkResult.error || !checkResult.data?.success) {
        return {
          data: { user: null, session: null },
          error: normalizeBetterAuthError(checkResult.error),
        };
      }
      // For recovery, user needs to call resetPassword separately
      // Return success but no session yet
      return {
        data: { user: null, session: null },
        error: null,
      };
    }

    if (type === 'email_change') {
      const result = await this.betterAuth.verifyEmail({
        query: {
          token: params.token,
          callbackURL: params.options?.redirectTo,
        },
      });

      if (result?.error) {
        return {
          data: { user: null, session: null },
          error: normalizeBetterAuthError(result.error),
        };
      }

      // Get current session
      const sessionResult = await this.getSession({ forceFetch: true });
      if (sessionResult.error || !sessionResult.data) {
        return {
          data: { user: null, session: null },
          error:
            sessionResult.error ||
            new AuthError('Failed to get session', 500, 'internal_error'),
        };
      }

      if (sessionResult.data.session) {
        await this.notifyAllSubscribers(
          'USER_UPDATED',
          sessionResult.data.session
        );
        this.lastSessionState = sessionResult.data.session;
      }

      return {
        data: {
          user: sessionResult.data?.session?.user || null,
          session: sessionResult.data?.session || null,
        },
        error: null,
      };
    }

    if (type === 'invite') {
      const result = await this.betterAuth.organization.acceptInvitation({
        invitationId: params.token, // The token is the invitation ID
      });

      if (result.error) {
        return {
          data: { user: null, session: null },
          error: normalizeBetterAuthError(result.error),
        };
      }

      // Get current session
      const sessionResult = await this.getSession({ forceFetch: true });
      if (sessionResult.error || !sessionResult.data) {
        return {
          data: { user: null, session: null },
          error:
            sessionResult.error ||
            new AuthError('Failed to get session', 500, 'internal_error'),
        };
      }

      return {
        data: {
          user: sessionResult.data?.session?.user || null,
          session: sessionResult.data?.session,
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

  private async verifyPhoneOtp(params: VerifyMobileOtpParams) {
    // SMS OTP (phone verification)
    if (params.type === 'sms') {
      // Verify phone number with OTP
      // This creates a session by default
      const result = await this.betterAuth.phoneNumber.verify({
        phoneNumber: params.phone,
        code: params.token,
        disableSession: false, // Create session after verification
        updatePhoneNumber: false, // This is a new verification, not an update
      });

      if (result.error) {
        return {
          data: { user: null, session: null },
          error: normalizeBetterAuthError(result.error),
        };
      }

      // Get current session
      const sessionResult = await this.getSession({ forceFetch: true });
      if (sessionResult.error || !sessionResult.data) {
        return {
          data: { user: null, session: null },
          error:
            sessionResult.error ||
            new AuthError('Failed to get session', 500, 'internal_error'),
        };
      }

      return {
        data: {
          user: sessionResult.data?.session?.user || null,
          session: sessionResult.data?.session || null,
        },
        error: null,
      };
    }

    if (params.type === 'phone_change') {
      // Check if user is authenticated
      const currentSession = await this.betterAuth.getSession();
      if (currentSession.error || !currentSession.data?.session) {
        return {
          data: { user: null, session: null },
          error: new AuthError(
            'You must be signed in to change your phone number',
            401,
            'session_not_found'
          ),
        };
      }

      // Verify phone number and update it
      const result = await this.betterAuth.phoneNumber.verify({
        phoneNumber: params.phone,
        code: params.token,
        disableSession: false,
        updatePhoneNumber: true, // This updates the user's phone number
      });

      if (result.error) {
        return {
          data: { user: null, session: null },
          error: normalizeBetterAuthError(result.error),
        };
      }

      // Get updated session with new phone number
      const sessionResult = await this.getSession({ forceFetch: true });

      if (sessionResult.error || !sessionResult.data) {
        return {
          data: { user: null, session: null },
          error:
            sessionResult.error ||
            new AuthError(
              'Failed to get updated session',
              500,
              'internal_error'
            ),
        };
      }

      return {
        data: {
          user: sessionResult.data.session?.user || null,
          session: sessionResult.data.session,
        },
        error: null,
      };
    }

    return {
      data: { user: null, session: null },
      error: new AuthError(
        `Unsupported phone OTP type: ${params.type}`,
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

  //#endregion
}
