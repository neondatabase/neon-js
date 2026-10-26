import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { createAuthClient } from "./neon-auth";
import { createAuthClient as createNextAuthClient } from "./next";
import { SupabaseAuthAdapter } from "./adapters/supabase/supabase-adapter";
import { BETTER_AUTH_METHODS_CACHE } from "./core/better-auth-methods";
import { AuthApiError } from "./adapters/supabase/auth-interface";

const URL_ = "https://auth.example.com";

describe("client error contract", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn(async () =>
      Response.json(
        {
          message: "Invalid email or password",
          code: "INVALID_EMAIL_OR_PASSWORD",
        },
        { status: 401, statusText: "Unauthorized" },
      ),
    ) as unknown as typeof globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    BETTER_AUTH_METHODS_CACHE.clearSessionCache();
  });

  const credentials = { email: "a@b.c", password: "wrong-password" };

  // INVALID_EMAIL_OR_PASSWORD maps to InvalidCredentials in BETTER_AUTH_ERROR_MAP,
  // so the rejection carries the normalized snake_case code, not the raw server code.
  async function expectInvalidCredentialsRejection(call: Promise<unknown>) {
    const err = await call.then(
      () => {
        throw new Error("expected the call to reject");
      },
      (error: unknown) => error,
    );
    expect(err).toBeInstanceOf(AuthApiError);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBeTruthy();
    expect(err).toMatchObject({
      status: 401,
      code: "invalid_credentials",
    });
  }

  test("vanilla client signIn.email rejects with a normalized AuthApiError", async () => {
    const auth = createAuthClient(URL_);
    await expectInvalidCredentialsRejection(auth.signIn.email(credentials));
  });

  test("Next.js (React adapter) client signIn.email rejects with a normalized AuthApiError", async () => {
    const auth = createNextAuthClient();
    await expectInvalidCredentialsRejection(auth.signIn.email(credentials));
  });

  test("Supabase adapter signInWithPassword resolves with { error }", async () => {
    const auth = createAuthClient(URL_, { adapter: SupabaseAuthAdapter() });
    const result = await auth.signInWithPassword(credentials);
    expect(result.data.user).toBeNull();
    expect(result.error).toMatchObject({ status: 401 });
  });
});
