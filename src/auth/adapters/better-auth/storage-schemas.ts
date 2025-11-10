import { z } from 'zod';

/**
 * Storage validation schemas for Better Auth caches
 *
 * These schemas validate the structure of data being stored/retrieved from cache.
 * They use passthrough() to allow additional fields from Supabase types.
 *
 * Note: We use the original Supabase types from @supabase/auth-js for TypeScript
 * type definitions. These Zod schemas are only for runtime validation.
 */

/**
 * Supabase User schema
 * Based on @supabase/auth-js User type
 * Using passthrough() to allow additional fields from Supabase
 */
const supabaseUserSchema = z
  .object({
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
  })
  .passthrough(); // Allow additional fields from Supabase

/**
 * Supabase Session schema
 * Based on @supabase/auth-js Session type
 * Using passthrough() to allow additional fields
 */
export const sessionSchema = z
  .object({
    access_token: z.string(),
    refresh_token: z.string(),
    expires_at: z.number().optional(),
    expires_in: z.number(),
    token_type: z.literal('bearer'),
    user: supabaseUserSchema,
  })
  .passthrough(); // Allow additional fields

/**
 * Cache entry schema with TTL tracking
 * Used by SessionCache (in-memory)
 */
export const cacheEntrySchema = z.object({
  session: sessionSchema,
  expiresAt: z.number(), // Unix timestamp in milliseconds
});

/**
 * Stored session schema for persistent storage
 * Used by LocalStorageCache
 */
export const storedSessionSchema = z.object({
  session: sessionSchema,
  expiresAt: z.number(), // Unix timestamp in milliseconds
});
