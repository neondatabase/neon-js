/**
 * Type tests for createClient
 * Run with: npx tsc --noEmit
 *
 * These tests verify that TypeScript correctly infers types based on the adapter.
 */

import { createClient } from '../client/client-factory';
import {
  SupabaseAuthAdapter,
  BetterAuthVanillaAdapter,
  BetterAuthReactAdapter,
} from '@neondatabase/neon-auth';

// =============================================================================
// Test 1: SupabaseAuthAdapter - should infer SupabaseAuthAdapter methods on client.auth
// =============================================================================
const supabaseClient = createClient({
  auth: {
    adapter: SupabaseAuthAdapter,
    url: 'https://auth.example.com',
  },
  dataApi: {
    url: 'https://data-api.example.com/rest/v1',
  },
});

// These should all type-check correctly:
async function testSupabaseAuth() {
  // getSession exists on SupabaseAuthAdapter
  const session = await supabaseClient.auth.getSession();
  const jwt = await supabaseClient.auth.getJWTToken();

  // Type assertions to verify correct types
  session satisfies Awaited<ReturnType<typeof supabaseClient.auth.getSession>>;
  jwt satisfies string | null;
}

// =============================================================================
// Test 2: BetterAuthVanillaAdapter - should expose Better Auth API directly
// =============================================================================
const vanillaClient = createClient({
  auth: {
    adapter: BetterAuthVanillaAdapter,
    url: 'https://auth.example.com',
  },
  dataApi: {
    url: 'https://data-api.example.com/rest/v1',
  },
});

async function testVanillaAuth() {
  // Direct Better Auth API access (no getBetterAuthInstance() needed!)
  await vanillaClient.auth.signIn.email({
    email: 'test@example.com',
    password: 'password',
  });
  await vanillaClient.auth.signUp.email({
    email: 'test@example.com',
    password: 'password',
    name: 'Test User',
  });
  const session = await vanillaClient.auth.getSession();

  // Type assertion
  session satisfies Awaited<ReturnType<typeof vanillaClient.auth.getSession>>;
}

// =============================================================================
// Test 3: BetterAuthReactAdapter - should expose Better Auth API directly
// =============================================================================
const reactClient = createClient({
  auth: {
    adapter: BetterAuthReactAdapter,
    url: 'https://auth.example.com',
  },
  dataApi: {
    url: 'https://data-api.example.com/rest/v1',
  },
});

async function testReactAuth() {
  // Direct Better Auth API access (no getBetterAuthInstance() needed!)
  await reactClient.auth.signIn.email({
    email: 'test@example.com',
    password: 'password',
  });
  await reactClient.auth.signUp.email({
    email: 'test@example.com',
    password: 'password',
    name: 'Test User',
  });
  const session = await reactClient.auth.getSession();

  // Type assertion
  session satisfies Awaited<ReturnType<typeof reactClient.auth.getSession>>;

  // React hooks should also be available
  // Note: useSession is a React hook, can only check type exists
  reactClient.auth.useSession satisfies () => unknown;
}

// =============================================================================
// Test 4: Auth options should be correctly inferred from adapter
// =============================================================================

// This should accept SupabaseAuthAdapterOptions (minus baseURL)
const _clientWithOptions = createClient({
  auth: {
    adapter: SupabaseAuthAdapter,
    url: 'https://auth.example.com',
    options: {
      // These should be valid BetterAuthClientOptions (minus plugins and baseURL)
      fetchOptions: {
        credentials: 'include',
      },
    },
  },
  dataApi: {
    url: 'https://data-api.example.com/rest/v1',
  },
});

// =============================================================================
// Test 5: Verify type narrowing - client.auth should be the correct adapter type
// =============================================================================

import type { NeonAuth } from '@neondatabase/neon-auth';

// Verify the auth types are correctly inferred
type ExpectedSupabaseAuthType = NeonAuth<SupabaseAuthAdapter>;
type ExpectedVanillaAuthType = NeonAuth<BetterAuthVanillaAdapter>;
type ExpectedReactAuthType = NeonAuth<BetterAuthReactAdapter>;

// These should pass - proving type inference works
type _TestSupabaseAuth =
  typeof supabaseClient.auth extends ExpectedSupabaseAuthType ? true : false;
type _TestVanillaAuth =
  typeof vanillaClient.auth extends ExpectedVanillaAuthType ? true : false;
type _TestReactAuth = typeof reactClient.auth extends ExpectedReactAuthType
  ? true
  : false;

// Compile-time assertion: if inference fails, this will error
const _assertSupabaseAuth: ExpectedSupabaseAuthType = supabaseClient.auth;
const _assertVanillaAuth: ExpectedVanillaAuthType = vanillaClient.auth;
const _assertReactAuth: ExpectedReactAuthType = reactClient.auth;

// =============================================================================
// Test 6: Verify adapter property is accessible
// =============================================================================

function testAdapterAccess() {
  // adapter property should exist and be correctly typed
  const supabaseAdapterInstance = supabaseClient.auth;
  const vanillaAdapterInstance = vanillaClient.auth;
  const reactAdapterInstance = reactClient.auth;

  supabaseAdapterInstance satisfies SupabaseAuthAdapter;
  vanillaAdapterInstance satisfies ReturnType<
    BetterAuthVanillaAdapter['getBetterAuthInstance']
  >;
  reactAdapterInstance satisfies ReturnType<
    BetterAuthReactAdapter['getBetterAuthInstance']
  >;
}

// =============================================================================
// Test 7: Options type inference - should error on invalid options
// =============================================================================

// Uncomment to verify type error:
// const _invalidOptions = createClient({
//   auth: {
//     adapter: SupabaseAuthAdapter,
//     url: 'https://auth.example.com',
//     options: {
//       invalidOption: true, // Should error - not a valid option
//     },
//   },
//   dataApi: {
//     url: 'https://data-api.example.com/rest/v1',
//   },
// });

// =============================================================================
// Test 8: Partial type inference - Database type explicit, adapter inferred
// =============================================================================

// Define a sample Database type
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

// This is the NEW capability: provide Database type, infer adapter from config
const typedSupabaseClient = createClient<TestDatabase>({
  auth: {
    adapter: SupabaseAuthAdapter,
    url: 'https://auth.example.com',
  },
  dataApi: {
    url: 'https://data-api.example.com/rest/v1',
  },
});

const typedVanillaClient = createClient<TestDatabase>({
  auth: {
    adapter: BetterAuthVanillaAdapter,
    url: 'https://auth.example.com',
  },
  dataApi: {
    url: 'https://data-api.example.com/rest/v1',
  },
});

// Verify auth is correctly typed (adapter inferred from config)
const _assertTypedSupabaseAuth: ExpectedSupabaseAuthType =
  typedSupabaseClient.auth;
const _assertTypedVanillaAuth: ExpectedVanillaAuthType =
  typedVanillaClient.auth;

// =============================================================================
// Export to prevent "unused" warnings and ensure tests are run
// =============================================================================
export {
  testSupabaseAuth,
  testVanillaAuth,
  testReactAuth,
  testAdapterAccess,
  supabaseClient,
  vanillaClient,
  reactClient,
  typedSupabaseClient,
  typedVanillaClient,
};
