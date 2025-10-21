import { describe, it, expect, beforeEach, vi } from 'vitest';

// Create mock functions - must be declared before vi.mock
const mockGetUser = vi.fn();
const mockSignUpWithCredential = vi.fn();
const mockSignInWithCredential = vi.fn();
const mockSignInWithOAuth = vi.fn();
const mockSendMagicLinkEmail = vi.fn();
const mockSendForgotPasswordEmail = vi.fn();
const mockSignInWithMagicLink = vi.fn();
const mockVerifyEmail = vi.fn();
const mockResetPassword = vi.fn();
const mockCreateSession = vi.fn();
const mockGetOrCreateTokenStore = vi.fn();
const mockCreateCookieHelper = vi.fn();
const mockGetSessionFromTokenStore = vi.fn();

// Mock the Stack Auth module - hoisted by vitest
vi.mock('@stackframe/js', () => {
  return {
    StackServerApp: class {
      getUser = mockGetUser;
      signUpWithCredential = mockSignUpWithCredential;
      signInWithCredential = mockSignInWithCredential;
      signInWithOAuth = mockSignInWithOAuth;
      sendMagicLinkEmail = mockSendMagicLinkEmail;
      sendForgotPasswordEmail = mockSendForgotPasswordEmail;
      _interface = {
        signInWithMagicLink: mockSignInWithMagicLink,
        verifyEmail: mockVerifyEmail,
        resetPassword: mockResetPassword,
        createSession: mockCreateSession,
      };
      _getOrCreateTokenStore = mockGetOrCreateTokenStore;
      _createCookieHelper = mockCreateCookieHelper;
      _getSessionFromTokenStore = mockGetSessionFromTokenStore;
    },
    StackClientApp: class {
      getUser = mockGetUser;
      signUpWithCredential = mockSignUpWithCredential;
      signInWithCredential = mockSignInWithCredential;
      signInWithOAuth = mockSignInWithOAuth;
      sendMagicLinkEmail = mockSendMagicLinkEmail;
      sendForgotPasswordEmail = mockSendForgotPasswordEmail;
      _interface = {
        signInWithMagicLink: mockSignInWithMagicLink,
        verifyEmail: mockVerifyEmail,
        resetPassword: mockResetPassword,
        createSession: mockCreateSession,
      };
      _getOrCreateTokenStore = mockGetOrCreateTokenStore;
      _createCookieHelper = mockCreateCookieHelper;
      _getSessionFromTokenStore = mockGetSessionFromTokenStore;
    },
  };
});

// Import after mocking
import { StackAuthAdapter } from './stack-auth-adapter';

