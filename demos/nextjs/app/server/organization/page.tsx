import { authServer } from '@/lib/auth/server';
import Link from 'next/link';
import { CreateOrgForm } from './create-org-form';
import { OrganizationList } from './org-list';
import { InviteMemberForm } from './invite-member-form';
import { CodeBlock } from '@/components/code-block';

const createOrgCode = `'use server';

import { authServer } from '@/lib/auth/server';
import { revalidatePath } from 'next/cache';

export async function createOrganization(formData: FormData) {
  const name = formData.get('name') as string;
  const slug = formData.get('slug') as string;

  const { data, error } = await authServer.organization.create({
    name,
    slug,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath('/server/organization');
  return { success: true, message: 'Organization created!' };
}`;

const listOrgsCode = `import { authServer } from '@/lib/auth/server';

// List user's organizations
const { data: orgs } = await authServer.organization.list();

// Get full details including members
const { data: details } = await authServer.organization.getFullOrganization({
  query: { organizationId: 'org_123' },
});

// List members of an organization  
const { data: members } = await authServer.organization.listMembers({
  query: { organizationId: 'org_123' },
});`;

const orgActionsCode = `'use server';

import { authServer } from '@/lib/auth/server';

// Leave an organization (as member)
await authServer.organization.leave({
  organizationId: 'org_123',
});

// Delete an organization (owner only, must be sole member)
await authServer.organization.delete({
  organizationId: 'org_123',
});

// Update organization (owner/admin only)
await authServer.organization.update({
  organizationId: 'org_123',
  data: { name: 'New Name', slug: 'new-slug' },
});`;

const inviteMemberCode = `'use server';

import { authServer } from '@/lib/auth/server';

export async function inviteMember(formData: FormData) {
  const email = formData.get('email') as string;
  const organizationId = formData.get('organizationId') as string;
  const role = formData.get('role') as string;

  const { data, error } = await authServer.organization.inviteMember({
    email,
    organizationId,
    role,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  return { success: true, message: 'Invitation sent!' };
}`;

const otherApisCode = `// Set active organization
await authServer.organization.setActive({
  organizationId: 'org_123',
});

// Get full organization details
const { data } = await authServer.organization.getFullOrganization({
  query: { organizationId: 'org_123' },
});

// Update organization
await authServer.organization.update({
  organizationId: 'org_123',
  data: { name: 'New Name' },
});

// Delete organization
await authServer.organization.delete({
  organizationId: 'org_123',
});`;

export default async function ServerOrganizationPage() {
  const sessionResult = await authServer.getSession();
  const orgsResult = await authServer.organization.list();

  const session = sessionResult.data;
  const isLoggedIn = !!session?.session;

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <div className="mx-auto max-w-4xl px-4 py-12">
          <Link
            href="/server"
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back
          </Link>
          <div className="rounded-lg bg-amber-50 p-6 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:ring-amber-900">
            <p className="text-amber-800 dark:text-amber-200">
              Sign in to manage organizations.
            </p>
            <Link
              href="/server/auth/sign-in"
              className="mt-4 inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <Link
          href="/server"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back
        </Link>

        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Organizations
        </h1>
        <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
          Server-side organization management APIs
        </p>

        <div className="mt-8 space-y-12">
          {/* Create Organization Section */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Create Organization
              </h2>
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                authServer.organization.create()
              </code>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
                <h3 className="mb-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  Try it
                </h3>
                <CreateOrgForm />
              </div>
              <CodeBlock code={createOrgCode} filename="actions.ts" />
            </div>
          </section>

          {/* List Organizations Section */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Your Organizations
              </h2>
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                authServer.organization.list()
              </code>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
                <h3 className="mb-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  Result <span className="font-normal">(click to expand)</span>
                </h3>
                <OrganizationList
                  organizations={orgsResult.data?.map((org) => ({
                    id: org.id,
                    name: org.name,
                    slug: org.slug,
                    createdAt: org.createdAt,
                  })) || []}
                  currentUserId={session.user?.id || ''}
                />
              </div>
              <CodeBlock code={listOrgsCode} filename="list-orgs.ts" />
            </div>
          </section>

          {/* Organization Actions Section */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Organization Actions
              </h2>
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                leave()
              </code>
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                delete()
              </code>
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                update()
              </code>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
                <h3 className="mb-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  Role-based actions
                </h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex gap-3">
                    <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">member</span>
                    <span className="text-zinc-600 dark:text-zinc-400">Can leave the organization</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="shrink-0 rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-900 dark:text-blue-300">admin</span>
                    <span className="text-zinc-600 dark:text-zinc-400">Can edit name/slug, leave</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="shrink-0 rounded bg-purple-100 px-1.5 py-0.5 text-xs text-purple-700 dark:bg-purple-900 dark:text-purple-300">owner</span>
                    <span className="text-zinc-600 dark:text-zinc-400">Can edit, delete (if sole member), or leave</span>
                  </li>
                </ul>
              </div>
              <CodeBlock code={orgActionsCode} filename="actions.ts" />
            </div>
          </section>

          {/* Invite Member Section */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Invite Member
              </h2>
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                authServer.organization.inviteMember()
              </code>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
                <h3 className="mb-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  Try it
                </h3>
                <InviteMemberForm
                  organizations={orgsResult.data?.map((org) => ({
                    id: org.id,
                    name: org.name,
                    slug: org.slug,
                  })) || []}
                />
              </div>
              <CodeBlock code={inviteMemberCode} filename="actions.ts" />
            </div>
          </section>

          {/* Other APIs Section */}
          <section>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Other APIs
              </h2>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
                <h3 className="mb-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  Available methods
                </h3>
                <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
                  {[
                    'setActive()',
                    'getFullOrganization()',
                    'update()',
                    'delete()',
                    'checkSlug()',
                    'listMembers()',
                    'removeMember()',
                    'updateMemberRole()',
                    'leave()',
                    'getActiveMember()',
                    'acceptInvitation()',
                    'rejectInvitation()',
                    'cancelInvitation()',
                    'listInvitations()',
                    'hasPermission()',
                  ].map((api) => (
                    <li key={api}>
                      <code className="text-xs text-zinc-600 dark:text-zinc-400">
                        .{api}
                      </code>
                    </li>
                  ))}
                </ul>
              </div>
              <CodeBlock code={otherApisCode} filename="examples.ts" />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
