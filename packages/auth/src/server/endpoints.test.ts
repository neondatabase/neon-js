import { admin } from 'better-auth/plugins/admin';
import { emailOTP } from 'better-auth/plugins/email-otp';
import { jwt } from 'better-auth/plugins/jwt';
import { magicLink } from 'better-auth/plugins/magic-link';
import { organization } from 'better-auth/plugins/organization';
import { phoneNumber } from 'better-auth/plugins/phone-number';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { describe, expect, test } from 'vitest';
import { API_ENDPOINTS, type EndpointConfig } from './endpoints';

type Method = string | readonly string[] | undefined;
interface RouteLike {
  path?: unknown;
  options?: { method?: Method };
}

function isRoute(value: unknown): value is RouteLike & { path: string } {
  return (
    typeof value === 'function' &&
    typeof (value as RouteLike).path === 'string' &&
    typeof (value as RouteLike).options === 'object'
  );
}

function collectRoutes(
  endpoints: Record<string, unknown>,
  into: Map<string, Set<string>>
): void {
  for (const value of Object.values(endpoints)) {
    if (!isRoute(value)) continue;
    const raw = value.options?.method;
    let methods: string[] = [];
    if (Array.isArray(raw)) methods = raw;
    else if (raw) methods = [raw as string];
    const existing = into.get(value.path) ?? new Set<string>();
    for (const m of methods) existing.add(String(m).toUpperCase());
    into.set(value.path, existing);
  }
}

// Neon Auth configures the jwt plugin with this jwksPath.
const NEON_JWKS_PATH = '/.well-known/jwks.json';

const noop = async () => {};
const auth = betterAuth({
  baseURL: 'http://localhost',
  secret: 'test-secret-at-least-32-characters-long!',
  database: memoryAdapter({}),
  emailAndPassword: { enabled: true },
  plugins: [
    admin(),
    organization(),
    emailOTP({ sendVerificationOTP: noop }),
    magicLink({ sendMagicLink: noop }),
    phoneNumber(),
    jwt({ jwks: { jwksPath: NEON_JWKS_PATH } }),
  ],
});

const betterAuthRoutes = new Map<string, Set<string>>();
collectRoutes(auth.api as unknown as Record<string, unknown>, betterAuthRoutes);

// Routes served by Neon Auth that Better Auth does not define.
const NEON_SPECIFIC_ROUTES: Record<string, string[]> = {
  // Anonymous JWT for RLS access; see plugins/anonymous-token.ts.
  '/token/anonymous': ['GET'],
};

function isEndpointConfig(value: unknown): value is EndpointConfig {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as EndpointConfig).path === 'string' &&
    typeof (value as EndpointConfig).method === 'string'
  );
}

function leaves(
  tree: Record<string, unknown>,
  prefix = ''
): Array<[string, EndpointConfig]> {
  return Object.entries(tree).flatMap(([key, value]) => {
    const name = prefix ? `${prefix}.${key}` : key;
    if (isEndpointConfig(value)) return [[name, value] as [string, EndpointConfig]];
    return leaves(value as Record<string, unknown>, name);
  });
}

describe('API_ENDPOINTS matches Better Auth routes', () => {
  const entries = leaves(API_ENDPOINTS as unknown as Record<string, unknown>);

  test('collects a non-trivial set of routes', () => {
    expect(entries.length).toBeGreaterThan(30);
    expect(betterAuthRoutes.size).toBeGreaterThan(80);
  });

  test.each(entries)('%s', (_name, { path, method }) => {
    const fullPath = `/${path}`;
    const methods =
      betterAuthRoutes.get(fullPath) ??
      (NEON_SPECIFIC_ROUTES[fullPath]
        ? new Set(NEON_SPECIFIC_ROUTES[fullPath])
        : undefined);
    expect(methods, `no Better Auth route at ${fullPath}`).toBeDefined();
    expect(
      [...(methods ?? [])],
      `${fullPath} does not accept ${method}`
    ).toContain(method);
  });
});