describe('StackAuthAdapter', () => {
  let adapter: StackAuthAdapter;

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();

    adapter = new StackAuthAdapter({
      projectId: 'test-project',
      publishableClientKey: 'test-key',
      tokenStore: 'cookie',
    });
  });

  describe('signUp', () => {
    it('should create a new user with email and password', async () => {
      // Mock successful sign-up
      const mockSignedUpAt = new Date();
      const mockGetTokens = vi.fn().mockResolvedValue({
        accessToken: { token: 'access-token' },
        refreshToken: { token: 'refresh-token' },
      });

      mockSignUpWithCredential.mockResolvedValue({ status: 'success' });
      mockSignInWithCredential.mockResolvedValue({ status: 'success' });
      mockGetUser.mockResolvedValue({
        id: 'user-123',
        primaryEmail: 'test@example.com',
        signedUpAt: mockSignedUpAt,
        currentSession: {
          getTokens: mockGetTokens,
        },
      });

      const result = await adapter.signUp({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.error).toBeNull();
      expect(result.data.user).toBeDefined();
      expect(result.data.user?.email).toBe('test@example.com');
      expect(result.data.session).toBeDefined();
    });

    it('should return error for existing email', async () => {
      mockSignUpWithCredential.mockResolvedValue({
        status: 'error',
        error: { message: 'User already exists' },
      });

      const result = await adapter.signUp({
        email: 'existing@example.com',
        password: 'password123',
      });

      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('user_already_exists');
      expect(result.data.user).toBeNull();
    });
  });

  describe('signInWithPassword', () => {
    it('should sign in user with valid credentials', async () => {
      const mockSignedUpAt = new Date();
      const mockGetTokens = vi.fn().mockResolvedValue({
        accessToken: { token: 'access-token' },
        refreshToken: { token: 'refresh-token' },
      });

      mockSignInWithCredential.mockResolvedValue({ status: 'success' });
      mockGetUser.mockResolvedValue({
        id: 'user-123',
        primaryEmail: 'test@example.com',
        signedUpAt: mockSignedUpAt,
        currentSession: {
          getTokens: mockGetTokens,
        },
      });

      const result = await adapter.signInWithPassword({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.error).toBeNull();
      expect(result.data.user).toBeDefined();
      expect(result.data.session).toBeDefined();
    });

    it('should return error for invalid credentials', async () => {
      mockSignInWithCredential.mockResolvedValue({
        status: 'error',
        error: { message: 'Invalid login credentials' },
      });

      const result = await adapter.signInWithPassword({
        email: 'test@example.com',
        password: 'wrongpassword',
      });

      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('invalid_credentials');
    });
  });

  describe('signInWithIdToken', () => {
    it('should return error when attempting to sign in with Google ID token', async () => {
      const result = await adapter.signInWithIdToken({
        provider: 'google',
        token: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
      });

      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('id_token_provider_disabled');
      expect(result.error?.message).toContain(
        'Stack Auth does not support OIDC ID token authentication'
      );
      expect(result.error?.message).toContain('provider: google');
      expect(result.error?.message).toContain('signInWithOAuth');
      expect(result.data.user).toBeNull();
      expect(result.data.session).toBeNull();
    });

    it('should return error when attempting to sign in with Apple ID token', async () => {
      const result = await adapter.signInWithIdToken({
        provider: 'apple',
        token: 'eyJraWQiOiJXNldjT0tCIiwiYWxnIjoiUlMyNTYifQ...',
      });

      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('id_token_provider_disabled');
      expect(result.error?.message).toContain(
        'Stack Auth does not support OIDC ID token authentication'
      );
      expect(result.error?.message).toContain('provider: apple');
      expect(result.data.user).toBeNull();
      expect(result.data.session).toBeNull();
    });

    it('should return error with access_token indicator', async () => {
      const result = await adapter.signInWithIdToken({
        provider: 'azure',
        token: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
        access_token: 'ya29.a0AfH6SMBx...',
      });

      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('id_token_provider_disabled');
      expect(result.error?.message).toContain('provider: azure');
      expect(result.error?.message).toContain('(with access_token)');
      expect(result.error?.message).toContain('OAuth authorization code flow');
      expect(result.data.user).toBeNull();
      expect(result.data.session).toBeNull();
    });

    it('should return error with nonce indicator', async () => {
      const result = await adapter.signInWithIdToken({
        provider: 'facebook',
        token: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
        nonce: 'random-nonce-value',
      });

      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('id_token_provider_disabled');
      expect(result.error?.message).toContain('provider: facebook');
      expect(result.error?.message).toContain('(with nonce)');
      expect(result.data.user).toBeNull();
      expect(result.data.session).toBeNull();
    });

    it('should return error with both access_token and nonce indicators', async () => {
      const result = await adapter.signInWithIdToken({
        provider: 'kakao',
        token: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
        access_token: 'access-token-value',
        nonce: 'nonce-value',
      });

      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('id_token_provider_disabled');
      expect(result.error?.message).toContain('provider: kakao');
      expect(result.error?.message).toContain('(with access_token)');
      expect(result.error?.message).toContain('(with nonce)');
      expect(result.data.user).toBeNull();
      expect(result.data.session).toBeNull();
    });
  });

  describe('signInWithSSO', () => {
    it('should return error when attempting to sign in with provider ID', async () => {
      const result = await adapter.signInWithSSO({
        providerId: '21648a9d-8d5a-4555-a9d1-d6375dc14e92',
        options: {
          redirectTo: 'https://app.example.com/callback',
        },
      });

      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('sso_provider_disabled');
      expect(result.error?.message).toContain(
        'Stack Auth does not support enterprise SAML SSO'
      );
      expect(result.error?.message).toContain(
        'provider ID: 21648a9d-8d5a-4555-a9d1-d6375dc14e92'
      );
      expect(result.error?.message).toContain('signInWithOAuth');
      expect(result.data).toBeNull();
    });

    it('should return error when attempting to sign in with domain', async () => {
      const result = await adapter.signInWithSSO({
        domain: 'company.com',
        options: {
          redirectTo: 'https://app.example.com/callback',
        },
      });

      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('sso_provider_disabled');
      expect(result.error?.message).toContain(
        'Stack Auth does not support enterprise SAML SSO'
      );
      expect(result.error?.message).toContain('domain: company.com');
      expect(result.error?.message).toContain('signInWithOAuth');
      expect(result.data).toBeNull();
    });

    it('should return error with appropriate message for OAuth providers', async () => {
      const result = await adapter.signInWithSSO({
        providerId: 'google-oauth-provider',
      });

      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('sso_provider_disabled');
      expect(result.error?.message).toContain('OAuth social providers');
      expect(result.data).toBeNull();
    });
  });

  describe('signInWithWeb3', () => {
    it('should return error when attempting to sign in with Ethereum', async () => {
      const result = await adapter.signInWithWeb3({
        chain: 'ethereum',
        statement: 'Sign in to Example App',
        options: {
          url: 'https://app.example.com',
        },
      });

      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('web3_provider_disabled');
      expect(result.error?.message).toContain(
        'Stack Auth does not support Web3 authentication'
      );
      expect(result.error?.message).toContain('chain: ethereum');
      expect(result.error?.message).toContain('crypto wallet sign-in');
      expect(result.error?.message).toContain('signInWithOAuth');
      expect(result.data.user).toBeNull();
      expect(result.data.session).toBeNull();
    });

    it('should return error when attempting to sign in with Solana', async () => {
      const result = await adapter.signInWithWeb3({
        chain: 'solana',
        statement: 'Sign in to Example App',
        options: {
          url: 'https://app.example.com',
        },
      });

      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('web3_provider_disabled');
      expect(result.error?.message).toContain(
        'Stack Auth does not support Web3 authentication'
      );
      expect(result.error?.message).toContain('chain: solana');
      expect(result.error?.message).toContain('Ethereum, Solana');
      expect(result.data.user).toBeNull();
      expect(result.data.session).toBeNull();
    });

    it('should return error with message/signature format', async () => {
      const result = await adapter.signInWithWeb3({
        chain: 'ethereum',
        message:
          'Example App wants you to sign in with your Ethereum account...',
        signature: '0x1234567890abcdef',
      });

      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('web3_provider_disabled');
      expect(result.error?.message).toContain(
        'Supported authentication methods'
      );
      expect(result.error?.message).toContain(
        'OAuth, email/password, magic link, passkey'
      );
      expect(result.data.user).toBeNull();
      expect(result.data.session).toBeNull();
    });
  });

  describe('getSession', () => {
    it('should return current session', async () => {
      const mockSignedUpAt = new Date();
      const mockGetTokens = vi.fn().mockResolvedValue({
        accessToken: { token: 'access-token' },
        refreshToken: { token: 'refresh-token' },
      });

      mockGetUser.mockResolvedValue({
        id: 'user-123',
        primaryEmail: 'test@example.com',
        signedUpAt: mockSignedUpAt,
        currentSession: {
          getTokens: mockGetTokens,
        },
      });

      const result = await adapter.getSession();

      expect(result.error).toBeNull();
      expect(result.data.session).toBeDefined();
      expect(result.data.session?.access_token).toBe('access-token');
    });

    it('should return null for no session', async () => {
      mockGetUser.mockResolvedValue(null);

      const result = await adapter.getSession();

      expect(result.error).toBeNull();
      expect(result.data.session).toBeNull();
    });
  });

  describe('signOut', () => {
    it('should sign out user', async () => {
      const mockSignOut = vi.fn().mockResolvedValue(undefined);
      mockGetUser.mockResolvedValue({
        id: 'user-123',
        signOut: mockSignOut,
      });

      const result = await adapter.signOut();

      expect(result.error).toBeNull();
      expect(mockSignOut).toHaveBeenCalled();
    });
  });

  describe('getUserIdentities', () => {
    it('should return OAuth identities for authenticated user', async () => {
      const mockSignedUpAt = new Date('2024-01-01T00:00:00Z');
      const mockListOAuthProviders = vi.fn().mockResolvedValue([
        {
          id: 'google-provider-id',
          type: 'google',
          userId: 'user-123',
          accountId: 'google-account-123',
          email: 'test@gmail.com',
          allowSignIn: true,
          allowConnectedAccounts: true,
        },
        {
          id: 'github-provider-id',
          type: 'github',
          userId: 'user-123',
          accountId: 'github-account-456',
          email: 'test@github.com',
          allowSignIn: true,
          allowConnectedAccounts: true,
        },
      ]);

      mockGetUser.mockResolvedValue({
        id: 'user-123',
        primaryEmail: 'test@example.com',
        signedUpAt: mockSignedUpAt,
        listOAuthProviders: mockListOAuthProviders,
      });

      const result = await adapter.getUserIdentities();

      expect(result.error).toBeNull();
      expect(result.data).toBeDefined();
      expect(result.data?.identities).toHaveLength(2);

      // Check Google identity
      expect(result.data?.identities[0]).toMatchObject({
        id: 'google-provider-id',
        user_id: 'user-123',
        identity_id: 'google-provider-id',
        provider: 'google',
        identity_data: {
          email: 'test@gmail.com',
          account_id: 'google-account-123',
          provider_type: 'google',
        },
      });

      // Check GitHub identity
      expect(result.data?.identities[1]).toMatchObject({
        id: 'github-provider-id',
        user_id: 'user-123',
        identity_id: 'github-provider-id',
        provider: 'github',
        identity_data: {
          email: 'test@github.com',
          account_id: 'github-account-456',
          provider_type: 'github',
        },
      });

      expect(mockListOAuthProviders).toHaveBeenCalledOnce();
    });

    it('should return empty identities array when user has no OAuth providers', async () => {
      const mockSignedUpAt = new Date('2024-01-01T00:00:00Z');
      const mockListOAuthProviders = vi.fn().mockResolvedValue([]);

      mockGetUser.mockResolvedValue({
        id: 'user-123',
        primaryEmail: 'test@example.com',
        signedUpAt: mockSignedUpAt,
        listOAuthProviders: mockListOAuthProviders,
      });

      const result = await adapter.getUserIdentities();

      expect(result.error).toBeNull();
      expect(result.data).toBeDefined();
      expect(result.data?.identities).toHaveLength(0);
    });

    it('should return error when user is not authenticated', async () => {
      mockGetUser.mockResolvedValue(null);

      const result = await adapter.getUserIdentities();

      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('session_not_found');
      expect(result.data).toBeNull();
    });
  });

  describe('linkIdentity', () => {
    it('should initiate OAuth flow to link a new identity', async () => {
      const mockGetConnectedAccount = vi.fn().mockResolvedValue({
        id: 'connection-id',
      });

      mockGetUser.mockResolvedValue({
        id: 'user-123',
        primaryEmail: 'test@example.com',
        getConnectedAccount: mockGetConnectedAccount,
      });

      const result = await adapter.linkIdentity({
        provider: 'google',
        options: {
          scopes: 'email profile', // Supabase uses space-separated string
          redirectTo: 'https://app.example.com/callback',
        },
      });

      expect(result.error).toBeNull();
      expect(result.data.provider).toBe('google');
      expect(mockGetConnectedAccount).toHaveBeenCalledWith('google', {
        or: 'redirect',
        scopes: ['email', 'profile'], // Stack Auth expects array
      });
    });

    it('should return error when user is not authenticated', async () => {
      mockGetUser.mockResolvedValue(null);

      const result = await adapter.linkIdentity({
        provider: 'github',
        options: {},
      });

      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('session_not_found');
      expect(result.data.provider).toBe('github');
      expect(result.data.url).toBeNull();
    });

    it('should handle errors during linking', async () => {
      const mockGetConnectedAccount = vi
        .fn()
        .mockRejectedValue(new Error('OAuth linking failed'));

      mockGetUser.mockResolvedValue({
        id: 'user-123',
        getConnectedAccount: mockGetConnectedAccount,
      });

      const result = await adapter.linkIdentity({
        provider: 'facebook',
        options: {},
      });

      expect(result.error).toBeDefined();
      expect(result.data.url).toBeNull();
    });
  });

  describe('unlinkIdentity', () => {
    it('should unlink an OAuth identity from user', async () => {
      const mockDelete = vi.fn().mockResolvedValue(undefined);
      const mockGetOAuthProvider = vi.fn().mockResolvedValue({
        id: 'google-provider-id',
        type: 'google',
        delete: mockDelete,
      });

      const mockGetTokens = vi.fn().mockResolvedValue({
        accessToken: {
          token: generateMockJWT({ exp: Math.floor(Date.now() / 1000) + 3600 }),
        },
        refreshToken: { token: 'refresh-token' },
      });

      mockGetUser.mockResolvedValue({
        id: 'user-123',
        primaryEmail: 'test@example.com',
        signedUpAt: new Date(),
        getOAuthProvider: mockGetOAuthProvider,
        currentSession: {
          getTokens: mockGetTokens,
        },
      });

      const result = await adapter.unlinkIdentity({
        id: 'google-provider-id',
        user_id: 'user-123',
        identity_id: 'google-provider-id',
        provider: 'google',
        identity_data: {},
        created_at: new Date().toISOString(),
        last_sign_in_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      expect(result.error).toBeNull();
      expect(result.data).toEqual({});
      expect(mockGetOAuthProvider).toHaveBeenCalledWith('google-provider-id');
      expect(mockDelete).toHaveBeenCalled();
    });

    it('should return error when user is not authenticated', async () => {
      mockGetUser.mockResolvedValue(null);

      const result = await adapter.unlinkIdentity({
        id: 'provider-id',
        user_id: 'user-123',
        identity_id: 'provider-id',
        provider: 'google',
        identity_data: {},
        created_at: new Date().toISOString(),
        last_sign_in_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('session_not_found');
      expect(result.data).toBeNull();
    });

    it('should return error when identity is not found', async () => {
      const mockGetOAuthProvider = vi.fn().mockResolvedValue(null);

      mockGetUser.mockResolvedValue({
        id: 'user-123',
        primaryEmail: 'test@example.com',
        getOAuthProvider: mockGetOAuthProvider,
      });

      const result = await adapter.unlinkIdentity({
        id: 'non-existent-id',
        user_id: 'user-123',
        identity_id: 'non-existent-id',
        provider: 'google',
        identity_data: {},
        created_at: new Date().toISOString(),
        last_sign_in_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('identity_not_found');
      expect(result.data).toBeNull();
    });

    it('should handle errors during unlinking', async () => {
      const mockDelete = vi.fn().mockRejectedValue(new Error('Delete failed'));
      const mockGetOAuthProvider = vi.fn().mockResolvedValue({
        id: 'provider-id',
        delete: mockDelete,
      });

      mockGetUser.mockResolvedValue({
        id: 'user-123',
        getOAuthProvider: mockGetOAuthProvider,
      });

      const result = await adapter.unlinkIdentity({
        id: 'provider-id',
        user_id: 'user-123',
        identity_id: 'provider-id',
        provider: 'google',
        identity_data: {},
        created_at: new Date().toISOString(),
        last_sign_in_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      expect(result.error).toBeDefined();
      expect(result.data).toBeNull();
    });
  });

  describe('Error Normalization', () => {
    it('should normalize Stack Auth errors to Supabase format', async () => {
      mockSignInWithCredential.mockResolvedValue({
        status: 'error',
        error: {
          message: 'Too many requests, please slow down (rate limit exceeded)',
        },
      });

      const result = await adapter.signInWithPassword({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.error).toBeDefined();
      expect(result.error?.name).toBe('AuthApiError');
      expect(result.error?.code).toBe('over_request_rate_limit');
      expect(result.error?.status).toBe(429);
    });
  });

  describe('Session Caching Optimization', () => {
    let mockUser: any;

    beforeEach(() => {
      // Mock user with internal session
      mockUser = {
        id: 'user-123',
        primaryEmail: 'test@example.com',
        signedUpAt: new Date(),
        clientMetadata: {},
        clientReadOnlyMetadata: {},
        _internalSession: {
          getAccessTokenIfNotExpiredYet: vi.fn(),
          _refreshToken: 'mock-refresh-token',
        },
        currentSession: {
          getTokens: vi.fn(),
        },
      };
    });

    it('should use cached token on getSession() when token is not expired', async () => {
      const mockAccessToken = generateMockJWT({
        exp: Math.floor(Date.now() / 1000) + 3600,
      });
      mockUser._internalSession.getAccessTokenIfNotExpiredYet.mockReturnValue(
        mockAccessToken
      );
      mockGetUser.mockResolvedValue(mockUser);

      const result = await adapter.getSession();

      expect(
        mockUser._internalSession.getAccessTokenIfNotExpiredYet
      ).toHaveBeenCalledWith(0);
      expect(mockUser.currentSession.getTokens).not.toHaveBeenCalled();
      expect(result.data.session).not.toBeNull();
      expect(result.data.session?.access_token).toBe(mockAccessToken);
    });

    it('should fetch fresh tokens when cached token is expired', async () => {
      mockUser._internalSession.getAccessTokenIfNotExpiredYet.mockReturnValue(
        null
      );
      const mockAccessToken = generateMockJWT({
        exp: Math.floor(Date.now() / 1000) + 3600,
      });
      mockUser.currentSession.getTokens.mockResolvedValue({
        accessToken: { token: mockAccessToken },
        refreshToken: { token: 'new-refresh-token' },
      });
      mockGetUser.mockResolvedValue(mockUser);

      const result = await adapter.getSession();

      expect(
        mockUser._internalSession.getAccessTokenIfNotExpiredYet
      ).toHaveBeenCalledWith(0);
      expect(mockUser.currentSession.getTokens).toHaveBeenCalled();
      expect(result.data.session).not.toBeNull();
    });

    it('should use in-memory cache on second getSession() call', async () => {
      const mockAccessToken = generateMockJWT({
        exp: Math.floor(Date.now() / 1000) + 3600,
      });
      mockUser._internalSession.getAccessTokenIfNotExpiredYet.mockReturnValue(
        mockAccessToken
      );
      mockGetUser.mockResolvedValue(mockUser);
      await adapter.getSession();

      vi.clearAllMocks();

      const result = await adapter.getSession();

      expect(mockGetUser).not.toHaveBeenCalled();
      expect(result.data.session).not.toBeNull();
    });

    it('should fallback to public API when _internalSession is not available', async () => {
      const userWithoutInternalSession = {
        ...mockUser,
        _internalSession: undefined,
      };
      const mockAccessToken = generateMockJWT({
        exp: Math.floor(Date.now() / 1000) + 3600,
      });
      userWithoutInternalSession.currentSession.getTokens.mockResolvedValue({
        accessToken: { token: mockAccessToken },
        refreshToken: { token: 'mock-refresh-token' },
      });
      mockGetUser.mockResolvedValue(userWithoutInternalSession);

      const result = await adapter.getSession();

      expect(
        userWithoutInternalSession.currentSession.getTokens
      ).toHaveBeenCalled();
      expect(result.data.session).not.toBeNull();
    });
  });

  describe('verifyOtp', () => {
    describe('magic link verification', () => {
      it('should verify magic link OTP with email type', async () => {
        const mockAccessToken = generateMockJWT({
          exp: Math.floor(Date.now() / 1000) + 3600,
        });

        mockGetSessionFromTokenStore.mockResolvedValue(null);
        mockCreateSession.mockReturnValue({});
        mockSignInWithMagicLink.mockResolvedValue({
          status: 'success',
          data: {
            accessToken: mockAccessToken,
            refreshToken: 'mock-refresh-token',
            newUser: false,
          },
        });
        mockGetOrCreateTokenStore.mockResolvedValue({});
        mockCreateCookieHelper.mockResolvedValue({});
        mockGetUser.mockResolvedValue({
          id: 'user-123',
          primaryEmail: 'test@example.com',
          signedUpAt: new Date(),
          currentSession: {
            getTokens: vi.fn().mockResolvedValue({
              accessToken: { token: mockAccessToken },
              refreshToken: { token: 'mock-refresh-token' },
            }),
          },
        });

        const result = await adapter.verifyOtp({
          email: 'test@example.com',
          token: 'magic-link-code',
          type: 'magiclink',
        });

        expect(mockSignInWithMagicLink).toHaveBeenCalledWith(
          'magic-link-code',
          expect.any(Object)
        );
        expect(result.error).toBeNull();
        expect(result.data.user).toBeDefined();
        expect(result.data.session).toBeDefined();
      });

      it('should verify magic link OTP with email type (generic)', async () => {
        const mockAccessToken = generateMockJWT({
          exp: Math.floor(Date.now() / 1000) + 3600,
        });

        mockGetSessionFromTokenStore.mockResolvedValue(null);
        mockCreateSession.mockReturnValue({});
        mockSignInWithMagicLink.mockResolvedValue({
          status: 'success',
          data: {
            accessToken: mockAccessToken,
            refreshToken: 'mock-refresh-token',
            newUser: false,
          },
        });
        mockGetUser.mockResolvedValue({
          id: 'user-123',
          primaryEmail: 'test@example.com',
          signedUpAt: new Date(),
          currentSession: {
            getTokens: vi.fn().mockResolvedValue({
              accessToken: { token: mockAccessToken },
              refreshToken: { token: 'mock-refresh-token' },
            }),
          },
        });

        const result = await adapter.verifyOtp({
          email: 'test@example.com',
          token: 'otp-code',
          type: 'email',
        });

        expect(mockSignInWithMagicLink).toHaveBeenCalledWith(
          'otp-code',
          expect.any(Object)
        );
        expect(result.error).toBeNull();
        expect(result.data.user).toBeDefined();
        expect(result.data.session).toBeDefined();
      });

      it('should handle magic link verification errors', async () => {
        mockGetSessionFromTokenStore.mockResolvedValue(null);
        mockCreateSession.mockReturnValue({});
        mockSignInWithMagicLink.mockResolvedValue({
          status: 'error',
          error: { message: 'Invalid or expired code' },
        });

        const result = await adapter.verifyOtp({
          email: 'test@example.com',
          token: 'invalid-code',
          type: 'magiclink',
        });

        expect(result.error).toBeDefined();
        expect(result.error?.message).toContain('Invalid or expired code');
        expect(result.data.user).toBeNull();
        expect(result.data.session).toBeNull();
      });
    });

    describe('email verification (signup)', () => {
      it('should verify signup OTP', async () => {
        const mockAccessToken = generateMockJWT({
          exp: Math.floor(Date.now() / 1000) + 3600,
        });

        mockVerifyEmail.mockResolvedValue({ status: 'success' });
        mockGetUser.mockResolvedValue({
          id: 'user-123',
          primaryEmail: 'test@example.com',
          signedUpAt: new Date(),
          currentSession: {
            getTokens: vi.fn().mockResolvedValue({
              accessToken: { token: mockAccessToken },
              refreshToken: { token: 'mock-refresh-token' },
            }),
          },
        });

        const result = await adapter.verifyOtp({
          email: 'test@example.com',
          token: 'verification-code',
          type: 'signup',
        });

        expect(mockVerifyEmail).toHaveBeenCalledWith('verification-code');
        expect(result.error).toBeNull();
        expect(result.data.user).toBeDefined();
      });

      it('should verify invite OTP', async () => {
        mockVerifyEmail.mockResolvedValue({ status: 'success' });
        mockGetUser.mockResolvedValue(null);

        const result = await adapter.verifyOtp({
          email: 'test@example.com',
          token: 'invite-code',
          type: 'invite',
        });

        expect(mockVerifyEmail).toHaveBeenCalledWith('invite-code');
        expect(result.error).toBeNull();
      });

      it('should handle email verification errors', async () => {
        mockVerifyEmail.mockResolvedValue({
          status: 'error',
          error: { message: 'Email already verified' },
        });

        const result = await adapter.verifyOtp({
          email: 'test@example.com',
          token: 'code',
          type: 'signup',
        });

        expect(result.error).toBeDefined();
        expect(result.data.user).toBeNull();
      });
    });

    describe('password recovery', () => {
      it('should verify password recovery code', async () => {
        mockResetPassword.mockResolvedValue({ status: 'success' });

        const result = await adapter.verifyOtp({
          email: 'test@example.com',
          token: 'recovery-code',
          type: 'recovery',
        });

        expect(mockResetPassword).toHaveBeenCalledWith({
          code: 'recovery-code',
          onlyVerifyCode: true,
        });
        expect(result.error).toBeNull();
        expect(result.data.user).toBeNull(); // Recovery doesn't create session
        expect(result.data.session).toBeNull();
      });

      it('should handle invalid recovery code', async () => {
        mockResetPassword.mockResolvedValue({
          status: 'error',
          error: { message: 'Invalid recovery code' },
        });

        const result = await adapter.verifyOtp({
          email: 'test@example.com',
          token: 'invalid-code',
          type: 'recovery',
        });

        expect(result.error).toBeDefined();
        expect(result.data.user).toBeNull();
      });
    });

    describe('email change verification', () => {
      it('should verify email change OTP', async () => {
        const mockAccessToken = generateMockJWT({
          exp: Math.floor(Date.now() / 1000) + 3600,
        });

        mockVerifyEmail.mockResolvedValue({ status: 'success' });
        mockGetUser.mockResolvedValue({
          id: 'user-123',
          primaryEmail: 'new@example.com',
          signedUpAt: new Date(),
          currentSession: {
            getTokens: vi.fn().mockResolvedValue({
              accessToken: { token: mockAccessToken },
              refreshToken: { token: 'mock-refresh-token' },
            }),
          },
        });

        const result = await adapter.verifyOtp({
          email: 'new@example.com',
          token: 'change-code',
          type: 'email_change',
        });

        expect(mockVerifyEmail).toHaveBeenCalledWith('change-code');
        expect(result.error).toBeNull();
        expect(result.data.user).toBeDefined();
      });
    });

    describe('token hash verification', () => {
      it('should verify magic link token hash', async () => {
        const mockAccessToken = generateMockJWT({
          exp: Math.floor(Date.now() / 1000) + 3600,
        });

        mockGetSessionFromTokenStore.mockResolvedValue(null);
        mockCreateSession.mockReturnValue({});
        mockSignInWithMagicLink.mockResolvedValue({
          status: 'success',
          data: {
            accessToken: mockAccessToken,
            refreshToken: 'mock-refresh-token',
            newUser: false,
          },
        });
        mockGetUser.mockResolvedValue({
          id: 'user-123',
          primaryEmail: 'test@example.com',
          signedUpAt: new Date(),
          currentSession: {
            getTokens: vi.fn().mockResolvedValue({
              accessToken: { token: mockAccessToken },
              refreshToken: { token: 'mock-refresh-token' },
            }),
          },
        });

        const result = await adapter.verifyOtp({
          token_hash: 'hashed-token',
          type: 'magiclink',
        });

        expect(mockSignInWithMagicLink).toHaveBeenCalledWith(
          'hashed-token',
          expect.any(Object)
        );
        expect(result.error).toBeNull();
        expect(result.data.user).toBeDefined();
      });

      it('should verify signup token hash', async () => {
        mockVerifyEmail.mockResolvedValue({ status: 'success' });
        mockGetUser.mockResolvedValue(null);

        const result = await adapter.verifyOtp({
          token_hash: 'signup-hash',
          type: 'signup',
        });

        expect(mockVerifyEmail).toHaveBeenCalledWith('signup-hash');
        expect(result.error).toBeNull();
      });

      it('should verify recovery token hash', async () => {
        mockResetPassword.mockResolvedValue({ status: 'success' });

        const result = await adapter.verifyOtp({
          token_hash: 'recovery-hash',
          type: 'recovery',
        });

        expect(mockResetPassword).toHaveBeenCalledWith({
          code: 'recovery-hash',
          onlyVerifyCode: true,
        });
        expect(result.error).toBeNull();
      });
    });

    describe('phone OTP verification', () => {
      it('should return error for phone OTP (not supported)', async () => {
        const result = await adapter.verifyOtp({
          phone: '+1234567890',
          token: 'sms-code',
          type: 'sms',
        });

        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('phone_provider_disabled');
        expect(result.data.user).toBeNull();
      });

      it('should return error for phone change OTP (not supported)', async () => {
        const result = await adapter.verifyOtp({
          phone: '+1234567890',
          token: 'code',
          type: 'phone_change',
        });

        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('phone_provider_disabled');
      });
    });

    describe('unsupported OTP types', () => {
      it('should return error for unsupported email OTP type', async () => {
        const result = await adapter.verifyOtp({
          email: 'test@example.com',
          token: 'code',
          // @ts-expect-error - testing invalid type
          type: 'unknown_type',
        });

        expect(result.error).toBeDefined();
        expect(result.error?.message).toContain('Unsupported');
      });

      it('should return error for invalid params', async () => {
        const result = await adapter.verifyOtp({
          // @ts-expect-error - testing invalid params
          invalid: 'param',
        });

        expect(result.error).toBeDefined();
        expect(result.error?.message).toContain(
          'Invalid OTP verification parameters'
        );
      });
    });
  });

  describe('reauthenticate', () => {
    it('should return error indicating feature is not supported', async () => {
      const result = await adapter.reauthenticate();

      expect(result.data).toEqual({ user: null, session: null });
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain(
        'Stack Auth does not support nonce-based reauthentication'
      );
      expect(result.error?.code).toBe('feature_not_supported');
    });

    it('should provide guidance on alternative approach', async () => {
      const result = await adapter.reauthenticate();

      expect(result.error?.message).toContain('password reset flow');
      expect(result.error?.message).toContain('resetPasswordForEmail');
    });
  });

  describe('updateUser with password', () => {
    it('should return error when attempting to update password', async () => {
      const mockUser = {
        id: 'user-123',
        primaryEmail: 'test@example.com',
        primaryEmailVerified: true,
        displayName: 'Test User',
        profileImageUrl: null,
        signedUpAt: new Date(),
        clientMetadata: {},
        hasPassword: true,
        setPassword: vi.fn(),
        update: vi.fn(),
      };

      vi.spyOn(adapter['stackAuth'], 'getUser').mockResolvedValue(
        mockUser as any
      );

      const result = await adapter.updateUser({
        password: 'newPassword123',
      });

      expect(result.data.user).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain(
        'Password updates require reauthentication'
      );
      expect(result.error?.message).toContain('resetPasswordForEmail');
      expect(result.error?.code).toBe('feature_not_supported');
      expect(mockUser.setPassword).not.toHaveBeenCalled();
    });

    it('should allow other user updates without password', async () => {
      const mockUser = {
        id: 'user-123',
        primaryEmail: 'test@example.com',
        primaryEmailVerified: true,
        displayName: 'Test User',
        profileImageUrl: null,
        signedUpAt: new Date(),
        clientMetadata: {},
        clientReadOnlyMetadata: {},
        hasPassword: true,
        update: vi.fn().mockResolvedValue(undefined),
      };

      vi.spyOn(adapter['stackAuth'], 'getUser')
        .mockResolvedValue(mockUser as any)
        .mockResolvedValueOnce(mockUser as any) // First call in updateUser
        .mockResolvedValueOnce({
          ...mockUser,
          displayName: 'Updated Name',
        } as any); // Second call to get updated user

      const result = await adapter.updateUser({
        data: { displayName: 'Updated Name' },
      });

      expect(result.error).toBeNull();
      expect(result.data.user).toBeDefined();
      expect(mockUser.update).toHaveBeenCalled();
    });
  });
});

// Helper function to generate mock JWT
function generateMockJWT(payload: { exp: number; sub?: string }): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const fullPayload = { sub: 'user-123', ...payload };

  return [
    btoa(JSON.stringify(header)),
    btoa(JSON.stringify(fullPayload)),
    'mock-signature',
  ].join('.');
}
