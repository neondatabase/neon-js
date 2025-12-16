'use server';

import { authServer } from '@/lib/auth/server';
import { revalidatePath } from 'next/cache';

export async function updateUserName(formData: FormData) {
  const name = formData.get('name') as string;
  
  if (!name || name.trim() === '') {
    return { error: 'Name is required' };
  }

  const result = await authServer.updateUser({ name: name.trim() });
  
  if (result.error) {
    return { error: result.error.message };
  }

  revalidatePath('/server-rendered');
  return { success: true, data: result.data };
}

