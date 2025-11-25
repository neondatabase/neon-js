import { type NeonAuthClientInterface, isAuthError } from '../../auth-interface';
import { APIError } from 'better-auth/api';
import {
  type Session,
  type AuthChangeEvent,
  type Subscription,
  type JwtHeader,
  type JwtPayload,
  type Provider,
  type VerifyMobileOtpParams,
  type VerifyEmailOtpParams,
} from '@supabase/auth-js';
import {
  createAuthClient,
  type AuthClient as BetterAuthClient,
  getGlobalBroadcastChannel,
  type BetterAuthClientOptions,
} from 'better-auth/client';
import type { NeonBetterAuthOptions } from './better-auth-types';
import {
  normalizeBetterAuthError,
  mapBetterAuthSession,
  mapBetterAuthIdentity,
} from './better-auth-helpers';
import { AuthErrorCode, createAuthError } from './errors/definitions';
import {
  jwtClient,
  adminClient,
  organizationClient,
  emailOTPClient,
  magicLinkClient,
  phoneNumberClient,
} from 'better-auth/client/plugins';
import { base64url, decodeJwt, decodeProtectedHeader } from 'jose';
import {
  BETTER_AUTH_METHODS_HOOKS,
  BETTER_AUTH_METHODS_IN_FLIGHT_REQUESTS,
  BETTER_AUTH_METHODS_CACHE,
  deriveBetterAuthMethodFromUrl,
} from './better-auth-methods';
/**
 * Better Auth adapter implementing the NeonAuthClient interface.
 * See CLAUDE.md for architecture details and API mappings.
 */
const defaultBetterAuthClientOptions = {
  plugins: [
    jwtClient(),
    adminClient(),
    organizationClient(),
    emailOTPClient(),

    // TODO: add these in
    phoneNumberClient(),
    magicLinkClient(),
  ],
} satisfies BetterAuthClientOptions;

export class BetterAuthAdapter implements NeonAuthClientInterface {
  admin: NeonAuthClientInterface['admin'] = undefined as never;
  mfa: NeonAuthClientInterface['mfa'] = undefined as never;
  oauth: NeonAuthClientInterface['oauth'] = undefined as never;
  private _betterAuth: BetterAuthClient<typeof defaultBetterAuthClientOptions>;
  private _stateChangeEmitters = new Map<string, Subscription>();

