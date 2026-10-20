import { describe, expect, it, vi } from 'vitest';
import {
  createUnlinkAccount,
  resolveAccountInfoId,
  toLocalAccountId,
} from './local-account-id';

// Shape of `/list-accounts` items in better-auth 1.7.6 (`listUserAccounts`).
const accounts = [
  {
    id: 'acc_local_1',
    providerId: 'github',
    accountId: '583231',
    userId: 'user_1',
    scopes: ['read:user'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'acc_local_2',
    providerId: 'google',
    accountId: '583231',
    userId: 'user_1',
    scopes: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

describe('toLocalAccountId', () => {
  it('translates a provider-side id to the local account id', () => {
    expect(toLocalAccountId(accounts, '583231', 'google')).toBe('acc_local_2');
  });

  it('uses the first match when no provider is given', () => {
    expect(toLocalAccountId(accounts, '583231')).toBe('acc_local_1');
  });

  it('passes through an id that is already a local id', () => {
    expect(toLocalAccountId(accounts, 'acc_local_2', 'github')).toBe(
      'acc_local_2'
    );
  });

  it('passes through when nothing matches or accounts are not loaded', () => {
    expect(toLocalAccountId(accounts, 'unknown', 'github')).toBe('unknown');
    expect(toLocalAccountId(accounts, '583231', 'gitlab')).toBe('583231');
    expect(toLocalAccountId(undefined, '583231')).toBe('583231');
    expect(toLocalAccountId(accounts)).toBeUndefined();
  });
});

describe('createUnlinkAccount', () => {
  const setup = () => {
    const client = {
      listAccounts: vi.fn().mockResolvedValue(accounts),
      unlinkAccount: vi.fn().mockResolvedValue({ status: true }),
    };
    return { client, unlink: createUnlinkAccount(client) };
  };

  it('sends the local id and no providerId', async () => {
    const { client, unlink } = setup();
    await unlink({ accountId: '583231', providerId: 'google' });
    expect(client.unlinkAccount).toHaveBeenCalledWith({
      accountId: 'acc_local_2',
      fetchOptions: { throw: true },
    });
  });

  it('forwards an already-local id unchanged', async () => {
    const { client, unlink } = setup();
    await unlink({ accountId: 'acc_local_1', providerId: 'github' });
    expect(client.unlinkAccount).toHaveBeenCalledWith({
      accountId: 'acc_local_1',
      fetchOptions: { throw: true },
    });
  });

  it('forwards the original id when there is no match', async () => {
    const { client, unlink } = setup();
    await unlink({ accountId: 'unknown', providerId: 'github' });
    expect(client.unlinkAccount).toHaveBeenCalledWith({
      accountId: 'unknown',
      fetchOptions: { throw: true },
    });
  });
});

describe('resolveAccountInfoId', () => {
  it('is pending until the account list has loaded', () => {
    expect(resolveAccountInfoId(undefined, '583231')).toBe('pending');
    expect(resolveAccountInfoId(null, '583231')).toBe('pending');
  });

  it('returns the local id once loaded', () => {
    expect(resolveAccountInfoId(accounts, '583231')).toBe('acc_local_1');
  });

  it('passes the original id through when loaded without a match', () => {
    expect(resolveAccountInfoId([], '583231')).toBe('583231');
  });
});
