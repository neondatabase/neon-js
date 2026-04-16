import { describe, expect, test, vi } from "vitest";

import type { NeonAuthConfig } from "@/server/config";

import { ERRORS } from "@/server/errors";
import { createNeonAuthServer } from "./index";

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

// Mock @tanstack/react-start — tests exercise createNeonAuthServer directly.
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

describe("createNeonAuthServer", () => {
	describe("config validation", () => {
		test("throws when cookies.secret is missing", () => {
			expect(() =>
				createNeonAuthServer({
					baseUrl: "https://auth.example.com",
					cookies: {} as NeonAuthConfig["cookies"],
				}),
			).toThrow(ERRORS.MISSING_COOKIE_SECRET);
		});

		test("throws when cookies.secret is too short", () => {
			expect(() =>
				createNeonAuthServer(createAuthConfig({ secret: "short-secret" })),
			).toThrow("at least 32 characters");
		});

		test("throws when sessionDataTtl is zero", () => {
			expect(() =>
				createNeonAuthServer(createAuthConfig({ sessionDataTtl: 0 })),
			).toThrow("positive number");
		});

		test("throws when sessionDataTtl is negative", () => {
			expect(() =>
				createNeonAuthServer(createAuthConfig({ sessionDataTtl: -5 })),
			).toThrow("positive number");
		});

		test("succeeds for valid config with all fields", async () => {
			const auth = createNeonAuthServer(
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
			const auth = createNeonAuthServer(createAuthConfig());

			const result = await auth.getSession();
			expect(result).toEqual({ data: null, error: null });
		});

		test("accepts cookies.secret with exactly 32 characters", async () => {
			const auth = createNeonAuthServer(
				createAuthConfig({ secret: "x".repeat(32) }),
			);

			const result = await auth.getSession();
			expect(result).toEqual({ data: null, error: null });
		});

		test("accepts cookies.secret with more than 32 characters", async () => {
			const auth = createNeonAuthServer(
				createAuthConfig({ secret: "x".repeat(64) }),
			);

			const result = await auth.getSession();
			expect(result).toEqual({ data: null, error: null });
		});

		test("accepts undefined sessionDataTtl", async () => {
			const auth = createNeonAuthServer(
				createAuthConfig({ sessionDataTtl: undefined }),
			);

			const result = await auth.getSession();
			expect(result).toEqual({ data: null, error: null });
		});

		test("accepts positive sessionDataTtl", async () => {
			const auth = createNeonAuthServer(
				createAuthConfig({ sessionDataTtl: 600 }),
			);

			const result = await auth.getSession();
			expect(result).toEqual({ data: null, error: null });
		});

		test("accepts domain as string", async () => {
			const auth = createNeonAuthServer(
				createAuthConfig({ domain: ".example.com" }),
			);

			const result = await auth.getSession();
			expect(result).toEqual({ data: null, error: null });
		});

		test("accepts undefined domain", async () => {
			const auth = createNeonAuthServer(
				createAuthConfig({ domain: undefined }),
			);

			const result = await auth.getSession();
			expect(result).toEqual({ data: null, error: null });
		});
	});

	describe("return value structure", () => {
		test("returns object with handler as a function", () => {
			const auth = createNeonAuthServer(createAuthConfig());

			expect(typeof auth.handler).toBe("function");
		});

		test("returns object with middleware as a function", () => {
			const auth = createNeonAuthServer(createAuthConfig());

			expect(typeof auth.middleware).toBe("function");
		});

		test("returns object with getSession method", () => {
			const auth = createNeonAuthServer(createAuthConfig());

			expect(typeof auth.getSession).toBe("function");
		});

		test("returns object with protectRoute as a function", () => {
			const auth = createNeonAuthServer(createAuthConfig());

			expect(typeof auth.protectRoute).toBe("function");
		});
	});
});
