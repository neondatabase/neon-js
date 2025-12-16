'use server';

import { revalidatePath } from 'next/cache';
import { authServer } from '@/lib/auth/server';

export async function removeMember(
  organizationId: string,
  memberIdOrEmail: string,
  organizationSlug: string
) {
  const result = await authServer.organization.removeMember({
    organizationId,
    memberIdOrEmail,
  });

  if (result.error) {
    return {
      success: false,
      message: result.error.message || 'Failed to remove member',
    };
  }

  revalidatePath(`/server/organization/${organizationSlug}`);
  return { success: true, message: 'Member removed' };
}

export async function updateMemberRole(
  organizationId: string,
  memberId: string,
  role: 'admin' | 'member',
  organizationSlug: string
) {
  const result = await authServer.organization.updateMemberRole({
    organizationId,
    memberId,
    role,
  });

  if (result.error) {
    return {
      success: false,
      message: result.error.message || 'Failed to update role',
    };
  }

  revalidatePath(`/server/organization/${organizationSlug}`);
  return { success: true, message: `Role updated to ${role}` };
}

export async function cancelInvitation(
  invitationId: string,
  organizationSlug: string
) {
  const result = await authServer.organization.cancelInvitation({
    invitationId,
  });

  if (result.error) {
    return {
      success: false,
      message: result.error.message || 'Failed to cancel invitation',
    };
  }

  revalidatePath(`/server/organization/${organizationSlug}`);
  return { success: true, message: 'Invitation cancelled' };
}

