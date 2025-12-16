'use client';

import { useState } from 'react';
import { cancelInvitation } from './actions';

interface InvitationActionsProps {
  invitationId: string;
  organizationSlug: string;
}

export function InvitationActions({ invitationId, organizationSlug }: InvitationActionsProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this invitation?')) return;

    setLoading(true);
    setMessage(null);
    const result = await cancelInvitation(invitationId, organizationSlug);
    setLoading(false);

    if (result.success) {
      setMessage({ type: 'success', text: result.message });
    } else {
      setMessage({ type: 'error', text: result.message });
    }
  };

  return (
    <div className="flex items-center gap-2">
      {message && (
        <span className={`text-xs ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
          {message.text}
        </span>
      )}
      <button
        onClick={handleCancel}
        disabled={loading}
        className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/30"
      >
        {loading ? 'Cancelling...' : 'Cancel'}
      </button>
    </div>
  );
}

