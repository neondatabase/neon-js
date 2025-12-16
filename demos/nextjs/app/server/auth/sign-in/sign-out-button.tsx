'use client';

import { useState } from 'react';
import { signOutAction } from './actions';

export function SignOutButton() {
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    setLoading(true);
    await signOutAction();
    // Will redirect, but if it doesn't:
    setLoading(false);
  };

  return (
    <button
      onClick={handleSignOut}
      disabled={loading}
      className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 dark:bg-red-500 dark:hover:bg-red-600"
    >
      {loading ? 'Signing out...' : 'Sign Out'}
    </button>
  );
}

