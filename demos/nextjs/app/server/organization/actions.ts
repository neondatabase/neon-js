'use server';

import { revalidatePath } from 'next/cache';
import { authServer } from '@/lib/auth/server';

export async function createOrganization(formData: FormData) {
  const name = formData.get('name') as string;
  const slug = formData.get('slug') as string;

  if (!name?.trim() || !slug?.trim()) {
    return { success: false, message: 'Name and slug are required' };
  }

  const result = await authServer.organization.create({
    name: name.trim(),
    slug: slug.trim().toLowerCase(),
  });

  if (result.error) {
    return {
      success: false,
      message: result.error.message || 'Failed to create organization',
    };
  }

  revalidatePath('/server/organization');
  return { success: true, message: `Organization "${name}" created!` };
}

export async function leaveOrganization(organizationId: string) {
  const result = await authServer.organization.leave({
    organizationId,
  });

  if (result.error) {
    return {
      success: false,
      message: result.error.message || 'Failed to leave organization',
    };
  }

  revalidatePath('/server/organization');
  return { success: true, message: 'Left organization' };
}

export async function deleteOrganization(organizationId: string) {
  const result = await authServer.organization.delete({
    organizationId,
  });

  if (result.error) {
    return {
      success: false,
      message: result.error.message || 'Failed to delete organization',
    };
  }

  revalidatePath('/server/organization');
  return { success: true, message: 'Organization deleted' };
}

export async function updateOrganization(
  organizationId: string,
  data: { name?: string; slug?: string }
) {
  const result = await authServer.organization.update({
    organizationId,
    data,
  });

  if (result.error) {
    return {
      success: false,
      message: result.error.message || 'Failed to update organization',
    };
  }

  revalidatePath('/server/organization');
  return { success: true, message: 'Organization updated' };
}

export async function inviteMember(
  _prevState: { success: boolean; message: string } | null,
  formData: FormData
) {
  const email = formData.get('email') as string;
  const organizationId = formData.get('organizationId') as string;
  const role = formData.get('role') as 'admin' | 'member';

  if (!email?.trim() || !organizationId?.trim()) {
    return { success: false, message: 'Email and organization are required' };
  }

  const result = await authServer.organization.inviteMember({
    email: email.trim(),
    organizationId,
    role: role || 'member',
  });

  if (result.error) {
    return {
      success: false,
      message: result.error.message || 'Failed to send invitation',
    };
  }

  return { success: true, message: `Invitation sent to ${email}!` };
}

export async function getOrganizationDetails(organizationId: string) {
  const [fullOrgResult, membersResult] = await Promise.all([
    authServer.organization.getFullOrganization({
      query: { organizationId },
    }),
    authServer.organization.listMembers({
      query: { organizationId },
    }),
  ]);

  if (fullOrgResult.error) {
    return { success: false, error: fullOrgResult.error.message };
  }

  // Handle different response structures - members could be array or wrapped object
  let members: Array<{ id: string; userId: string; role: string }> = [];
  const membersData = membersResult.data;
  
  if (Array.isArray(membersData)) {
    members = membersData.map((m) => ({
      id: String(m.id || ''),
      userId: String(m.userId || ''),
      role: String(m.role || 'member'),
    }));
  } else if (membersData && typeof membersData === 'object') {
    // If wrapped in an object with a 'members' property
    const nested = (membersData as { members?: unknown }).members;
    if (Array.isArray(nested)) {
      members = nested.map((m: Record<string, unknown>) => ({
        id: String(m.id || ''),
        userId: String(m.userId || ''),
        role: String(m.role || 'member'),
      }));
    }
  }

  return {
    success: true,
    data: {
      organization: fullOrgResult.data,
      members,
      memberCount: members.length,
    },
  };
}

