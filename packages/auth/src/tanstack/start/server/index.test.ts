import { describe, expect, test, vi } from "vitest";

import type { NeonAuthConfig } from "@/server/config";
import { ERRORS } from "@/server/errors";

import { createNeonAuth } from "./index";

// Mock createAuthServerInternal to avoid actual network calls
vi.mock("@/server", () => ({
	createAuthServerInternal: vi.fn(() => ({
		getSession: vi.fn().mockResolvedValue({ data: null, error: null }),
	})),
}));

// Mock the adapter to avoid importing @tanstack/react-start/server
vi.mock("./adapter", () => ({
	createTanStackStartRequestContext: vi.fn(),
}));

// Mock createMiddleware to avoid importing @tanstack/react-start
vi.mock("@tanstack/react-start", () => ({
	createMiddleware: vi.fn(() => ({
		server: vi.fn((fn) => fn),
	})),
}));

const createAuthConfig = (
	overrides?: Partial<NeonAuthConfig["cookies"]>,
): NeonAuthConfig => ({
	baseUrl: "https://auth.example.com",
	cookies: {
		secret: "x".repeat(32),
		...overrides,
	},
});

describe("createNeonAuth", () => {
	describe("deferred config resolution", () => {
		test("does not invoke config callback at creation time", () => {
			const getConfig = vi.fn(() => createAuthConfig());
			createNeonAuth(getConfig);

			expect(getConfig).not.toHaveBeenCalled();
		});

		test("invokes config callback on first getSession call", async () => {
			const getConfig = vi.fn(() => createAuthConfig());
			const auth = createNeonAuth(getConfig);

			await auth.getSession();

			expect(getConfig).toHaveBeenCalledOnce();
		});

		test("caches the server instance across multiple getSession calls", async () => {
			const getConfig = vi.fn(() => createAuthConfig());
			const auth = createNeonAuth(getConfig);

			await auth.getSession();
			await auth.getSession();
			await auth.getSession();

			expect(getConfig).toHaveBeenCalledOnce();
		});
	});

	describe("config validation (deferred)", () => {
		test("does not validate at creation time", () => {
			// Invalid config — but no throw because it's deferred
			expect(() =>
				createNeonAuth(() => ({
					baseUrl: "https://auth.example.com",
					cookies: {} as NeonAuthConfig["cookies"],
				})),
			).not.toThrow();
		});

		test("throws on first use when cookies.secret is missing", () => {
			const auth = createNeonAuth(() => ({
				baseUrl: "https://auth.example.com",
				cookies: {} as NeonAuthConfig["cookies"],
			}));

			expect(() => auth.getSession()).toThrow(ERRORS.MISSING_COOKIE_SECRET);
		});

		test("throws on first use when cookies.secret is too short", () => {
			const auth = createNeonAuth(() =>
				createAuthConfig({ secret: "short-secret" }),
			);

			expect(() => auth.getSession()).toThrow("at least 32 characters");
		});

		test("throws on first use when sessionDataTtl is zero", () => {
			const auth = createNeonAuth(() =>
				createAuthConfig({ sessionDataTtl: 0 }),
			);

			expect(() => auth.getSession()).toThrow("positive number");
		});

		test("throws on first use when sessionDataTtl is negative", () => {
			const auth = createNeonAuth(() =>
				createAuthConfig({ sessionDataTtl: -5 }),
			);

			expect(() => auth.getSession()).toThrow("positive number");
		});

		test("succeeds for valid config with all fields", async () => {
			const auth = createNeonAuth(() =>
				createAuthConfig({
					secret: "x".repeat(32),
					sessionDataTtl: 300,
					domain: ".example.com",
				}),
			);

			const result = await auth.getSession();
			expect(result).toEqual({ data: null, error: null });
		});

		test("succeeds for valid config with minimal fields", async () => {
			const auth = createNeonAuth(() => createAuthConfig());

			const result = await auth.getSession();
			expect(result).toEqual({ data: null, error: null });
		});

		test("accepts cookies.secret with exactly 32 characters", async () => {
			const auth = createNeonAuth(() =>
				createAuthConfig({ secret: "x".repeat(32) }),
			);

			const result = await auth.getSession();
			expect(result).toEqual({ data: null, error: null });
		});

		test("accepts cookies.secret with more than 32 characters", async () => {
			const auth = createNeonAuth(() =>
				createAuthConfig({ secret: "x".repeat(64) }),
			);

			const result = await auth.getSession();
			expect(result).toEqual({ data: null, error: null });
		});

		test("accepts undefined sessionDataTtl", async () => {
			const auth = createNeonAuth(() =>
				createAuthConfig({ sessionDataTtl: undefined }),
			);

			const result = await auth.getSession();
			expect(result).toEqual({ data: null, error: null });
		});

		test("accepts positive sessionDataTtl", async () => {
			const auth = createNeonAuth(() =>
				createAuthConfig({ sessionDataTtl: 600 }),
			);

			const result = await auth.getSession();
			expect(result).toEqual({ data: null, error: null });
		});

		test("accepts domain as string", async () => {
			const auth = createNeonAuth(() =>
				createAuthConfig({ domain: ".example.com" }),
			);

			const result = await auth.getSession();
			expect(result).toEqual({ data: null, error: null });
		});

		test("accepts undefined domain", async () => {
			const auth = createNeonAuth(() =>
				createAuthConfig({ domain: undefined }),
			);

			const result = await auth.getSession();
			expect(result).toEqual({ data: null, error: null });
		});
	});
	
	describe("return value structure", () => {
		test("returns object with handler as a function", () => {
			const auth = createNeonAuth(() => createAuthConfig());

			expect(typeof auth.handler).toBe("function");
		});

		test("returns object with middleware", () => {
			const auth = createNeonAuth(() => createAuthConfig());

			expect(auth.middleware).toBeDefined();
		});

		test("returns object with getSession method", () => {
			const auth = createNeonAuth(() => createAuthConfig());

			expect(typeof auth.getSession).toBe("function");
		});

		test("returns object with protectRoute as a function", () => {
			const auth = createNeonAuth(() => createAuthConfig());

			expect(typeof auth.protectRoute).toBe("function");
		});
	});
});
