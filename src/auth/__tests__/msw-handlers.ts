/**
 * MSW Handlers for Stack Auth API
 *
 * Mocks Stack Auth API endpoints to test our adapter's behavior
 * against various scenarios without making real API calls.
 */

import { http, HttpResponse } from 'msw';

// =============================================================================
// Mock Database: In-memory state for testing
// =============================================================================

interface MockUser {
  id: string;
  email: string;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
  user_metadata: Record<string, any>;
  app_metadata: Record<string, any>;
  password: string; // Store for validation
}

interface MockSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  expires_in: number;
  token_type: 'bearer';
  user: MockUser;
}

class MockAuthDatabase {
  private users: Map<string, MockUser> = new Map();
  private sessions: Map<string, MockSession> = new Map();
  private otpCodes: Map<string, string> = new Map(); // email -> code

  reset() {
    this.users.clear();
    this.sessions.clear();
    this.otpCodes.clear();
  }

  createUser(
    email: string,
    password: string,
    metadata?: Record<string, any>
  ): MockUser {
    const userId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const user: MockUser = {
      id: userId,
      email: email.toLowerCase(),
      email_verified: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_metadata: metadata || {},
      app_metadata: {},
      password, // Store password for sign in validation
    };
    this.users.set(email.toLowerCase(), user);
    return user;
  }

  findUserByEmail(email: string): MockUser | undefined {
    return this.users.get(email.toLowerCase());
  }

  validatePassword(email: string, password: string): boolean {
    const user = this.findUserByEmail(email);
    if (!user) return false;
    return user.password === password;
  }

  updateUser(email: string, updates: Partial<MockUser>): MockUser | undefined {
    const user = this.findUserByEmail(email);
    if (!user) return undefined;

    const updatedUser = {
      ...user,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.users.set(email.toLowerCase(), updatedUser);
    return updatedUser;
  }

  createSession(user: MockUser): MockSession {
    const accessToken = this.generateToken(user.id, 'access', user.email);
    const refreshToken = this.generateToken(user.id, 'refresh', user.email);
    const expiresIn = 3600; // 1 hour
    const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;

    const session: MockSession = {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt,
      expires_in: expiresIn,
      token_type: 'bearer',
      user,
    };

    this.sessions.set(accessToken, session);
    return session;
  }

  getSessionByToken(token: string): MockSession | undefined {
    return this.sessions.get(token);
  }

  getUserByAccessToken(token: string): MockUser | undefined {
    const session = this.getSessionByToken(token);
    if (!session) return undefined;

    // Always fetch the latest user data from the users map, not the session snapshot
    return this.findUserByEmail(session.user.email);
  }

  deleteSession(token: string): void {
    this.sessions.delete(token);
  }

  generateToken(
    userId: string,
    type: 'access' | 'refresh',
    email?: string
  ): string {
    const user = email ? this.findUserByEmail(email) : null;
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));

