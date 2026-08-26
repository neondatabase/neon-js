import { createAuthClient } from '@neondatabase/auth/nuxt';

export const authClient = createAuthClient();

export function useAuthSession() {
  const state = authClient.useSession();

  return {
    data: computed(() => state.value.data),
    error: computed(() => state.value.error),
    isPending: computed(() => state.value.isPending),
    isRefetching: computed(() => state.value.isRefetching),
    refetch: state.value.refetch,
  };
}

export function authErrorMessage(value: unknown, fallback: string): string {
  if (
    value &&
    typeof value === 'object' &&
    'error' in value &&
    value.error &&
    typeof value.error === 'object' &&
    'message' in value.error &&
    typeof value.error.message === 'string'
  ) {
    return value.error.message;
  }

  if (value instanceof Error) return value.message;
  return fallback;
}

export function throwIfAuthError(
  result: { error?: { message?: string } | null } | undefined,
  fallback: string,
) {
  if (result?.error) {
    throw new Error(result.error.message || fallback);
  }
}
