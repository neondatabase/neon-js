import type { createAuthClient as createReactAuthClient } from 'better-auth/react';
import type { createAuthClient as createVanillaAuthClient } from 'better-auth/client';
import { BetterAuthReactAdapter } from './adapters/better-auth-react/better-auth-react-adapter';
import { BetterAuthVanillaAdapter } from './adapters/better-auth-vanilla/better-auth-vanilla-adapter';
import { SupabaseAuthAdapter } from './adapters/supabase/supabase-adapter';

/**
 * Type representing the Better Auth React client
 */
export type ReactBetterAuthClient = ReturnType<typeof createReactAuthClient>;

/**
 * Type representing the Better Auth Vanilla client
 */
export type VanillaBetterAuthClient = ReturnType<
  typeof createVanillaAuthClient
>;

/**
 * Union type of all supported auth adapter CLASSES (not instances)
 * Use this when you need to pass an adapter class as a parameter
 */
export type NeonAuthAdapterClass =
  | typeof BetterAuthVanillaAdapter
  | typeof BetterAuthReactAdapter
  | typeof SupabaseAuthAdapter;

/**
 * Union type of all supported auth adapter instances
 */
export type NeonAuthAdapter =
  | BetterAuthVanillaAdapter
  | BetterAuthReactAdapter
  | SupabaseAuthAdapter;

/**
 * Configuration for createNeonAuth
 * T is the adapter CLASS type (typeof SupabaseAuthAdapter), not the instance type
 */
export interface NeonAuthConfig<T extends NeonAuthAdapterClass> {
  /** The adapter class to use (e.g., SupabaseAuthAdapter, BetterAuthVanillaAdapter) */
  adapter: T;
  /** Additional options to pass to the adapter (baseURL is auto-injected) */
  options?: Omit<ConstructorParameters<T>[0], 'baseURL'>;
}

/**
 * Resolves the public API type for an adapter.
 * - SupabaseAuthAdapter: exposes its own methods directly (Supabase-compatible API)
 * - BetterAuth adapters: expose the Better Auth client directly
 */
export type NeonAuthPublicApi<T extends NeonAuthAdapter> =
  T extends BetterAuthVanillaAdapter
    ? VanillaBetterAuthClient
    : T extends BetterAuthReactAdapter
      ? ReactBetterAuthClient
      : T; // SupabaseAuthAdapter - use adapter methods directly

/**
 * NeonAuth type - combines base functionality with the appropriate public API
 * This is the return type of createNeonAuth()
 *
 * For SupabaseAuthAdapter: exposes Supabase-compatible methods (signInWithPassword, getSession, etc.)
 * For BetterAuth adapters: exposes the Better Auth client directly (signIn.email, signUp.email, etc.)
 */
export type NeonAuth<T extends NeonAuthAdapter> = {
  adapter: NeonAuthPublicApi<T>;
  getJWTToken: () => Promise<string | null>;
};

/**
 * Create a NeonAuth instance that exposes the appropriate API based on the adapter.
 *
 * @param url - The auth service URL (e.g., 'https://auth.example.com')
 * @param config - Configuration with adapter class and optional adapter-specific options
 * @returns NeonAuth instance with the adapter's API exposed directly
 *
 * @example SupabaseAuthAdapter - Supabase-compatible API
 * ```typescript
 * import { createNeonAuth, SupabaseAuthAdapter } from '@neondatabase/neon-auth';
 *
 * const auth = createNeonAuth('https://auth.example.com', {
 *   adapter: SupabaseAuthAdapter,
 * });
 *
 * // Supabase-compatible methods
 * await auth.signInWithPassword({ email, password });
 * await auth.getSession();
 * ```
 *
 * @example BetterAuthVanillaAdapter - Direct Better Auth API
 * ```typescript
 * import { createNeonAuth, BetterAuthVanillaAdapter } from '@neondatabase/neon-auth';
 *
 * const auth = createNeonAuth('https://auth.example.com', {
 *   adapter: BetterAuthVanillaAdapter,
 * });
 *
 * // Direct Better Auth API access
 * await auth.signIn.email({ email, password });
 * await auth.signUp.email({ email, password, name: 'John' });
 * await auth.getSession();
 * ```
 *
 * @example BetterAuthReactAdapter - Better Auth with React hooks
 * ```typescript
 * import { createNeonAuth, BetterAuthReactAdapter } from '@neondatabase/neon-auth';
 *
 * const auth = createNeonAuth('https://auth.example.com', {
 *   adapter: BetterAuthReactAdapter,
 * });
 *
 * // Direct Better Auth API with React hooks
 * await auth.signIn.email({ email, password });
 * const session = auth.useSession(); // React hook
 * ```
 */
export function createInternalNeonAuth<T extends NeonAuthAdapterClass>(
  url: string,
  config: NeonAuthConfig<T>
): NeonAuth<InstanceType<T>> {
  // Instantiate adapter with URL + user options
  const adapter = new config.adapter({
    baseURL: url,
    ...config.options,
  }) as InstanceType<T>;

  // Check if this is a SupabaseAuthAdapter by checking for its unique initialize method
  const isSupabaseAuthAdapter =
    typeof (adapter as any).initialize === 'function';

  if (!isSupabaseAuthAdapter) {
    console.log('isBetterAuthAdapter');
    return {
      getJWTToken: adapter.getJWTToken.bind(adapter),
      adapter: adapter.getBetterAuthInstance(),
    } as NeonAuth<InstanceType<T>>;
  }

  console.log('isSupabaseAuthAdapter');
  return {
    getJWTToken: adapter.getJWTToken.bind(adapter),
    adapter,
  } as NeonAuth<InstanceType<T>>;
}

export function createNeonAuth<T extends NeonAuthAdapterClass>(
  url: string,
  config: NeonAuthConfig<T>
): NeonAuthPublicApi<InstanceType<T>> {
  const internalAuth = createInternalNeonAuth(url, config);
  return internalAuth.adapter;
}