    // For refresh tokens, minimal payload is fine
    if (type === 'refresh') {
      const payload = btoa(
        JSON.stringify({
          sub: userId,
          email: user?.email || email || null,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 86400,
          role: 'authenticated',
        })
      );
      return `${header}.${payload}.mock-signature-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Access tokens need full Stack Auth schema
    const payload = btoa(
      JSON.stringify({
        sub: userId,
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        iss: 'https://api.stack-auth.com',
        aud: 'test-project',
        project_id: 'test-project',
        branch_id: 'main',
        refresh_token_id: `refresh-${Date.now()}`,
        role: 'authenticated',
        name: user?.user_metadata?.displayName || null,
        email: user?.email || email || null,
        email_verified: user?.email_verified || false,
        selected_team_id: null,
        is_anonymous: false,
      })
    );
    return `${header}.${payload}.mock-signature-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  storeOtpCode(email: string, code: string) {
    this.otpCodes.set(email.toLowerCase(), code);
    // Also store reverse mapping from code to email for verification
    this.otpCodes.set(`code:${code}`, email.toLowerCase());
  }

  verifyOtpCode(email: string, code: string): boolean {
    return this.otpCodes.get(email.toLowerCase()) === code;
  }

  getEmailByOtpCode(code: string): string | undefined {
    return this.otpCodes.get(`code:${code}`);
  }
}

export const mockDb = new MockAuthDatabase();

// =============================================================================
// Stack Auth API Handlers
// =============================================================================

export const stackAuthHandlers = [
  // Sign up with email/password
  http.post(
    'https://api.stack-auth.com/api/v1/auth/password/sign-up',
    async ({ request }) => {
      const body = (await request.json()) as {
        email: string;
        password: string;
        user_metadata?: Record<string, any>;
        client_metadata?: Record<string, any>;
        clientMetadata?: Record<string, any>; // SDK sends camelCase
      };

      // Validate email
      if (!body.email || body.email.trim() === '') {
        return HttpResponse.json(
          {
            status: 'error',
            error: { message: 'Email is required' },
          },
          { status: 400 }
        );
      }

      // Validate password
      if (!body.password || body.password.trim() === '') {
        return HttpResponse.json(
          {
            status: 'error',
            error: { message: 'Password is required' },
          },
          { status: 400 }
        );
      }

      // Check if user already exists
      if (mockDb.findUserByEmail(body.email)) {
        return HttpResponse.json(
          {
            status: 'error',
            error: { message: 'User already exists' },
            httpStatus: 422,
          },
          { status: 422 }
        );
      }

      // Create user (accept both camelCase and snake_case)
      const metadata =
        body.clientMetadata || body.client_metadata || body.user_metadata;
      const user = mockDb.createUser(body.email, body.password, metadata);
      const session = mockDb.createSession(user);

      // Stack Auth expects tokens directly in response
      return HttpResponse.json({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
    }
  ),

  // Sign in with email/password
  http.post(
    'https://api.stack-auth.com/api/v1/auth/password/sign-in',
    async ({ request }) => {
      const body = (await request.json()) as {
        email: string;
        password: string;
      };

      // Validate inputs
      if (!body.email || body.email.trim() === '') {
        return HttpResponse.json(
          {
            status: 'error',
            error: { message: 'Email is required' },
          },
          { status: 400 }
        );
      }

      if (!body.password || body.password.trim() === '') {
        return HttpResponse.json(
          {
            status: 'error',
            error: { message: 'Password is required' },
          },
          { status: 400 }
        );
      }

      // Check credentials
      const user = mockDb.findUserByEmail(body.email);
      if (!user || !mockDb.validatePassword(body.email, body.password)) {
        return HttpResponse.json(
          {
            status: 'error',
            error: { message: 'Invalid login credentials' },
          },
          { status: 400 }
        );
      }

      // Create session
      const session = mockDb.createSession(user);

      // Stack Auth expects tokens directly in response
      return HttpResponse.json({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
    }
  ),

  // Get current user
  http.get('https://api.stack-auth.com/api/v1/users/me', ({ request }) => {
    const authHeader = request.headers.get('x-stack-access-token');
    if (!authHeader) {
      return HttpResponse.json(null);
    }

    const user = mockDb.getUserByAccessToken(authHeader);
    if (!user) {
      return HttpResponse.json(null);
    }

    // Separate displayName/profileImageUrl from the rest of clientMetadata
    const { displayName, profileImageUrl, ...restMetadata } =
      user.user_metadata || {};

    return HttpResponse.json({
      id: user.id,
      primary_email: user.email,
      primary_email_verified: user.email_verified,
      signed_up_at_millis: new Date(user.created_at).getTime(), // Stack Auth uses snake_case and milliseconds!
      display_name: (user.user_metadata?.displayName as string) || null,
      profile_image_url:
        (user.user_metadata?.profileImageUrl as string) || null,
      client_metadata: restMetadata,
      client_read_only_metadata: {},
      has_password: true,
      auth_with_email: true,
      otp_auth_enabled: true,
    });
  }),

  // Update user
  http.patch(
    'https://api.stack-auth.com/api/v1/users/me',
    async ({ request }) => {
      const authHeader = request.headers.get('x-stack-access-token');
      if (!authHeader) {
        return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const user = mockDb.getUserByAccessToken(authHeader);
      if (!user) {
        return HttpResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const body = (await request.json()) as any;

      // Update user metadata - start with existing metadata
      const updatedMetadata = { ...user.user_metadata };

      // Merge in client_metadata (snake_case) if provided
      if (body.client_metadata) {
        Object.assign(updatedMetadata, body.client_metadata);
      }

      // Handle display_name and profile_image_url (snake_case) specially
      if (body.display_name !== undefined) {
        updatedMetadata.displayName = body.display_name;
      }
      if (body.profile_image_url !== undefined) {
        updatedMetadata.profileImageUrl = body.profile_image_url;
      }

      const updatedUser = mockDb.updateUser(user.email, {
        user_metadata: updatedMetadata,
      });

      if (!updatedUser) {
        return HttpResponse.json({ error: 'Update failed' }, { status: 500 });
      }

      // Separate displayName/profileImageUrl from the rest of clientMetadata for response
      const { displayName, profileImageUrl, ...restMetadata } =
        updatedUser.user_metadata || {};

      return HttpResponse.json({
        id: updatedUser.id,
        primary_email: updatedUser.email,
        primary_email_verified: updatedUser.email_verified,
        signed_up_at_millis: new Date(updatedUser.created_at).getTime(), // Stack Auth uses snake_case and milliseconds!
        display_name: displayName || null,
        profile_image_url: profileImageUrl || null,
        client_metadata: restMetadata,
        client_read_only_metadata: {},
        has_password: true,
        auth_with_email: true,
        otp_auth_enabled: true,
      });
    }
  ),

  // Sign out (delete session)
  http.delete(
    'https://api.stack-auth.com/api/v1/auth/sessions/current',
    async ({ request }) => {
      const authHeader = request.headers.get('x-stack-access-token');
      if (authHeader) {
        mockDb.deleteSession(authHeader);
      }
      return HttpResponse.json({ success: true });
    }
  ),

  // Get session/tokens
  http.get(
    'https://api.stack-auth.com/api/v1/auth/session/tokens',
    ({ request }) => {
      const authHeader = request.headers.get('x-stack-access-token');
      if (!authHeader) {
        return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const session = mockDb.getSessionByToken(authHeader);
      if (!session) {
        return HttpResponse.json({ error: 'Invalid session' }, { status: 401 });
      }

      return HttpResponse.json({
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
      });
    }
  ),

  // Sign out
  http.post('https://api.stack-auth.com/api/v1/auth/signout', ({ request }) => {
    const authHeader = request.headers.get('x-stack-access-token');
    if (authHeader) {
      mockDb.deleteSession(authHeader);
    }

    return HttpResponse.json({
      status: 'success',
    });
  }),

  // Send OTP (magic link) - Stack Auth endpoint
  http.post(
    'https://api.stack-auth.com/api/v1/auth/otp/send-sign-in-code',
    async ({ request }) => {
      const body = (await request.json()) as {
        email: string;
        callback_url: string;
      };
      const code = 'valid-code'; // Use a fixed code for testing

      mockDb.storeOtpCode(body.email, code);

      return HttpResponse.json({
        status: 'success',
      });
    }
  ),

  // Verify OTP - Stack Auth endpoint (code-only verification)
  http.post(
    'https://api.stack-auth.com/api/v1/auth/otp/sign-in',
    async ({ request }) => {
      const body = (await request.json()) as { code: string };

      // Look up the email by code
      const email = mockDb.getEmailByOtpCode(body.code);
      if (!email || !mockDb.verifyOtpCode(email, body.code)) {
        return HttpResponse.json(
          {
            status: 'error',
            error: { message: 'Invalid or expired OTP' },
          },
          { status: 400 }
        );
      }

      // Get or create user
      let user = mockDb.findUserByEmail(email);
      if (!user) {
        user = mockDb.createUser(email, '', {});
        user.email_verified = true; // OTP verifies email
      }

      const session = mockDb.createSession(user);

      // Stack Auth returns access_token and refresh_token directly
      return HttpResponse.json({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        is_new_user: false,
      });
    }
  ),

  // Send password reset
  http.post(
    'https://api.stack-auth.com/api/v1/auth/password/reset/send',
    async () => {
      // Just acknowledge - in real scenario would send email
      return HttpResponse.json({
        status: 'success',
      });
    }
  ),

  // OAuth sign in
  http.post(
    'https://api.stack-auth.com/api/v1/auth/oauth/authorize',
    async ({ request }) => {
      const body = (await request.json()) as {
        provider: string;
        redirectUrl?: string;
      };

      const provider = body.provider;

      return HttpResponse.json({
        status: 'success',
        data: {
          url: `https://oauth.${provider}.com/authorize?redirect_uri=${body.redirectUrl || ''}`,
          provider,
        },
      });
    }
  ),

  // Update user
  http.patch(
    'https://api.stack-auth.com/api/v1/users/me',
    async ({ request }) => {
      const authHeader = request.headers.get('x-stack-access-token');
      if (!authHeader) {
        return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const user = mockDb.getUserByAccessToken(authHeader);
      if (!user) {
        return HttpResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const body = (await request.json()) as {
        email?: string;
        user_metadata?: Record<string, any>;
      };

      const updatedUser = mockDb.updateUser(user.email, {
        ...(body.email && { email: body.email.toLowerCase() }),
        ...(body.user_metadata && {
          user_metadata: { ...user.user_metadata, ...body.user_metadata },
        }),
      });

      if (!updatedUser) {
        return HttpResponse.json({ error: 'Update failed' }, { status: 500 });
      }

      return HttpResponse.json({
        status: 'success',
        data: {
          user: {
            id: updatedUser.id,
            email: updatedUser.email,
            email_verified: updatedUser.email_verified,
            created_at: updatedUser.created_at,
            updated_at: updatedUser.updated_at,
            user_metadata: updatedUser.user_metadata,
            app_metadata: updatedUser.app_metadata,
          },
        },
      });
    }
  ),

  // Token refresh (OAuth token endpoint)
  http.post(
    'https://api.stack-auth.com/api/v1/auth/oauth/token',
    async ({ request }) => {
      const body = await request.text();
      const params = new URLSearchParams(body);
      const refreshToken = params.get('refresh_token');
      const grantType = params.get('grant_type');

      if (grantType !== 'refresh_token' || !refreshToken) {
        return HttpResponse.json(
          {
            error: 'invalid_grant',
            error_description: 'Invalid grant type or missing refresh token',
          },
          { status: 400 }
        );
      }

      // Decode refresh token to get user ID
      try {
        const payload = JSON.parse(atob(refreshToken.split('.')[1]));
        const userId = payload.sub;
        const email = payload.email;

        // Generate new tokens
        const newAccessToken = mockDb.generateToken(userId, 'access', email);
        const newRefreshToken = mockDb.generateToken(userId, 'refresh', email);

        return HttpResponse.json({
          access_token: newAccessToken,
          refresh_token: newRefreshToken,
          token_type: 'Bearer',
          expires_in: 3600,
        });
      } catch (_error) {
        return HttpResponse.json(
          {
            error: 'invalid_token',
            error_description: 'Invalid refresh token format',
          },
          { status: 400 }
        );
      }
    }
  ),
];

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Reset all mock data between tests
 */
export function resetMockDatabase() {
  mockDb.reset();
}

/**
 * Create a pre-authenticated user for testing
 */
export function createAuthenticatedUser(email: string = 'test@example.com') {
  const user = mockDb.createUser(email, 'password123', { name: 'Test User' });
  const session = mockDb.createSession(user);
  return { user, session };
}
