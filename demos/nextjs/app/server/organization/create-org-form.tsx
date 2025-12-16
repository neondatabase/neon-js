'use client';

import { useFormStatus } from 'react-dom';
import { createOrganization } from './actions';
import { useState } from 'react';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
    >
      {pending ? 'Creating...' : 'Create Organization'}
    </button>
  );
}

export function CreateOrgForm() {
  const [message, setMessage] = useState('');

  return (
    <form
      action={async (formData) => {
        const result = await createOrganization(formData);
        setMessage(result.message);
      }}
      className="flex flex-col gap-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="name"
            className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Organization Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            placeholder="My Organization"
            required
            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
        </div>
        <div>
          <label
            htmlFor="slug"
            className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Slug
          </label>
          <input
            type="text"
            id="slug"
            name="slug"
            placeholder="my-organization"
            required
            pattern="^[a-z0-9-]+$"
            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <SubmitButton />
        {message && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{message}</p>
        )}
      </div>
    </form>
  );
}