  //#region Constructor
  constructor(betterAuthClientOptions: NeonBetterAuthOptions) {
    // Preserve user's onSuccess callback if they provided one
    const userOnSuccess = betterAuthClientOptions.fetchOptions?.onSuccess;
    const userOnRequest = betterAuthClientOptions.fetchOptions?.onRequest;

    this._betterAuth = createAuthClient({
      ...betterAuthClientOptions,
      ...defaultBetterAuthClientOptions,
      fetchOptions: {
        ...betterAuthClientOptions.fetchOptions,
        onRequest: (request) => {
          const url = request.url;
          const method = deriveBetterAuthMethodFromUrl(url.toString());
          if (method) {
            BETTER_AUTH_METHODS_HOOKS[method].onRequest();
          }

          userOnRequest?.(request);
        },
        customFetchImpl: async (url, init) => {
          // Skip deduplication if X-Force-Fetch header is present
          if (init?.headers && 'X-Force-Fetch' in init.headers) {
            const headers = { ...init.headers };
            delete headers['X-Force-Fetch'];
            console.log('[customFetch] Force-fetch bypass:', url);
            return fetch(url, { ...init, headers });
          }

          // Create body-aware deduplication key
          const method = init?.method || 'GET';
          const body = init?.body || '';
          const key = `${method}:${url}:${body}`;

          const response =
            await BETTER_AUTH_METHODS_IN_FLIGHT_REQUESTS.deduplicate(key, () =>
              fetch(url, init)
            );

          // Clone the response so each caller gets a fresh body stream
          // (Response bodies can only be read once, but deduplication shares the same Response)
          return response.clone();
        },
        onSuccess: async (ctx) => {
          // Capture JWT from any request that includes it
          const jwt = ctx.response.headers.get('set-auth-jwt');
          if (jwt) {
            // Inject JWT into response data BEFORE Better Auth processes it.
            // Better Auth will then update its internal state, triggering useSession.subscribe()
            // which will cache the session with JWT included (single cache-setting point).
            if (ctx.data?.session) {
              console.log('[onSuccess] Injecting JWT into session.token');
              ctx.data.session.token = jwt;
            } else {
              console.warn(
                '[onSuccess] JWT found but no session data to inject into!'
              );
            }
          }

          const url = ctx.request.url.toString();
          const responseData = ctx.data;

          // Detect sign-in/sign-up
          const method = deriveBetterAuthMethodFromUrl(url);
          if (method) {
            BETTER_AUTH_METHODS_HOOKS[method].onSuccess(responseData);
          }

          // Call user's onSuccess callback if they provided one
          await userOnSuccess?.(ctx);
        },
      },
    });

    /**
     * useSession() - Automatic Session Management
     *
     * Enabled by Default:
     * - ✅ Refetch on Window Focus: Automatically refetches session when user returns to the tab
     * - ✅ Cross-Tab Sync: Syncs session state across all browser tabs (sign out in one = sign out in all)
     * - ✅ Online/Offline Detection: Refetches session when network connection is restored
     * - ❌ Interval Polling: Disabled (refetchInterval: 0)
     *
     * Returns:
     * - data: Session object (user + session)
     * - isPending: Loading state
     * - isRefetching: Refetch in progress
     * - error: Error object if any
     * - refetch(): Manual refetch function
     *
     * Customize with:
     * createAuthClient({
     *   sessionOptions: {
     *     refetchOnWindowFocus: true,  // default
     *     refetchInterval: 0,           // default (seconds, 0 = off)
     *     refetchWhenOffline: false     // default
     *   }
     * })
     */
    this._betterAuth.useSession.subscribe((value) => {
      // If session is null/undefined, clear cache (sign-out detected from any tab)
      if (!value.data?.session || !value.data?.user) {
        console.log('[useSession.subscribe] Session is null, clearing cache');
        BETTER_AUTH_METHODS_CACHE.clearSessionCache();
        return;
      }

      // If session exists, don't cache it here - it has opaque token
      // JWT-injected sessions are cached by getSession() immediately after fetch
      console.log(
        '[useSession.subscribe] Session exists but not caching (opaque token, JWT cached by getSession)'
      );

      if (value.error) {
        console.error('[useSession.subscribe] Error:', value.error);
      }
    });

    // Set up cross-tab event listener for Better Auth broadcasts
    // This listens to events from other tabs and notifies local subscribers
    getGlobalBroadcastChannel().subscribe((message) => {
      console.log('[cross-tab event] Received message, before if:', message);

      if (message.data && 'session' in message.data) {
        const session = message.data?.session as Session | null;
        const trigger = message.data?.trigger;

        // Update cache with session from cross-tab event
        if (session) {
          BETTER_AUTH_METHODS_CACHE.setCachedSession(session);
        } else {
          BETTER_AUTH_METHODS_CACHE.clearSessionCache();
        }

        // 2. Notify all subscribers
        const promises = [...this._stateChangeEmitters.values()].map(
          (subscription) => {
            try {
              return Promise.resolve(
                subscription.callback(trigger as AuthChangeEvent, session)
              );
            } catch {
              return Promise.resolve();
            }
          }
        );

        Promise.allSettled(promises);
      }
    });
  }
  //#endregion

  //#region PUBLIC API - Initialization
  getBetterAuthInstance(): ReturnType<typeof createAuthClient> {
    return this._betterAuth;
  }

