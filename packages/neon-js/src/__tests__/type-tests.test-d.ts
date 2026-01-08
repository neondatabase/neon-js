/**
 * Type tests for createClient
 * Run with: vitest --typecheck or bun test:types
 *
 * These tests verify that TypeScript correctly infers types based on the adapter.
 */

import { describe, it, expectTypeOf } from 'vitest';
import { createClient } from '../client/client-factory';
import {
  SupabaseAuthAdapter,
  BetterAuthVanillaAdapter,
} from '@neondatabase/auth/vanilla/adapters';
import { BetterAuthReactAdapter } from '@neondatabase/auth/react/adapters';

// =============================================================================
// Test 1: SupabaseAuthAdapter - should infer SupabaseAuthAdapter methods
// =============================================================================
describe('SupabaseAuthAdapter type inference', () => {
  const supabaseClient = createClient({
    auth: {
      adapter: SupabaseAuthAdapter(),
      url: 'https://auth.example.com',
    },
    dataApi: {
      url: 'https://data-api.example.com/rest/v1',
    },
  });

  it('should have getSession method', () => {
    expectTypeOf(supabaseClient.auth.getSession).toBeFunction();
  });

  it('should have getJWTToken method', () => {
    expectTypeOf(supabaseClient.auth.getJWTToken).toBeFunction();
  });

  it('should have signInWithPassword method (Supabase API)', () => {
    expectTypeOf(supabaseClient.auth.signInWithPassword).toBeFunction();
  });

  it('should have signUp method (Supabase API)', () => {
    expectTypeOf(supabaseClient.auth.signUp).toBeFunction();
  });

  it('should have signOut method', () => {
    expectTypeOf(supabaseClient.auth.signOut).toBeFunction();
  });
});

// =============================================================================
// Test 2: BetterAuthVanillaAdapter - should expose Better Auth API directly
// =============================================================================
describe('BetterAuthVanillaAdapter type inference', () => {
  const vanillaClient = createClient({
    auth: {
      adapter: BetterAuthVanillaAdapter(),
      url: 'https://auth.example.com',
    },
    dataApi: {
      url: 'https://data-api.example.com/rest/v1',
    },
  });

  it('should have signIn.email method', () => {
    expectTypeOf(vanillaClient.auth.signIn.email).toBeFunction();
  });

  it('should have signUp.email method', () => {
    expectTypeOf(vanillaClient.auth.signUp.email).toBeFunction();
  });

  it('should have getSession method', () => {
    expectTypeOf(vanillaClient.auth.getSession).toBeFunction();
  });

  it('should have signOut method', () => {
    expectTypeOf(vanillaClient.auth.signOut).toBeFunction();
  });
});

// =============================================================================
// Test 3: BetterAuthReactAdapter - should expose Better Auth API with hooks
// =============================================================================
describe('BetterAuthReactAdapter type inference', () => {
  const reactClient = createClient({
    auth: {
      adapter: BetterAuthReactAdapter(),
      url: 'https://auth.example.com',
    },
    dataApi: {
      url: 'https://data-api.example.com/rest/v1',
    },
  });

  it('should have signIn.email method', () => {
    expectTypeOf(reactClient.auth.signIn.email).toBeFunction();
  });

  it('should have signUp.email method', () => {
    expectTypeOf(reactClient.auth.signUp.email).toBeFunction();
  });

  it('should have getSession method', () => {
    expectTypeOf(reactClient.auth.getSession).toBeFunction();
  });

  it('should have useSession hook', () => {
    expectTypeOf(reactClient.auth.useSession).toBeFunction();
  });
});

// =============================================================================
// Test 4: Default adapter (no adapter specified)
// =============================================================================
describe('Default adapter type inference', () => {
  const defaultClient = createClient({
    auth: {
      url: 'https://auth.example.com',
    },
    dataApi: {
      url: 'https://data-api.example.com/rest/v1',
    },
  });

  it('should default to BetterAuthVanillaAdapter API', () => {
    expectTypeOf(defaultClient.auth.signIn.email).toBeFunction();
  });

  it('should have getSession method', () => {
    expectTypeOf(defaultClient.auth.getSession).toBeFunction();
  });
});

// =============================================================================
// Test 5: Database type parameter with adapter inference
// =============================================================================
describe('Database type parameter with adapter inference', () => {
  interface TestDatabase {
    public: {
      Tables: {
        users: {
          Row: { id: number; name: string };
          Insert: { id?: number; name: string };
          Update: { id?: number; name?: string };
        };
      };
      Views: Record<string, never>;
      Functions: Record<string, never>;
    };
  }

  it('should infer SupabaseAuthAdapter API when Database type is provided', () => {
    const typedClient = createClient<TestDatabase>({
      auth: {
        adapter: SupabaseAuthAdapter(),
        url: 'https://auth.example.com',
      },
      dataApi: {
        url: 'https://data-api.example.com/rest/v1',
      },
    });

    expectTypeOf(typedClient.auth.signInWithPassword).toBeFunction();
    expectTypeOf(typedClient.auth.getJWTToken).toBeFunction();
  });

  it('should infer BetterAuthVanillaAdapter API when Database type is provided', () => {
    const typedClient = createClient<TestDatabase>({
      auth: {
        adapter: BetterAuthVanillaAdapter(),
        url: 'https://auth.example.com',
      },
      dataApi: {
        url: 'https://data-api.example.com/rest/v1',
      },
    });

    expectTypeOf(typedClient.auth.signIn.email).toBeFunction();
  });
});
