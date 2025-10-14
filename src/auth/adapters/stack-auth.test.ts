import { describe, it, expect, beforeEach, vi } from 'vitest';

// Create mock functions - must be declared before vi.mock
const mockGetUser = vi.fn();
const mockSignUpWithCredential = vi.fn();
const mockSignInWithCredential = vi.fn();
const mockSignInWithOAuth = vi.fn();
const mockSendMagicLinkEmail = vi.fn();
const mockSendForgotPasswordEmail = vi.fn();

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
    },
    StackClientApp: class {
      getUser = mockGetUser;
      signUpWithCredential = mockSignUpWithCredential;
      signInWithCredential = mockSignInWithCredential;
      signInWithOAuth = mockSignInWithOAuth;
      sendMagicLinkEmail = mockSendMagicLinkEmail;
      sendForgotPasswordEmail = mockSendForgotPasswordEmail;
    },
  };
});

// Import after mocking
import { StackAuthAdapter } from './stack-auth';

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
      const mockAccessToken = generateMockJWT({ exp: Math.floor(Date.now() / 1000) + 3600 });
      mockUser._internalSession.getAccessTokenIfNotExpiredYet.mockReturnValue(mockAccessToken);
      mockGetUser.mockResolvedValue(mockUser);

      const result = await adapter.getSession();

      expect(mockUser._internalSession.getAccessTokenIfNotExpiredYet).toHaveBeenCalledWith(0);
      expect(mockUser.currentSession.getTokens).not.toHaveBeenCalled();
      expect(result.data.session).not.toBeNull();
      expect(result.data.session?.access_token).toBe(mockAccessToken);
    });

    it('should fetch fresh tokens when cached token is expired', async () => {
      mockUser._internalSession.getAccessTokenIfNotExpiredYet.mockReturnValue(null);
      const mockAccessToken = generateMockJWT({ exp: Math.floor(Date.now() / 1000) + 3600 });
      mockUser.currentSession.getTokens.mockResolvedValue({
        accessToken: { token: mockAccessToken },
        refreshToken: { token: 'new-refresh-token' },
      });
      mockGetUser.mockResolvedValue(mockUser);

      const result = await adapter.getSession();

      expect(mockUser._internalSession.getAccessTokenIfNotExpiredYet).toHaveBeenCalledWith(0);
      expect(mockUser.currentSession.getTokens).toHaveBeenCalled();
      expect(result.data.session).not.toBeNull();
    });

    it('should use in-memory cache on second getSession() call', async () => {
      const mockAccessToken = generateMockJWT({ exp: Math.floor(Date.now() / 1000) + 3600 });
      mockUser._internalSession.getAccessTokenIfNotExpiredYet.mockReturnValue(mockAccessToken);
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
      const mockAccessToken = generateMockJWT({ exp: Math.floor(Date.now() / 1000) + 3600 });
      userWithoutInternalSession.currentSession.getTokens.mockResolvedValue({
        accessToken: { token: mockAccessToken },
        refreshToken: { token: 'mock-refresh-token' },
      });
      mockGetUser.mockResolvedValue(userWithoutInternalSession);

      const result = await adapter.getSession();

      expect(userWithoutInternalSession.currentSession.getTokens).toHaveBeenCalled();
      expect(result.data.session).not.toBeNull();
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
