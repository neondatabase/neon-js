'use client';

import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import { inviteMember } from './actions';

interface Organization {
  id: string;
  name: string;
  slug: string;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
    >
      {pending ? 'Sending...' : 'Send Invite'}
    </button>
  );
}

export function InviteMemberForm({ organizations }: { organizations: Organization[] }) {
  const [state, formAction] = useActionState(inviteMember, null);

  if (organizations.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Create an organization first to invite members.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <label
          htmlFor="organizationId"
          className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Organization
        </label>
        <select
          id="organizationId"
          name="organizationId"
          required
          className="w-full rounded-md border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
        >
          <option value="">Select organization...</option>
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name} ({org.slug})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="email"
          className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Email
        </label>
        <input
          type="email"
          id="email"
          name="email"
          placeholder="user@example.com"
          required
          className="w-full rounded-md border border-zinc-300 bg-white px-4 py-2 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder:text-zinc-500"
        />
      </div>

      <div>
        <label
          htmlFor="role"
          className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Role
        </label>
        <select
          id="role"
          name="role"
          required
          className="w-full rounded-md border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
        >
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
        <p className="mt-1 text-xs text-zinc-500">
          Admins can manage members and settings. Members have limited access.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <SubmitButton />
        {state?.message && (
          <p
            className={`text-sm ${state.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
          >
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}

