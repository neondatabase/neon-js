import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { createAuthClient } from "./neon-auth";
import { createAuthClient as createNextAuthClient } from "./next";
import { SupabaseAuthAdapter } from "./adapters/supabase/supabase-adapter";
import { BETTER_AUTH_METHODS_CACHE } from "./core/better-auth-methods";

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

  test("vanilla client signIn.email rejects with a status", async () => {
    const auth = createAuthClient(URL_);
    await expect(auth.signIn.email(credentials)).rejects.toMatchObject({
      status: 401,
    });
  });

  test("Next.js (React adapter) client signIn.email rejects with a status", async () => {
    const auth = createNextAuthClient();
    await expect(auth.signIn.email(credentials)).rejects.toMatchObject({
      status: 401,
    });
  });

  test("Supabase adapter signInWithPassword resolves with { error }", async () => {
    const auth = createAuthClient(URL_, { adapter: SupabaseAuthAdapter() });
    const result = await auth.signInWithPassword(credentials);
    expect(result.data.user).toBeNull();
    expect(result.error).toMatchObject({ status: 401 });
  });
});
