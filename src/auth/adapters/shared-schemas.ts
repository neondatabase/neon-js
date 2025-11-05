import { z } from 'zod';

/**
 * JWT access token payload schema
 * Used for validating and parsing JWT tokens from authentication providers
 */
export const accessTokenSchema = z.object({
  exp: z.number(),
  iat: z.number(),
  sub: z.string(),
  email: z.string().nullable(),
});
