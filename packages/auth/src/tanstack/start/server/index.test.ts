import { describe, test, expect, vi } from 'vitest';
import type { NeonAuthConfig } from '../../../server/config';
import { ERRORS } from '../../../server/errors';
import { createNeonAuth } from './index';

vi.mock('../../../server', () => ({
	createAuthServerInternal: vi.fn(() => ({
		getSession: vi.fn().mockResolvedValue({ data: null, error: null }),
	})),
}));

vi.mock('./adapter', () => ({
	createTanStackStartRequestContext: vi.fn(),
}));

vi.mock('./protect-route', () => ({
	protectRoute: vi.fn(),
}));

vi.mock('@tanstack/react-start/server', () => ({
	getRequest: vi.fn(),
	setCookie: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
	redirect: vi.fn(),
}));

const createAuthConfig = (
	overrides?: Partial<NeonAuthConfig['cookies']>,
): NeonAuthConfig => ({
	baseUrl: 'https://auth.example.com',
	cookies: {
		secret: 'x'.repeat(32),
		...overrides,
	},
});

describe('deferred config resolution', () => {
	test('does not invoke config callback at creation time', () => {
		const getConfig = vi.fn(() => createAuthConfig());
		createNeonAuth(getConfig);

		expect(getConfig).not.toHaveBeenCalled();
	});

	test('invokes config callback on first property access', async () => {
		const getConfig = vi.fn(() => createAuthConfig());
		const auth = createNeonAuth(getConfig);

		await auth.getSession();

		expect(getConfig).toHaveBeenCalledOnce();
	});

	test('caches config across multiple calls', async () => {
		const getConfig = vi.fn(() => createAuthConfig());
		const auth = createNeonAuth(getConfig);

		await auth.getSession();
		await auth.getSession();
		await auth.getSession();

		expect(getConfig).toHaveBeenCalledOnce();
	});

	test('uses same config for server methods and handler', async () => {
		const getConfig = vi.fn(() => createAuthConfig());
		const auth = createNeonAuth(getConfig);

		await auth.getSession();
		auth.handler();

		expect(getConfig).toHaveBeenCalledOnce();
	});
});

describe('config validation (deferred)', () => {
	test('does not validate at creation time', () => {
		expect(() =>
			createNeonAuth(() => ({
				baseUrl: 'https://auth.example.com',
				cookies: {} as NeonAuthConfig['cookies'],
			})),
		).not.toThrow();
	});

	test('throws on first use when cookies.secret is missing', () => {
		const auth = createNeonAuth(() => ({
			baseUrl: 'https://auth.example.com',
			cookies: {} as NeonAuthConfig['cookies'],
		}));

		expect(() => auth.getSession()).toThrow(ERRORS.MISSING_COOKIE_SECRET);
	});

	test('throws on first use when cookies.secret is too short', () => {
		const auth = createNeonAuth(() =>
			createAuthConfig({ secret: 'short-secret' }),
		);

		expect(() => auth.getSession()).toThrow('at least 32 characters');
	});

	test('throws on first use when sessionDataTtl is zero', () => {
		const auth = createNeonAuth(() =>
			createAuthConfig({ sessionDataTtl: 0 }),
		);

		expect(() => auth.getSession()).toThrow('positive number');
	});

	test('throws on first use when sessionDataTtl is negative', () => {
		const auth = createNeonAuth(() =>
			createAuthConfig({ sessionDataTtl: -5 }),
		);

		expect(() => auth.getSession()).toThrow('positive number');
	});

	test('succeeds for valid config with all fields', async () => {
		const auth = createNeonAuth(() =>
			createAuthConfig({
				secret: 'x'.repeat(32),
				sessionDataTtl: 300,
				domain: '.example.com',
			}),
		);

		const result = await auth.getSession();
		expect(result).toEqual({ data: null, error: null });
	});

	test('succeeds for valid config with minimal fields', async () => {
		const auth = createNeonAuth(() => createAuthConfig());

		const result = await auth.getSession();
		expect(result).toEqual({ data: null, error: null });
	});

	test('accepts cookies.secret with exactly 32 characters', async () => {
		const auth = createNeonAuth(() =>
			createAuthConfig({ secret: 'x'.repeat(32) }),
		);

		const result = await auth.getSession();
		expect(result).toEqual({ data: null, error: null });
	});

	test('accepts cookies.secret with more than 32 characters', async () => {
		const auth = createNeonAuth(() =>
			createAuthConfig({ secret: 'x'.repeat(64) }),
		);

		const result = await auth.getSession();
		expect(result).toEqual({ data: null, error: null });
	});

	test('accepts undefined sessionDataTtl', async () => {
		const auth = createNeonAuth(() =>
			createAuthConfig({ sessionDataTtl: undefined }),
		);

		const result = await auth.getSession();
		expect(result).toEqual({ data: null, error: null });
	});

	test('accepts positive sessionDataTtl', async () => {
		const auth = createNeonAuth(() =>
			createAuthConfig({ sessionDataTtl: 600 }),
		);

		const result = await auth.getSession();
		expect(result).toEqual({ data: null, error: null });
	});

	test('accepts domain as string', async () => {
		const auth = createNeonAuth(() =>
			createAuthConfig({ domain: '.example.com' }),
		);

		const result = await auth.getSession();
		expect(result).toEqual({ data: null, error: null });
	});

	test('accepts undefined domain', async () => {
		const auth = createNeonAuth(() =>
			createAuthConfig({ domain: undefined }),
		);

		const result = await auth.getSession();
		expect(result).toEqual({ data: null, error: null });
	});
});

describe('return value structure', () => {
	test('returns object with handler method', () => {
		const auth = createNeonAuth(() => createAuthConfig());

		expect(typeof auth.handler).toBe('function');
	});

	test('returns object with protectRoute method', () => {
		const auth = createNeonAuth(() => createAuthConfig());

		expect(typeof auth.protectRoute).toBe('function');
	});

	test('returns object with getSession method', () => {
		const auth = createNeonAuth(() => createAuthConfig());

		expect(typeof auth.getSession).toBe('function');
	});

	test('handler is accessible via property check', () => {
		const auth = createNeonAuth(() => createAuthConfig());

		expect('handler' in auth).toBe(true);
	});

	test('protectRoute is accessible via property check', () => {
		const auth = createNeonAuth(() => createAuthConfig());

		expect('protectRoute' in auth).toBe(true);
	});
});
