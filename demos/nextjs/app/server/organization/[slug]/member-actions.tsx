'use client';

import { useState } from 'react';
import { removeMember, updateMemberRole } from './actions';

interface MemberActionsProps {
  organizationId: string;
  memberId: string;
  memberUserId: string;
  currentRole: string;
  isOwner: boolean;
  organizationSlug: string;
}

export function MemberActions({
  organizationId,
  memberId,
  memberUserId,
  currentRole,
  isOwner,
  organizationSlug,
}: MemberActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleRemove = async () => {
    if (!confirm('Are you sure you want to remove this member?')) return;

    setLoading('remove');
    setMessage(null);
    const result = await removeMember(organizationId, memberUserId, organizationSlug);
    setLoading(null);

    if (result.success) {
      setMessage({ type: 'success', text: result.message });
      setIsOpen(false);
    } else {
      setMessage({ type: 'error', text: result.message });
    }
  };

  const handleRoleChange = async (newRole: 'admin' | 'member') => {
    setLoading(newRole);
    setMessage(null);
    const result = await updateMemberRole(organizationId, memberId, newRole, organizationSlug);
    setLoading(null);

    if (result.success) {
      setMessage({ type: 'success', text: result.message });
      setIsOpen(false);
    } else {
      setMessage({ type: 'error', text: result.message });
    }
  };

  // Only owners can change roles or remove members
  // Admins can only remove members (not other admins)
  const canChangeRole = isOwner && currentRole !== 'owner';
  const canRemove = isOwner || (currentRole === 'member');

  if (!canChangeRole && !canRemove) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 z-20 mt-1 w-48 rounded-md bg-white py-1 shadow-lg ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700">
            {message && (
              <div className={`px-3 py-2 text-xs ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                {message.text}
              </div>
            )}

            {canChangeRole && currentRole !== 'admin' && (
              <button
                onClick={() => handleRoleChange('admin')}
                disabled={loading === 'admin'}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                <svg className="h-4 w-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
                {loading === 'admin' ? 'Promoting...' : 'Make Admin'}
              </button>
            )}

            {canChangeRole && currentRole === 'admin' && (
              <button
                onClick={() => handleRoleChange('member')}
                disabled={loading === 'member'}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                <svg className="h-4 w-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
                {loading === 'member' ? 'Demoting...' : 'Make Member'}
              </button>
            )}

            {canRemove && (
              <button
                onClick={handleRemove}
                disabled={loading === 'remove'}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/30"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                {loading === 'remove' ? 'Removing...' : 'Remove'}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

