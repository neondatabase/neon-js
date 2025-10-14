import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StackClientAppConstructorOptions } from '@stackframe/js';

// Create a shared mock function reference
const mockGetSession = vi.fn();

// Mock module at the top level
vi.mock('@/auth/adapters/stack-auth', () => {
  return {
    StackAuthAdapter: class MockStackAuthAdapter {
      getSession = mockGetSession;
    },
  };
});

// Import after mocking
import { createClient, NeonClient } from './neon-client';

describe('createClient', () => {
  const mockUrl = 'https://test.neon.tech/rest/v1';
  const mockAuthOptions: StackClientAppConstructorOptions<false, string> = {
    projectId: 'test-project',
    publishableClientKey: 'test-key',
    tokenStore: null,
  };

  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset mocks
    mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });
    global.fetch = mockFetch;

    // Setup default mock for getSession
    mockGetSession.mockReset().mockResolvedValue({
      data: {
        session: {
          access_token: 'test-token',
          refresh_token: 'refresh',
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          token_type: 'bearer',
          user: {
            id: 'user-1',
            aud: 'authenticated',
            role: 'authenticated',
            email: 'test@example.com',
            created_at: new Date().toISOString(),
            app_metadata: {},
            user_metadata: {},
          },
        },
      },
      error: null,
    });
  });

  it('should create NeonClient instance', () => {
    const client = createClient({ url: mockUrl, auth: mockAuthOptions });

    expect(client).toBeInstanceOf(NeonClient);
    expect(client.auth).toBeDefined();
    expect(client.auth.getSession).toBeDefined();
  });

  it('should inject JWT token when user is authenticated', async () => {
    const client = createClient({ url: mockUrl, auth: mockAuthOptions });

    // Make a request
    await client.from('users').select();

    // Verify fetch was called with JWT
    expect(mockFetch).toHaveBeenCalled();
    const [, requestInit] = mockFetch.mock.calls[0];
    const headers = new Headers(requestInit.headers);

    expect(headers.get('Authorization')).toBe(`Bearer test-token`);
  });

  it('should throw AuthRequiredError when no session exists', async () => {
    // Mock failed auth (no session)
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const client = createClient({ url: mockUrl, auth: mockAuthOptions });

    // Make a request - postgrest-js catches errors and returns them in error field
    const { data, error } = await client.from('users').select();

    expect(data).toBeNull();
    expect(error).toBeDefined();
    expect(error?.message).toContain('Authentication required');
  });

  it('should fetch fresh token on each request (lazy resolution)', async () => {
    let currentToken = 'initial-token';

    mockGetSession.mockImplementation(async () => ({
      data: {
        session: {
          access_token: currentToken,
          refresh_token: 'refresh',
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          token_type: 'bearer',
          user: {
            id: 'user-1',
            aud: 'authenticated',
            role: 'authenticated',
            email: 'test@example.com',
            created_at: new Date().toISOString(),
            app_metadata: {},
            user_metadata: {},
          },
        },
      },
      error: null,
    }));

    const client = createClient({ url: mockUrl, auth: mockAuthOptions });

    // First request
    await client.from('users').select();
    let headers = new Headers(mockFetch.mock.calls[0][1].headers);
    expect(headers.get('Authorization')).toBe(`Bearer initial-token`);

    // Simulate token refresh
    currentToken = 'refreshed-token';

    // Second request should use new token
    await client.from('users').select();
    headers = new Headers(mockFetch.mock.calls[1][1].headers);
    expect(headers.get('Authorization')).toBe(`Bearer refreshed-token`);

    // Verify getSession was called twice (lazy resolution)
    expect(mockGetSession).toHaveBeenCalledTimes(2);
  });
});