  initialize: NeonAuthClientInterface['initialize'] = async () => {
    try {
      const session = await this.getSession();

      if (session.error) {
        throw session.error;
      }

      return {
        data: session.data,
        error: null,
      };
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { session: null }, error };
      }
      if (error instanceof APIError) {
        return { data: { session: null }, error: normalizeBetterAuthError(error) };
      }
      throw error;
    }
  };
  //#endregion

  //#region PUBLIC API - Session Management
  async getSession(options?: {
    forceFetch?: boolean;
  }): ReturnType<NeonAuthClientInterface['getSession']> {
    try {
      console.log('[getSession] Called with options:', options);

      // Skip cache if forceFetch is true
      if (!options?.forceFetch) {
        const cachedSession = BETTER_AUTH_METHODS_CACHE.getCachedSession();
        if (cachedSession) {
          console.log('[getSession] Cache hit, returning cached session');
          // Re-check cache to prevent stale data from concurrent signOut()
          if (!BETTER_AUTH_METHODS_CACHE.getCachedSession()) {
            console.log('[getSession] Cache was cleared during retrieval');
            return { data: { session: null }, error: null };
          }

          return { data: { session: cachedSession }, error: null };
        }
        console.log('[getSession] Cache miss, fetching from Better Auth');
      }

      // Fetch-level deduplication handles concurrent requests automatically
      console.log('[getSession] Calling betterAuth.getSession()');
      const currentSession = await this._betterAuth.getSession();
      console.log('[getSession] Better Auth response:', {
        hasData: !!currentSession.data,
        hasSession: !!currentSession.data?.session,
        hasUser: !!currentSession.data?.user,
        hasError: !!currentSession.error,
        sessionToken: currentSession.data?.session?.token
          ? `${currentSession.data.session.token.slice(0, 20)}...`
          : 'null',
      });

      if (!currentSession.data?.session) {
        console.log(
          '[getSession] No session in Better Auth response, returning null'
        );
        return { data: { session: null }, error: null };
      }

      const session = mapBetterAuthSession(
        currentSession.data.session,
        currentSession.data.user
      );
      console.log('[getSession] Mapped session:', {
        hasAccessToken: !!session?.access_token,
        accessToken: session?.access_token
          ? `${session.access_token.slice(0, 20)}...`
          : 'null',
        accessTokenLength: session?.access_token?.length,
        accessTokenFull: session?.access_token, // Log FULL JWT to check for corruption
        accessTokenType: typeof session?.access_token,
      });

      // Cache immediately if we have a JWT (before useSession.subscribe can overwrite)
      if (session?.access_token?.startsWith('eyJ')) {
        console.log('[getSession] Caching JWT-injected session');
        BETTER_AUTH_METHODS_CACHE.setCachedSession(session);
      }

      return {
        data: {
          session: session as Session,
        },
        error: null,
      };
    } catch (error) {
      console.error('[getSession] Error:', error);
      if (isAuthError(error)) {
        return { data: { session: null }, error };
      }
      if (error instanceof APIError) {
        return { data: { session: null }, error: normalizeBetterAuthError(error) };
      }
      throw error;
    }
  }

  refreshSession: NeonAuthClientInterface['refreshSession'] = async () => {
    try {
      const sessionResult = await this.getSession();

      if (sessionResult.error) {
        throw sessionResult.error;
      }

      return {
        data: {
          user: sessionResult.data.session?.user ?? null,
          session: sessionResult.data.session,
        },
        error: null,
      };
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { user: null, session: null }, error };
      }
      if (error instanceof APIError) {
        return { data: { user: null, session: null }, error: normalizeBetterAuthError(error) };
      }
      throw error;
    }
  };

  // TODO: we need to implement a custom plugin to allow setting external sessions
  setSession: NeonAuthClientInterface['setSession'] = async () => {
    return {
      data: { user: null, session: null },
      error: createAuthError(
        AuthErrorCode.NotImplemented,
        'setSession() is not supported by Better Auth. Use signInWithPassword() instead.'
      ),
    };
  };

  //#region PUBLIC API - Authentication
  signUp: NeonAuthClientInterface['signUp'] = async (credentials) => {
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
        const result = await this._betterAuth.signUp.email({
          email: credentials.email,
          password: credentials.password,
          name: displayName,
          callbackURL: credentials.options?.emailRedirectTo,
          // TODO: user's metadata, we need to define them at the server adapter, else this won't be stored I think
          ...credentials.options?.data,
        });

        if (result.error) {
          throw normalizeBetterAuthError(result.error);
        }

        const sessionResult = await this.getSession();

        if (!sessionResult.data.session?.user) {
          throw createAuthError(
            AuthErrorCode.SessionNotFound,
            'Failed to retrieve user session'
          );
        }

        const data = {
          user: sessionResult.data.session.user,
          session: sessionResult.data.session,
        };

        return { data, error: null };
      } else if ('phone' in credentials && credentials.phone) {
        // TODO: we would need to add the phone-number plugin
        throw createAuthError(
          AuthErrorCode.PhoneProviderDisabled,
          'Phone sign-up not supported'
        );
      } else {
        throw createAuthError(
          AuthErrorCode.ValidationFailed,
          'Invalid credentials format'
        );
      }
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { user: null, session: null }, error };
      }
      if (error instanceof APIError) {
        return { data: { user: null, session: null }, error: normalizeBetterAuthError(error) };
      }
      throw error;
    }
  };

  // TODO: we need to add the anonymous() plugin to the server adapter
  signInAnonymously: NeonAuthClientInterface['signInAnonymously'] = async () => {
    return {
      data: { user: null, session: null },
      error: createAuthError(
        AuthErrorCode.AnonymousProviderDisabled,
        'Anonymous sign-in is not supported by Better Auth'
      ),
    };
  };

  signInWithPassword: NeonAuthClientInterface['signInWithPassword'] = async (
    credentials
  ) => {
    try {
      if ('email' in credentials && credentials.email) {
        // TODO: for captcha, we would need to add the captcha plugin
        const result = await this._betterAuth.signIn.email({
          email: credentials.email,
          password: credentials.password,
        });

        if (result.error) {
          throw normalizeBetterAuthError(result.error);
        }

        const sessionResult = await this.getSession();
        if (!sessionResult.data.session?.user) {
          throw createAuthError(
            AuthErrorCode.SessionNotFound,
            'Failed to retrieve user session'
          );
        }

        const data = {
          user: sessionResult.data.session.user,
          session: sessionResult.data.session,
        };

        return { data, error: null };
      } else if ('phone' in credentials && credentials.phone) {
        // TODO: we would need to add the phone-number plugin
        throw createAuthError(
          AuthErrorCode.PhoneProviderDisabled,
          'Phone sign-in not supported'
        );
      } else {
        throw createAuthError(
          AuthErrorCode.ValidationFailed,
          'Invalid credentials format'
        );
      }
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { user: null, session: null }, error };
      }
      if (error instanceof APIError) {
        return { data: { user: null, session: null }, error: normalizeBetterAuthError(error) };
      }
      throw error;
    }
  };

  // TODO: we should omit queryParams from the credentials
  signInWithOAuth: NeonAuthClientInterface['signInWithOAuth'] = async (credentials) => {
    try {
      const { provider, options } = credentials;

      await this._betterAuth.signIn.social({
        provider,
        // Convert scopes from space-separated string to Better Auth format (array)
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
      if (isAuthError(error)) {
        return { data: { provider: credentials.provider, url: null }, error };
      }
      if (error instanceof APIError) {
        return { data: { provider: credentials.provider, url: null }, error: normalizeBetterAuthError(error) };
      }
      throw error;
    }
  };

  // TODO: we need to setup this up with `phone` type
  signInWithOtp: NeonAuthClientInterface['signInWithOtp'] = async (credentials) => {
    try {
      if ('email' in credentials) {
        await this._betterAuth.emailOtp.sendVerificationOtp({
          email: credentials.email,
          type: 'sign-in',
        });

        return {
          data: { user: null, session: null, messageId: undefined },
          error: null,
        };
      }

      throw createAuthError(
        AuthErrorCode.NotImplemented,
        `We haven't implemented this type of otp authentication.`
      );
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { user: null, session: null, messageId: undefined }, error };
      }
      if (error instanceof APIError) {
        return { data: { user: null, session: null, messageId: undefined }, error: normalizeBetterAuthError(error) };
      }
      throw error;
    }
  };

  signInWithIdToken: NeonAuthClientInterface['signInWithIdToken'] = async (credentials) => {
    try {
      const result = await this._betterAuth.signIn.social({
        provider: credentials.provider,
        idToken: {
          token: credentials.token,
          accessToken: credentials.access_token,
          nonce: credentials.nonce,
        },
      });

      if (result.error) {
        throw normalizeBetterAuthError(result.error);
      }

      if (!('user' in result.data) || !result.data.user) {
        throw createAuthError(
          AuthErrorCode.OAuthCallbackFailed,
          'Failed to sign in with ID token'
        );
      }

      const session = await this.getSession();
      if (session.error || !session.data.session) {
        throw session.error ||
          createAuthError(
            AuthErrorCode.SessionNotFound,
            'Failed to get session'
          );
      }

      return {
        data: {
          user: session.data.session.user,
          session: session.data.session,
        },
        error: null,
      };
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { user: null, session: null }, error };
      }
      if (error instanceof APIError) {
        return { data: { user: null, session: null }, error: normalizeBetterAuthError(error) };
      }
      throw error;
    }
  };

  // TODO: we need to add the sso plugin to the server adapter
  signInWithSSO: NeonAuthClientInterface['signInWithSSO'] = async (params) => {
    const attemptedWith =
      'providerId' in params
        ? `provider ID: ${params.providerId}`
        : `domain: ${'domain' in params ? params.domain : 'unknown'}`;

    return {
      data: null,
      error: createAuthError(
        AuthErrorCode.SsoProviderDisabled,
        `Better Auth does not support enterprise SAML SSO. Attempted with ${attemptedWith}. Use signInWithOAuth() for OAuth providers instead.`
      ),
    };
  };

  // TODO: we need to add the SIWE plugin to the server adapter
  signInWithWeb3: NeonAuthClientInterface['signInWithWeb3'] = async (credentials) => {
    const attemptedChain = credentials.chain;

    return {
      data: {
        user: null,
        session: null,
      },
      error: createAuthError(
        AuthErrorCode.Web3ProviderDisabled,
        `Better Auth does not support Web3 authentication. Attempted with chain: ${attemptedChain}. Supported: OAuth, email/password, magic link.`
      ),
    };
  };

  signOut: NeonAuthClientInterface['signOut'] = async () => {
    try {
      const result = await this._betterAuth.signOut();

      if (result.error) {
        throw normalizeBetterAuthError(result.error);
      }

      return { error: null };
    } catch (error) {
      if (isAuthError(error)) {
        return { error };
      }
      if (error instanceof APIError) {
        return { error: normalizeBetterAuthError(error) };
      }
      throw error;
    }
  };
  //#endregion

  //#region PUBLIC API - User Management
  getUser: NeonAuthClientInterface['getUser'] = async () => {
    try {
      const sessionResult = await this.getSession();

      if (sessionResult.error || !sessionResult.data.session) {
        throw sessionResult.error ||
          createAuthError(
            AuthErrorCode.SessionNotFound,
            'No user session found'
          );
      }

      return {
        data: {
          user: sessionResult.data.session.user,
        },
        error: null,
      };
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { user: null }, error };
      }
      if (error instanceof APIError) {
        return { data: { user: null }, error: normalizeBetterAuthError(error) };
      }
      throw error;
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
          throw sessionResult.error ||
            createAuthError(
              AuthErrorCode.SessionNotFound,
              'No user session found'
            );
        }

        jwt = sessionResult.data.session.access_token;
      }

      if (!jwt) {
        throw createAuthError(
          AuthErrorCode.SessionNotFound,
          'No access token found'
        );
      }

      // Split JWT into parts
      const tokenParts = jwt.split('.');
      if (tokenParts.length !== 3) {
        throw createAuthError(AuthErrorCode.BadJwt, 'Invalid token format');
      }

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
      if (isAuthError(error)) {
        return { data: null, error };
      }
      if (error instanceof APIError) {
        return { data: null, error: normalizeBetterAuthError(error) };
      }
      throw error;
    }
  };

  updateUser: NeonAuthClientInterface['updateUser'] = async (attributes) => {
    try {
      if (attributes.password) {
        throw createAuthError(
          AuthErrorCode.FeatureNotSupported,
          'The password cannot be updated through the updateUser method, use the changePassword method instead.'
        );
      }

      if (attributes.email) {
        throw createAuthError(
          AuthErrorCode.FeatureNotSupported,
          'The email cannot be updated through the updateUser method, use the changeEmail method instead.'
        );
      }

      const result = await this._betterAuth.updateUser({
        ...attributes.data,
      });

      if (result.data?.status) {
        throw createAuthError(
          AuthErrorCode.InternalError,
          'Failed to update user'
        );
      }

      if (result?.error) {
        throw normalizeBetterAuthError(result.error);
      }

      const updatedSessionResult = await this.getSession({ forceFetch: true });
      if (!updatedSessionResult.data.session) {
        throw createAuthError(
          AuthErrorCode.SessionNotFound,
          'Failed to retrieve updated user'
        );
      }

      return {
        data: { user: updatedSessionResult.data.session.user },
        error: null,
      };
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { user: null }, error };
      }
      if (error instanceof APIError) {
        return { data: { user: null }, error: normalizeBetterAuthError(error) };
      }
      throw error;
    }
  };

  getUserIdentities: NeonAuthClientInterface['getUserIdentities'] = async () => {
    try {
      const sessionResult = await this.getSession();

      if (sessionResult.error || !sessionResult.data.session) {
        throw sessionResult.error ||
          createAuthError(
            AuthErrorCode.SessionNotFound,
            'No user session found'
          );
      }

      // Fetch-level deduplication handles concurrent requests automatically
      const result = await this._betterAuth.listAccounts();

      if (!result) {
        throw createAuthError(
          AuthErrorCode.InternalError,
          'Failed to list accounts'
        );
      }

      if (result.error) {
        throw normalizeBetterAuthError(result.error);
      }

      const identitiesPromises = result.data.map(async (account) => {
        let accountInfo = null;
        try {
          const infoResult = await this._betterAuth.accountInfo({
            query: { accountId: account.accountId },
          });
          accountInfo = infoResult.data;
        } catch (error) {
          // If getAccountInfo fails, continue with basic data
          console.warn(
            `Failed to get account info for ${account.providerId}:`,
            error
          );
        }

        return mapBetterAuthIdentity(
          account,
          accountInfo ?? null
        );
      });

      const identities = await Promise.all(identitiesPromises);

      return {
        data: { identities },
        error: null,
      };
    } catch (error) {
      if (isAuthError(error)) {
        return { data: null, error };
      }
      if (error instanceof APIError) {
        return { data: null, error: normalizeBetterAuthError(error) };
      }
      throw error;
    }
  };

  // TODO: we need to enable the account/accountLinking plugin to the server adapter
  linkIdentity: NeonAuthClientInterface['linkIdentity'] = async (credentials) => {
    const provider = credentials.provider as Provider;
    try {
      const sessionResult = await this.getSession();

      if (sessionResult.error || !sessionResult.data.session) {
        throw sessionResult.error ||
          createAuthError(
            AuthErrorCode.SessionNotFound,
            'No user session found'
          );
      }

      // Link with ID token (direct)
      if ('token' in credentials) {
        const result = await this._betterAuth.linkSocial({
          provider,
          idToken: {
            token: credentials.token,
            accessToken: credentials.access_token,
            nonce: credentials.nonce,
          },
        });

        if (result.error) {
          throw normalizeBetterAuthError(result.error);
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

      const result = await this._betterAuth.linkSocial({
        provider,
        callbackURL,
        errorCallbackURL: callbackURL
          ? `${callbackURL}?error=linking-failed`
          : undefined,
        scopes,
      });

      if (result.error) {
        throw normalizeBetterAuthError(result.error);
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
      if (isAuthError(error)) {
        return { data: { provider, url: null, user: null, session: null }, error };
      }
      if (error instanceof APIError) {
        return { data: { provider, url: null, user: null, session: null }, error: normalizeBetterAuthError(error) };
      }
      throw error;
    }
  };

  unlinkIdentity: NeonAuthClientInterface['unlinkIdentity'] = async (identity) => {
    try {
      const sessionResult = await this.getSession();
      if (sessionResult.error || !sessionResult.data.session) {
        throw sessionResult.error ||
          createAuthError(
            AuthErrorCode.SessionNotFound,
            'No user session found'
          );
      }

      const identities = await this.getUserIdentities();
      if (identities.error || !identities.data) {
        throw identities.error ||
          createAuthError(
            AuthErrorCode.InternalError,
            'Failed to fetch identities'
          );
      }

      // Find the identity by internal DB ID
      const targetIdentity = identities.data.identities.find(
        (i) => i.id === identity.identity_id
      );
      if (!targetIdentity) {
        throw createAuthError(
          AuthErrorCode.IdentityNotFound,
          'Identity not found'
        );
      }

      // Map to better-auth fields
      const providerId = targetIdentity.provider; // e.g., "google"
      const accountId = targetIdentity.identity_id; // e.g., "google-user-id-12345"

      // Call better-auth
      const result = await this._betterAuth.unlinkAccount({
        providerId,
        accountId,
      });

      if (result?.error) {
        throw normalizeBetterAuthError(result.error);
      }

      const updatedSession = await this.getSession({ forceFetch: true });
      if (updatedSession.data.session) {
        BETTER_AUTH_METHODS_HOOKS['updateUser'].onSuccess(
          updatedSession.data.session
        );
      }

      return {
        data: {},
        error: null,
      };
    } catch (error) {
      if (isAuthError(error)) {
        return { data: null, error };
      }
      if (error instanceof APIError) {
        return { data: null, error: normalizeBetterAuthError(error) };
      }
      throw error;
    }
  };
  //#endregion

  // TODO: add twoFactor plugin to the server adapter
  // TODO: add magiclink plugin to the server adapter
  //#region PUBLIC API - Verification & Password Reset
  verifyOtp: NeonAuthClientInterface['verifyOtp'] = async (params) => {
    try {
      if ('email' in params && params.email) {
        return await this.verifyEmailOtp(params);
      }
      if ('phone' in params && params.phone) {
        return await this.verifyPhoneOtp(params);
      }
      if ('token_hash' in params && params.token_hash) {
        // TODO: this will fail, we need handlers for this in this code
        throw createAuthError(
          AuthErrorCode.FeatureNotSupported,
          'Token hash verification not supported'
        );
      }
      throw createAuthError(
        AuthErrorCode.ValidationFailed,
        'Invalid OTP verification parameters'
      );
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { user: null, session: null }, error };
      }
      if (error instanceof APIError) {
        return { data: { user: null, session: null }, error: normalizeBetterAuthError(error) };
      }
      throw error;
    }
  };

  // TODO: this will only work with a magic link and not with the OTP token flow
  // we need to derive which flow is being used and handle it accordingly
  resetPasswordForEmail: NeonAuthClientInterface['resetPasswordForEmail'] = async (
    email,
    options
  ) => {
    try {
      // TODO: this will fail, we need to setup `sendResetPassword` in the server adapter
      const result = await this._betterAuth.requestPasswordReset({
        email,
        redirectTo:
          options?.redirectTo ||
          (globalThis.window === undefined ? '' : globalThis.location.origin),
      });

      if (result?.error) {
        throw normalizeBetterAuthError(result.error);
      }

      return {
        data: {},
        error: null,
      };
    } catch (error) {
      if (isAuthError(error)) {
        return { data: null, error };
      }
      if (error instanceof APIError) {
        return { data: null, error: normalizeBetterAuthError(error) };
      }
      throw error;
    }
  };

  // TODO: we would need a custom plugin to be able to actually recreate the session
  reauthenticate: NeonAuthClientInterface['reauthenticate'] = async () => {
    try {
      const newSession = await this.getSession();

      if (newSession.error || !newSession.data.session) {
        throw newSession.error ||
          createAuthError(
            AuthErrorCode.SessionNotFound,
            'No session found'
          );
      }

      return {
        data: {
          user: newSession.data.session?.user || null,
          session: newSession.data.session,
        },
        error: null,
      };
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { user: null, session: null }, error };
      }
      if (error instanceof APIError) {
        return { data: { user: null, session: null }, error: normalizeBetterAuthError(error) };
      }
      throw error;
    }
  };

  resend: NeonAuthClientInterface['resend'] = async (credentials) => {
    try {
      if ('email' in credentials) {
        const { email, type, options } = credentials;

        if (type === 'signup' || type === 'email_change') {
          const result = await this._betterAuth.sendVerificationEmail({
            email,
            callbackURL:
              options?.emailRedirectTo ||
              (globalThis.window === undefined
                ? ''
                : globalThis.location.origin),
          });

          if (result?.error) {
            throw normalizeBetterAuthError(result.error);
          }

          return {
            data: { user: null, session: null },
            error: null,
          };
        }

        throw createAuthError(
          AuthErrorCode.ValidationFailed,
          `Unsupported resend type: ${type}`
        );
      }

      if ('phone' in credentials) {
        const { phone, type } = credentials;

        if (type === 'sms' || type === 'phone_change') {
          const result = await this._betterAuth.phoneNumber.sendOtp({
            phoneNumber: phone,
          });

          if (result?.error) {
            throw normalizeBetterAuthError(result.error);
          }

          const messageId =
            type === 'sms' ? 'sms-otp-sent' : 'phone-change-otp-sent';

          return {
            data: { messageId: messageId, user: null, session: null },
            error: null,
          };
        }
      }

      throw createAuthError(
        AuthErrorCode.ValidationFailed,
        'Invalid credentials format'
      );
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { user: null, session: null }, error };
      }
      if (error instanceof APIError) {
        return {
          data: { user: null, session: null },
          error: normalizeBetterAuthError(error),
        };
      }
      throw error;
    }
  };

  exchangeCodeForSession: NeonAuthClientInterface['exchangeCodeForSession'] = async (
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

      throw createAuthError(
        AuthErrorCode.OAuthCallbackFailed,
        'OAuth callback completed but no session was created. Make sure the OAuth callback has been processed.'
      );
    } catch (error) {
      if (isAuthError(error)) {
        return { data: { session: null, user: null }, error };
      }
      if (error instanceof APIError) {
        return {
          data: { session: null, user: null },
          error: normalizeBetterAuthError(error),
        };
      }
      throw error;
    }
  };
  //#endregion

  //#region PUBLIC API - Event System
  onAuthStateChange: NeonAuthClientInterface['onAuthStateChange'] = (callback) => {
    const id = crypto.randomUUID();

    const subscription: Subscription = {
      id,
      callback,
      unsubscribe: () => {
        this._stateChangeEmitters.delete(id);
      },
    };

    this._stateChangeEmitters.set(id, subscription);

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
  isThrowOnErrorEnabled: NeonAuthClientInterface['isThrowOnErrorEnabled'] = () => false;

  startAutoRefresh: NeonAuthClientInterface['startAutoRefresh'] = async () => {
    return;
  };

  stopAutoRefresh: NeonAuthClientInterface['stopAutoRefresh'] = async () => {
    return;
  };
  //#endregion

  //#region PRIVATE HELPERS - Verification
  private async verifyEmailOtp(params: VerifyEmailOtpParams) {
    const { type } = params;

    if (type === 'email') {
      const result = await this._betterAuth.signIn.emailOtp({
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
          error: createAuthError(
            AuthErrorCode.SessionNotFound,
            'Failed to retrieve session after OTP verification. Make sure the magic link callback has been processed.'
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
      const result = await this._betterAuth.magicLink.verify({
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
          error: createAuthError(
            AuthErrorCode.SessionNotFound,
            'Failed to retrieve session after magic link verification'
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
      const result = await this._betterAuth.emailOtp.verifyEmail({
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
      const checkResult = await this._betterAuth.emailOtp.checkVerificationOtp({
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
      const result = await this._betterAuth.verifyEmail({
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
            createAuthError(
              AuthErrorCode.InternalError,
              'Failed to get session'
            ),
        };
      }

      if (sessionResult.data.session) {
        BETTER_AUTH_METHODS_HOOKS['updateUser'].onSuccess(
          sessionResult.data.session
        );
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
      const result = await this._betterAuth.organization.acceptInvitation({
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
            createAuthError(
              AuthErrorCode.InternalError,
              'Failed to get session'
            ),
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
      error: createAuthError(
        AuthErrorCode.ValidationFailed,
        `Unsupported email OTP type: ${type}`
      ),
    };
  }

  private async verifyPhoneOtp(params: VerifyMobileOtpParams) {
    // SMS OTP (phone verification)
    if (params.type === 'sms') {
      // Verify phone number with OTP
      // This creates a session by default
      const result = await this._betterAuth.phoneNumber.verify({
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
            createAuthError(
              AuthErrorCode.InternalError,
              'Failed to get session'
            ),
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
      const currentSession = await this._betterAuth.getSession();
      if (currentSession.error || !currentSession.data?.session) {
        return {
          data: { user: null, session: null },
          error: createAuthError(
            AuthErrorCode.SessionNotFound,
            'You must be signed in to change your phone number'
          ),
        };
      }

      // Verify phone number and update it
      const result = await this._betterAuth.phoneNumber.verify({
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
            createAuthError(
              AuthErrorCode.InternalError,
              'Failed to get updated session'
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
      error: createAuthError(
        AuthErrorCode.ValidationFailed,
        `Unsupported phone OTP type: ${params.type}`
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
    } catch {
      await callback('INITIAL_SESSION', null);
    }
  }

  //#endregion
}
