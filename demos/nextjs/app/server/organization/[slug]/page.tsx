import { authServer } from '@/lib/auth/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CodeBlock } from '@/components/code-block';
import { MemberActions } from './member-actions';
import { InvitationActions } from './invitation-actions';

const getOrgCode = `import { authServer } from '@/lib/auth/server';

// Get full organization with members
const { data } = await authServer.organization.getFullOrganization({
  query: { organizationSlug: 'my-org' },
});

// Access organization details
const org = data;
const members = data?.members;
const invitations = data?.invitations;`;

const memberActionsCode = `'use server';

import { authServer } from '@/lib/auth/server';

// Remove a member
await authServer.organization.removeMember({
  organizationId: 'org_123',
  memberIdOrEmail: 'member_456',
});

// Update member role
await authServer.organization.updateMemberRole({
  organizationId: 'org_123',
  memberId: 'member_456',
  role: 'admin',
});`;

const invitationActionsCode = `'use server';

import { authServer } from '@/lib/auth/server';

// Cancel an invitation
await authServer.organization.cancelInvitation({
  invitationId: 'inv_123',
});

// List all invitations
const { data } = await authServer.organization.listInvitations({
  query: { organizationId: 'org_123' },
});`;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function OrganizationDetailPage({ params }: PageProps) {
  const { slug } = await params;
  
  const sessionResult = await authServer.getSession();
  const session = sessionResult.data;
  const isLoggedIn = !!session?.session;

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <div className="mx-auto max-w-4xl px-4 py-12">
          <Link
            href="/server/organization"
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back to Organizations
          </Link>
          <div className="rounded-lg bg-amber-50 p-6 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:ring-amber-900">
            <p className="text-amber-800 dark:text-amber-200">
              Sign in to view organization details.
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

  // Get organization details by slug
  const orgResult = await authServer.organization.getFullOrganization({
    query: { organizationSlug: slug },
  });

  if (orgResult.error || !orgResult.data) {
    notFound();
  }

  const org = orgResult.data as {
    id: string;
    name: string;
    slug: string;
    createdAt: Date;
    members?: Array<{
      id: string;
      userId: string;
      role: string;
      user: {
        id: string;
        name: string | null;
        email: string;
        image?: string | null;
      };
    }>;
    invitations?: Array<{
      id: string;
      email: string;
      role: string;
      status: string;
      expiresAt: Date;
    }>;
  };

  const members = org.members || [];
  const invitations = (org.invitations || []).filter(
    (inv) => inv.status === 'pending'
  );

  // Find current user's role
  const currentMember = members.find((m) => m.userId === session.user?.id);
  const currentUserRole = currentMember?.role || 'member';
  const canManage = currentUserRole === 'owner' || currentUserRole === 'admin';

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <Link
          href="/server/organization"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back to Organizations
        </Link>

        {/* Organization Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {org.name}
            </h1>
            <div className="mt-1.5 flex items-center gap-3 text-sm text-zinc-500">
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">
                {org.slug}
              </code>
              <span>•</span>
              <span>{members.length} member{members.length !== 1 ? 's' : ''}</span>
              <span>•</span>
              <span>Created {new Date(org.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
          <span
            className={`rounded px-2 py-1 text-xs font-medium ${
              currentUserRole === 'owner'
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                : currentUserRole === 'admin'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                  : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
            }`}
          >
            {currentUserRole}
          </span>
        </div>

        <div className="space-y-12">
          {/* Members Section */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Members
              </h2>
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                getFullOrganization().members
              </code>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
                {members.length > 0 ? (
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {members.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                      >
                        <div className="flex items-center gap-3">
                          {member.user.image ? (
                            <img
                              src={member.user.image}
                              alt=""
                              className="h-8 w-8 rounded-full"
                            />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-sm font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                              {(member.user.name || member.user.email)[0].toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                                {member.user.name || 'Unnamed'}
                              </span>
                              {member.userId === session.user?.id && (
                                <span className="text-xs text-zinc-400">(you)</span>
                              )}
                            </div>
                            <p className="text-sm text-zinc-500">{member.user.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                              member.role === 'owner'
                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                                : member.role === 'admin'
                                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                                  : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                            }`}
                          >
                            {member.role}
                          </span>
                          {canManage && member.userId !== session.user?.id && (
                            <MemberActions
                              organizationId={org.id}
                              memberId={member.id}
                              memberUserId={member.userId}
                              currentRole={member.role}
                              isOwner={currentUserRole === 'owner'}
                              organizationSlug={org.slug}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">No members</p>
                )}
              </div>
              <CodeBlock code={memberActionsCode} filename="actions.ts" />
            </div>
          </section>

          {/* Invitations Section */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Pending Invitations
              </h2>
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                getFullOrganization().invitations
              </code>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
                {invitations.length > 0 ? (
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {invitations.map((invitation) => (
                      <div
                        key={invitation.id}
                        className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                      >
                        <div>
                          <p className="font-medium text-zinc-900 dark:text-zinc-100">
                            {invitation.email}
                          </p>
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500">
                            <span
                              className={`rounded px-1.5 py-0.5 font-medium ${
                                invitation.role === 'admin'
                                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                                  : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                              }`}
                            >
                              {invitation.role}
                            </span>
                            <span>•</span>
                            <span>
                              Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        {canManage && (
                          <InvitationActions
                            invitationId={invitation.id}
                            organizationSlug={org.slug}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">No pending invitations</p>
                )}
              </div>
              <CodeBlock code={invitationActionsCode} filename="actions.ts" />
            </div>
          </section>

          {/* API Reference */}
          <section>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Fetching Organization Data
              </h2>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
                <h3 className="mb-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  Response structure
                </h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex gap-3">
                    <code className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">
                      id, name, slug
                    </code>
                    <span className="text-zinc-600 dark:text-zinc-400">
                      Organization basics
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <code className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">
                      members[]
                    </code>
                    <span className="text-zinc-600 dark:text-zinc-400">
                      Array with user details and role
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <code className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">
                      invitations[]
                    </code>
                    <span className="text-zinc-600 dark:text-zinc-400">
                      Array with email, role, status
                    </span>
                  </li>
                </ul>
              </div>
              <CodeBlock code={getOrgCode} filename="page.tsx" />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

