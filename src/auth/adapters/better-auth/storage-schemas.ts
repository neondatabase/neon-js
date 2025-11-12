import { z } from 'zod';
import type { Session } from '@supabase/auth-js';

/**
 * Storage validation schemas for Better Auth caches
 *
 * These schemas validate the structure of session data.
 * We use the original Supabase types from @supabase/auth-js for TypeScript
 * type definitions. These Zod schemas are only for runtime validation.
 */

/**
 * Supabase User schema
 * Based on @supabase/auth-js User type
 */
const userSchema = z.object({
  id: z.string(),
  email: z.string().optional(),
  email_confirmed_at: z.string().optional(),
  phone: z.string().optional(),
  confirmed_at: z.string().optional(),
  last_sign_in_at: z.string().optional(),
  app_metadata: z.record(z.string(), z.unknown()),
  user_metadata: z.record(z.string(), z.unknown()),
  identities: z.array(z.any()).optional(),
  created_at: z.string(),
  updated_at: z.string().optional(),
  aud: z.string(),
  role: z.string().optional(),
}) satisfies z.ZodType<Session['user']>;

/**
 * Supabase Session schema
 * Based on @supabase/auth-js Session type
 * Used for validating session structure from Better Auth responses
 */
export const sessionSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_at: z.number().optional(),
  expires_in: z.number(),
  token_type: z.literal('bearer'),
  user: userSchema,
}) satisfies z.ZodType<Session>;
