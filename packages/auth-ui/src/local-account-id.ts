/**
 * Subset of a Better Auth `/list-accounts` item. `id` is the local account row
 * id; `accountId` is the id issued by the provider.
 */
export type ListedAccount = {
  id: string;
  accountId: string;
  providerId: string;
};

/**
 * Better Auth 1.7 selects identities by the local `account.id`, but
 * better-auth-ui still passes the provider-side `accountId`. Ids that already
 * match a local id, and ids with no match, pass through unchanged so the server
 * reports its own error rather than the UI guessing.
 *
 * `providerId` narrows the match because different providers can issue the
 * same account id.
 */
export function toLocalAccountId(
  accounts: readonly ListedAccount[] | null | undefined,
  accountId?: string,
  providerId?: string
): string | undefined {
  if (!accounts || !accountId) return accountId;
  if (accounts.some((account) => account.id === accountId)) return accountId;
  const match = accounts.find(
    (account) =>
      account.accountId === accountId &&
      (providerId === undefined || account.providerId === providerId)
  );
  return match?.id ?? accountId;
}

/**
 * Decides which id an account-info lookup should use. Until the account list
 * has loaded the local id is unknown, and querying with the provider-side id
 * would fail with ACCOUNT_NOT_FOUND and raise an error toast.
 */
export function resolveAccountInfoId(
  accounts: readonly ListedAccount[] | null | undefined,
  accountId?: string
): 'pending' | string | undefined {
  if (!accounts) return 'pending';
  return toLocalAccountId(accounts, accountId);
}

type UnlinkClient = {
  listAccounts: (options: {
    fetchOptions: { throw: true };
  }) => Promise<readonly ListedAccount[]>;
  unlinkAccount: (params: {
    accountId?: string;
    fetchOptions: { throw: true };
  }) => Promise<unknown>;
};

/** Sends the 1.7 unlink payload: the local `account.id` only, no `providerId`. */
export function createUnlinkAccount(client: UnlinkClient) {
  return async ({
    accountId,
    providerId,
  }: {
    accountId?: string;
    providerId: string;
  }) => {
    const accounts = await client.listAccounts({
      fetchOptions: { throw: true },
    });
    return client.unlinkAccount({
      accountId: toLocalAccountId(accounts, accountId, providerId),
      fetchOptions: { throw: true },
    });
  };
}
