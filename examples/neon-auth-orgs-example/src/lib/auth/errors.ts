/**
 * Standard error shape returned by Neon Auth (better-auth) SDK methods.
 *
 * Every `authClient.organization.*` call returns
 * `{ data, error }` where `error` matches this shape.
 *
 * Error codes are defined in better-auth's
 * `plugins/organization/error-codes` module.
 */
export interface NeonAuthError {
  code?: string;
  message?: string;
}

/**
 * Type guard – returns true when the value looks like a Neon Auth error
 * (has at least a `code` or `message` string property).
 */
export function isNeonAuthError(value: unknown): value is NeonAuthError {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.code === "string" || typeof v.message === "string";
}

/**
 * Extract a NeonAuthError from a caught exception.
 *
 * `BetterFetchError` (thrown when `throw: true` or in catch blocks) stores the
 * response body in its `.error` property. This helper normalises both shapes.
 */
export function toNeonAuthError(err: unknown): NeonAuthError | null {
  if (isNeonAuthError(err)) return err;
  if (
    typeof err === "object" &&
    err !== null &&
    "error" in err &&
    isNeonAuthError((err as { error: unknown }).error)
  ) {
    return (err as { error: NeonAuthError }).error;
  }
  return null;
}
