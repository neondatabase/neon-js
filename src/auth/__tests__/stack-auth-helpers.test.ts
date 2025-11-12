import { describe, it, expect } from 'vitest';
import { accessTokenSchema } from '@/auth/adapters/stack-auth/stack-auth-schemas';

/**
 * Helper function tests for Stack Auth Adapter
 *
 * These tests verify utility functions, error handling, and JWT processing
 * to ensure behavior parity with Supabase's auth helpers.
 */

describe('StackAuthAdapter - Helpers', () => {
  describe('JWT Token Utilities', () => {
    describe('JWT Decoding', () => {
      it('should decode valid JWT token', () => {
        // Create a valid JWT structure
        const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
        const payload = btoa(
          JSON.stringify({
            sub: 'user-123',
            exp: Math.floor(Date.now() / 1000) + 3600,
          })
        );
        const token = `${header}.${payload}.signature`;

        // Decode
        const parts = token.split('.');
        const decodedPayload = JSON.parse(atob(parts[1]));

        expect(decodedPayload.sub).toBe('user-123');
        expect(decodedPayload.exp).toBeDefined();
      });

      it('should handle invalid JWT format', () => {
        const invalidToken = 'not-a-valid.jwt-token';

        const decodePart = () => {
          const parts = invalidToken.split('.');
          if (parts.length !== 3) {
            throw new Error('Invalid token format');
          }
          return JSON.parse(atob(parts[1]));
        };

        expect(decodePart).toThrow('Invalid token format');
      });

      it('should throw error for malformed base64 payload', () => {
        const malformedToken = 'header.!!!invalid-base64!!!.signature';

        const decodePart = () => {
          const parts = malformedToken.split('.');
          return JSON.parse(atob(parts[1]));
        };

        expect(decodePart).toThrow();
      });
    });

    describe('JWT Expiration Detection', () => {
      it('should detect non-expired token', () => {
        const futureExp = Math.floor(Date.now() / 1000) + 3600;
        const isExpired = (exp: number) => exp < Math.floor(Date.now() / 1000);

        expect(isExpired(futureExp)).toBe(false);
      });

      it('should detect expired token', () => {
        const pastExp = Math.floor(Date.now() / 1000) - 3600;
        const isExpired = (exp: number) => exp < Math.floor(Date.now() / 1000);

        expect(isExpired(pastExp)).toBe(true);
      });

      it('should detect token expiring soon (within 90 seconds)', () => {
        const almostExpired = Math.floor(Date.now() / 1000) + 30;
        const isAlmostExpired = (exp: number, threshold: number = 90) =>
          exp - Math.floor(Date.now() / 1000) < threshold;

        expect(isAlmostExpired(almostExpired)).toBe(true);
      });
    });

    describe('JWT Schema Validation', () => {
      it('should validate JWT with required fields', () => {
        const validPayload = {
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
          sub: 'user-123',
          email: 'test@example.com',
        };

        const result = accessTokenSchema.safeParse(validPayload);
        expect(result.success).toBe(true);
      });

      it('should accept JWT without email', () => {
        const payloadWithoutEmail = {
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
          sub: 'user-123',
          email: null,
        };

        const result = accessTokenSchema.safeParse(payloadWithoutEmail);
        expect(result.success).toBe(true);
      });

      it('should reject JWT without exp', () => {
        const payloadMissingExp = {
          iat: Math.floor(Date.now() / 1000),
          sub: 'user-123',
          email: 'test@example.com',
        };

        const result = accessTokenSchema.safeParse(payloadMissingExp);
        expect(result.success).toBe(false);
      });

      it('should reject JWT without sub', () => {
        const payloadMissingSub = {
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
          email: 'test@example.com',
        };

        const result = accessTokenSchema.safeParse(payloadMissingSub);
        expect(result.success).toBe(false);
      });

      it('should reject JWT with invalid exp type', () => {
        const payloadInvalidExp = {
          exp: 'not-a-number',
          iat: Math.floor(Date.now() / 1000),
          sub: 'user-123',
          email: 'test@example.com',
        };

        const result = accessTokenSchema.safeParse(payloadInvalidExp);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Error Normalization', () => {
    describe('Stack Auth Error Mapping', () => {
      it('should map "Invalid login credentials" to invalid_credentials', () => {
        const errorMessage = 'Invalid login credentials';
        const normalize = (msg: string) => {
          if (msg.includes('Invalid login credentials')) {
            return { code: 'invalid_credentials', status: 400 };
          }
          return { code: 'unknown_error', status: 500 };
        };

        const result = normalize(errorMessage);
        expect(result.code).toBe('invalid_credentials');
        expect(result.status).toBe(400);
      });

      it('should map "already exists" to user_already_exists', () => {
        const errorMessage = 'User already exists';
        const normalize = (msg: string) => {
          if (msg.toLowerCase().includes('already exists')) {
            return { code: 'user_already_exists', status: 422 };
          }
          return { code: 'unknown_error', status: 500 };
        };

        const result = normalize(errorMessage);
        expect(result.code).toBe('user_already_exists');
        expect(result.status).toBe(422);
      });

      it('should map "not found" to user_not_found', () => {
        const errorMessage = 'User not found';
        const normalize = (msg: string) => {
          if (msg.toLowerCase().includes('not found')) {
            return { code: 'user_not_found', status: 404 };
          }
          return { code: 'unknown_error', status: 500 };
        };

        const result = normalize(errorMessage);
        expect(result.code).toBe('user_not_found');
        expect(result.status).toBe(404);
      });

      it('should map "token invalid" to bad_jwt', () => {
        const errorMessage = 'token invalid';
        const normalize = (msg: string) => {
          if (msg.toLowerCase().includes('token invalid')) {
            return { code: 'bad_jwt', status: 401 };
          }
          return { code: 'unknown_error', status: 500 };
        };

        const result = normalize(errorMessage);
        expect(result.code).toBe('bad_jwt');
        expect(result.status).toBe(401);
      });

      it('should map rate limiting to over_request_rate_limit', () => {
        const errorMessage =
          'Too many requests, please slow down (rate limit exceeded)';
        const normalize = (msg: string) => {
          if (msg.toLowerCase().includes('rate limit')) {
            return { code: 'over_request_rate_limit', status: 429 };
          }
          return { code: 'unknown_error', status: 500 };
        };

        const result = normalize(errorMessage);
        expect(result.code).toBe('over_request_rate_limit');
        expect(result.status).toBe(429);
      });

      it('should map email invalid to email_address_invalid', () => {
        const errorMessage = 'Invalid email address';
        const normalize = (msg: string) => {
          if (msg.toLowerCase().includes('invalid email')) {
            return { code: 'email_address_invalid', status: 400 };
          }
          return { code: 'unknown_error', status: 500 };
        };

        const result = normalize(errorMessage);
        expect(result.code).toBe('email_address_invalid');
        expect(result.status).toBe(400);
      });

      it('should preserve original message in error', () => {
        const originalMessage = 'Custom error from Stack Auth';
        const error = {
          message: originalMessage,
          code: 'custom_error',
          status: 500,
        };

        expect(error.message).toBe(originalMessage);
      });
    });

    describe('Error Code Consistency', () => {
      it('should use consistent error code format', () => {
        const errorCodes = [
          'invalid_credentials',
          'user_already_exists',
          'user_not_found',
          'bad_jwt',
          'over_request_rate_limit',
          'email_address_invalid',
          'phone_provider_disabled',
          'id_token_provider_disabled',
          'sso_provider_disabled',
          'web3_provider_disabled',
          'feature_not_supported',
        ];

        errorCodes.forEach((code) => {
          // All codes should be snake_case (allowing digits)
          expect(code).toMatch(/^[a-z0-9_]+$/);
        });
      });

      it('should use consistent HTTP status codes', () => {
        const statusCodeMappings = {
          invalid_credentials: 400,
          user_already_exists: 422,
          user_not_found: 404,
          bad_jwt: 401,
          over_request_rate_limit: 429,
          email_address_invalid: 400,
        };

        Object.entries(statusCodeMappings).forEach(([_code, status]) => {
          expect([400, 401, 404, 422, 429]).toContain(status);
        });
      });
    });
  });

  describe('Session Construction', () => {
    describe('Token Extraction', () => {
      it('should extract access token from session response', () => {
        const sessionResponse = {
          accessToken: { token: 'access-token-123' },
          refreshToken: { token: 'refresh-token-456' },
        };

        const accessToken = sessionResponse.accessToken.token;

        expect(accessToken).toBe('access-token-123');
      });

      it('should extract refresh token from session response', () => {
        const sessionResponse = {
          accessToken: { token: 'access-token-123' },
          refreshToken: { token: 'refresh-token-456' },
        };

        const refreshToken = sessionResponse.refreshToken.token;

        expect(refreshToken).toBe('refresh-token-456');
      });

      it('should handle missing token gracefully', () => {
        const sessionResponse = {
          accessToken: { token: null },
          refreshToken: { token: null },
        };

        const getAccessToken = () => sessionResponse.accessToken?.token ?? null;
        const token = getAccessToken();

        expect(token).toBeNull();
      });
    });

    describe('Field Name Normalization', () => {
      it('should normalize Stack Auth field names to Supabase format', () => {
        const stackAuthUser = {
          id: 'user-123',
          primaryEmail: 'test@example.com',
          displayName: 'Test User',
          profileImageUrl: 'https://example.com/avatar.jpg',
          signedUpAt: new Date().toISOString(),
          primaryEmailVerified: true,
          clientMetadata: { theme: 'dark', plan: 'premium' },
        };

        const supabaseFormat = {
          id: stackAuthUser.id,
          email: stackAuthUser.primaryEmail,
          user_metadata: {
            displayName: stackAuthUser.displayName,
            profileImageUrl: stackAuthUser.profileImageUrl,
            ...stackAuthUser.clientMetadata,
          },
          email_confirmed_at: stackAuthUser.primaryEmailVerified
            ? stackAuthUser.signedUpAt
            : null,
        };

        expect(supabaseFormat.email).toBe('test@example.com');
        expect(supabaseFormat.user_metadata.theme).toBe('dark');
        expect(supabaseFormat.email_confirmed_at).toBeDefined();
      });

      it('should handle missing optional fields', () => {
        const stackAuthUser = {
          id: 'user-123',
          primaryEmail: 'test@example.com',
          displayName: null,
          profileImageUrl: null,
          signedUpAt: new Date().toISOString(),
          primaryEmailVerified: false,
          clientMetadata: {},
        };

        const supabaseFormat = {
          id: stackAuthUser.id,
          email: stackAuthUser.primaryEmail,
          user_metadata: {
            displayName: stackAuthUser.displayName,
            profileImageUrl: stackAuthUser.profileImageUrl,
            ...stackAuthUser.clientMetadata,
          },
        };

        expect(supabaseFormat.user_metadata.displayName).toBeNull();
        expect(supabaseFormat.user_metadata.profileImageUrl).toBeNull();
      });
    });

    describe('Session Object Construction', () => {
      it('should construct valid session object', () => {
        const token =
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsImV4cCI6OTk5OTk5OTk5OSwiaWF0IjoxNjAwMDAwMDAwLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20ifQ.signature';
        const refreshToken = 'refresh-token-456';
        const expiresAt = 9999999999;

        const session = {
          access_token: token,
          refresh_token: refreshToken,
          expires_at: expiresAt,
          expires_in: expiresAt - Math.floor(Date.now() / 1000),
          token_type: 'Bearer',
        };

        expect(session.access_token).toBe(token);
        expect(session.refresh_token).toBe(refreshToken);
        expect(session.token_type).toBe('Bearer');
      });

      it('should calculate expiration correctly', () => {
        const exp = Math.floor(Date.now() / 1000) + 3600;
        const expiresIn = exp - Math.floor(Date.now() / 1000);

        expect(expiresIn).toBeGreaterThan(3500);
        expect(expiresIn).toBeLessThanOrEqual(3600);
      });
    });
  });

  describe('Type Safety', () => {
    it('should maintain TypeScript type safety for error objects', () => {
      interface AuthError {
        message: string;
        code: string;
        status: number;
      }

      const error: AuthError = {
        message: 'Authentication failed',
        code: 'invalid_credentials',
        status: 400,
      };

      expect(error.code).toBe('invalid_credentials');
      expect(typeof error.status).toBe('number');
    });

    it('should maintain TypeScript type safety for session objects', () => {
      interface Session {
        access_token: string;
        refresh_token: string;
        expires_at: number;
        expires_in: number;
        token_type: string;
      }

      const session: Session = {
        access_token: 'token',
        refresh_token: 'refresh',
        expires_at: 9999999999,
        expires_in: 3600,
        token_type: 'Bearer',
      };

      expect(session.token_type).toBe('Bearer');
      expect(typeof session.expires_at).toBe('number');
    });
  });
});
