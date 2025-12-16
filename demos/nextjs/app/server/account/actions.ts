'use server';

import { revalidatePath } from 'next/cache';
import { authServer } from '@/lib/auth/server';

export async function updateUserName(formData: FormData) {
  const name = formData.get('name') as string;

  if (!name?.trim()) {
    return { success: false, message: 'Name is required' };
  }

  const result = await authServer.updateUser({ name: name.trim() });

  if (result.error) {
    return { success: false, message: result.error.message || 'Failed to update user' };
  }

  revalidatePath('/server/account');
  return { success: true, message: 'Name updated successfully!' };
}

export async function getAccountInfo(accountId: string): Promise<{
  success: boolean;
  error?: string;
  data?: {
    provider: string;
    accountId: string;
    createdAt?: string;
    scopes?: string[];
  };
}> {
  const result = await authServer.accountInfo({
    query: { accountId },
  });

  if (result.error) {
    return { success: false, error: result.error.message };
  }

  // Only return safe, minimal fields - redact tokens and sensitive data
  const data = result.data as Record<string, unknown> | null;
  if (!data) {
    return { success: false, error: 'No account data' };
  }

  return {
    success: true,
    data: {
      provider: String(data.providerId || data.provider || ''),
      accountId: String(data.accountId || ''),
      createdAt: data.createdAt ? String(data.createdAt) : undefined,
      scopes: Array.isArray(data.scopes) ? data.scopes.map(String) : undefined,
    },
  };
}

export async function changePassword(
  _prevState: { success: boolean; message: string } | null,
  formData: FormData
) {
  const currentPassword = formData.get('currentPassword') as string;
  const newPassword = formData.get('newPassword') as string;

  if (!currentPassword || !newPassword) {
    return { success: false, message: 'All fields are required' };
  }

  if (newPassword.length < 8) {
    return { success: false, message: 'Password must be at least 8 characters' };
  }

  const result = await authServer.changePassword({
    currentPassword,
    newPassword,
  });

  if (result.error) {
    return { success: false, message: result.error.message || 'Failed to change password' };
  }

  return { success: true, message: 'Password changed successfully!' };
}

