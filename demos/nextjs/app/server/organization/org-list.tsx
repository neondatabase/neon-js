'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  leaveOrganization,
  deleteOrganization,
  updateOrganization,
  getOrganizationDetails,
} from './actions';

interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
}

interface OrgDetails {
  memberCount: number;
  members: Array<{
    id: string;
    userId: string;
    role: string;
  }>;
}

export function OrganizationList({
  organizations,
  currentUserId,
}: {
  organizations: Organization[];
  currentUserId: string;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [details, setDetails] = useState<OrgDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleToggle = async (org: Organization) => {
    if (expandedId === org.id) {
      setExpandedId(null);
      setDetails(null);
      setEditMode(null);
      return;
    }

    setExpandedId(org.id);
    setLoading(true);
    setDetails(null);
    setEditMode(null);
    setMessage(null);

    const result = await getOrganizationDetails(org.id);

    if (result.success && result.data) {
      setDetails({
        memberCount: result.data.memberCount || 0,
        members: Array.isArray(result.data.members) ? result.data.members : [],
      });
    }

    setLoading(false);
  };

  const handleLeave = async (orgId: string) => {
    setActionLoading('leave');
    setMessage(null);
    const result = await leaveOrganization(orgId);
    setActionLoading(null);

    if (result.success) {
      setMessage({ type: 'success', text: result.message });
    } else {
      setMessage({ type: 'error', text: result.message });
    }
  };

  const handleDelete = async (orgId: string) => {
    if (!confirm('Are you sure you want to delete this organization?')) return;

    setActionLoading('delete');
    setMessage(null);
    const result = await deleteOrganization(orgId);
    setActionLoading(null);

    if (result.success) {
      setMessage({ type: 'success', text: result.message });
    } else {
      setMessage({ type: 'error', text: result.message });
    }
  };

  const handleStartEdit = (org: Organization) => {
    setEditMode(org.id);
    setEditName(org.name);
    setEditSlug(org.slug);
    setMessage(null);
  };

  const handleCancelEdit = () => {
    setEditMode(null);
    setEditName('');
    setEditSlug('');
  };

  const handleSaveEdit = async (orgId: string) => {
    setActionLoading('edit');
    setMessage(null);

    const result = await updateOrganization(orgId, {
      name: editName,
      slug: editSlug,
    });

    setActionLoading(null);

    if (result.success) {
      setMessage({ type: 'success', text: result.message });
      setEditMode(null);
    } else {
      setMessage({ type: 'error', text: result.message });
    }
  };

  const getUserRole = (members: OrgDetails['members'] | undefined | null) => {
    if (!Array.isArray(members)) return null;
    const member = members.find((m) => m.userId === currentUserId);
    return member?.role || null;
  };

  if (!organizations || organizations.length === 0) {
    return <p className="text-sm text-zinc-500">No organizations yet</p>;
  }

  return (
    <div className="space-y-2">
      {organizations.map((org) => {
        const isExpanded = expandedId === org.id;
        const userRole = details && isExpanded ? getUserRole(details.members) : null;
        const isOwner = userRole === 'owner';
        const isAdmin = userRole === 'admin';
        const canEdit = isOwner || isAdmin;
        const canDelete = isOwner && details?.memberCount === 1;
        const canLeave = !isOwner || (isOwner && (details?.memberCount ?? 0) > 1);
        const isEditing = editMode === org.id;

        return (
          <div
            key={org.id}
            className="overflow-hidden rounded-md bg-zinc-50 dark:bg-zinc-800"
          >
            <button
              onClick={() => handleToggle(org)}
              className="flex w-full items-center justify-between p-3 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-700"
            >
              <div>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {org.name}
                </span>
                <span className="ml-2 text-xs text-zinc-500">{org.slug}</span>
              </div>
              <svg
                className={`h-4 w-4 text-zinc-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isExpanded && (
              <div className="border-t border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
                {loading ? (
                  <div className="flex items-center gap-2 text-sm text-zinc-500">
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Loading...
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Info */}
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-500">Role:</span>
                        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                          isOwner
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                            : isAdmin
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                              : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                        }`}>
                          {userRole || 'member'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-500">Members:</span>
                        <span className="text-zinc-900 dark:text-zinc-100">{details?.memberCount || 0}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-500">Created:</span>
                        <span className="text-zinc-900 dark:text-zinc-100">
                          {new Date(org.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Edit Form */}
                    {isEditing && (
                      <div className="rounded-md bg-zinc-50 p-3 dark:bg-zinc-800">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                              Name
                            </label>
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="w-full rounded-md border-0 bg-white px-2.5 py-1.5 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-300 focus:ring-2 focus:ring-zinc-900 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-700 dark:focus:ring-zinc-100"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                              Slug
                            </label>
                            <input
                              type="text"
                              value={editSlug}
                              onChange={(e) => setEditSlug(e.target.value.toLowerCase())}
                              className="w-full rounded-md border-0 bg-white px-2.5 py-1.5 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-300 focus:ring-2 focus:ring-zinc-900 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-700 dark:focus:ring-zinc-100"
                            />
                          </div>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => handleSaveEdit(org.id)}
                            disabled={actionLoading === 'edit'}
                            className="rounded-md bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                          >
                            {actionLoading === 'edit' ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Message */}
                    {message && (
                      <div className={`rounded-md px-3 py-2 text-sm ${
                        message.type === 'success'
                          ? 'bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-400'
                          : 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400'
                      }`}>
                        {message.text}
                      </div>
                    )}

                    {/* Actions */}
                    {!isEditing && (
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/server/organization/${org.slug}`}
                          className="rounded-md bg-amber-100 px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50"
                        >
                          View Details
                        </Link>
                        {canEdit && (
                          <button
                            onClick={() => handleStartEdit(org)}
                            className="rounded-md bg-zinc-100 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                          >
                            Edit
                          </button>
                        )}
                        {canLeave && (
                          <button
                            onClick={() => handleLeave(org.id)}
                            disabled={actionLoading === 'leave'}
                            className="rounded-md bg-zinc-100 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-200 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                          >
                            {actionLoading === 'leave' ? 'Leaving...' : 'Leave'}
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(org.id)}
                            disabled={actionLoading === 'delete'}
                            className="rounded-md bg-red-100 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-200 disabled:opacity-50 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                          >
                            {actionLoading === 'delete' ? 'Deleting...' : 'Delete'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

