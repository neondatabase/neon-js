'use client';

import { useState } from 'react';
import { getAccountInfo } from './actions';

interface Account {
  id: string;
  providerId: string;
  accountId: string;
}

interface AccountInfoDisplay {
  provider: string;
  accountId: string;
  createdAt?: string;
  scopes?: string[];
}

const CREDENTIAL_PROVIDERS = ['credential', 'email', 'password'];

function isCredentialProvider(providerId: string) {
  return CREDENTIAL_PROVIDERS.includes(providerId.toLowerCase());
}

export function LinkedAccountsSection({ accounts }: { accounts: Account[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [accountInfo, setAccountInfo] = useState<AccountInfoDisplay | { error: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleToggle = async (account: Account) => {
    if (expandedId === account.id) {
      setExpandedId(null);
      setAccountInfo(null);
      return;
    }

    setExpandedId(account.id);

    // Don't fetch for credential-based accounts
    if (isCredentialProvider(account.providerId)) {
      setAccountInfo(null);
      return;
    }

    setLoading(true);
    setAccountInfo(null);

    const result = await getAccountInfo(account.accountId);
    
    if (result.success && result.data) {
      setAccountInfo(result.data as AccountInfoDisplay);
    } else {
      setAccountInfo({ error: result.error || 'Failed to fetch account info' });
    }
    
    setLoading(false);
  };

  if (!accounts || accounts.length === 0) {
    return <p className="text-sm text-zinc-500">No linked accounts</p>;
  }

  return (
    <div className="space-y-2">
      {accounts.map((account) => {
        const isCredential = isCredentialProvider(account.providerId);
        const isExpanded = expandedId === account.id;

        return (
          <div key={account.id} className="overflow-hidden rounded-md bg-zinc-50 dark:bg-zinc-800">
            <button
              onClick={() => handleToggle(account)}
              disabled={isCredential}
              className={`flex w-full items-center justify-between p-3 text-left transition-colors ${
                isCredential
                  ? 'cursor-default'
                  : 'hover:bg-zinc-100 dark:hover:bg-zinc-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="font-medium capitalize text-zinc-900 dark:text-zinc-100">
                  {account.providerId}
                </span>
                {isCredential ? (
                  <span className="text-xs text-zinc-400">
                    (password-based)
                  </span>
                ) : (
                  <code className="text-xs text-zinc-500">
                    {account.accountId.slice(0, 12)}...
                  </code>
                )}
              </div>
              {!isCredential && (
                <svg
                  className={`h-4 w-4 text-zinc-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </button>
            
            {isExpanded && !isCredential && (
              <div className="border-t border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
                {loading ? (
                  <div className="flex items-center gap-2 text-sm text-zinc-500">
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Loading...
                  </div>
                ) : accountInfo && 'error' in accountInfo ? (
                  <p className="text-sm text-red-600 dark:text-red-400">{accountInfo.error}</p>
                ) : accountInfo ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex gap-3">
                      <span className="w-20 shrink-0 text-zinc-500">Provider</span>
                      <span className="capitalize text-zinc-900 dark:text-zinc-100">
                        {accountInfo.provider}
                      </span>
                    </div>
                    <div className="flex gap-3">
                      <span className="w-20 shrink-0 text-zinc-500">Account</span>
                      <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">
                        {accountInfo.accountId}
                      </code>
                    </div>
                    {accountInfo.createdAt && (
                      <div className="flex gap-3">
                        <span className="w-20 shrink-0 text-zinc-500">Linked</span>
                        <span className="text-zinc-900 dark:text-zinc-100">
                          {new Date(accountInfo.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    {accountInfo.scopes && accountInfo.scopes.length > 0 && (
                      <div className="flex gap-3">
                        <span className="w-20 shrink-0 text-zinc-500">Scopes</span>
                        <div className="flex flex-wrap gap-1">
                          {accountInfo.scopes.map((scope) => (
                            <span
                              key={scope}
                              className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                            >
                              {scope}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
