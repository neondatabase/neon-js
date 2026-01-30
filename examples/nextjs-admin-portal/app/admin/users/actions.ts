'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth/server';

export async function updateUserRole(formData: FormData) {
  const { data: session } = await auth.getSession();

  // Check if user is admin
  if (!session?.user || session.user.role !== 'admin') {
    console.error('Unauthorized: User is not admin');
    return;
  }

  const userId = formData.get('userId') as string;
  const newRole = formData.get('newRole') as 'admin' | 'user';

  // Prevent users from changing their own role
  if (userId === session.user.id) {
    console.error('Cannot modify your own role');
    return;
  }

  // Update user role using auth API
  const { error } = await auth.admin.setRole({
    userId,
    role: newRole,
  });

  if (error) {
    console.error('Failed to update user role:', error);
    return;
  }

  console.log(`Successfully updated user ${userId} role to ${newRole}`);
  revalidatePath('/admin/users');
}

export async function deleteUser(formData: FormData) {
  const { data: session } = await auth.getSession();

  // Check if user is admin
  if (!session?.user || session.user.role !== 'admin') {
    console.error('Unauthorized: User is not admin');
    return;
  }

  const userId = formData.get('userId') as string;

  // Prevent users from deleting themselves
  if (userId === session.user.id) {
    console.error('Cannot delete yourself');
    return;
  }

  // Delete user using auth API
  const { error } = await auth.admin.removeUser({
    userId,
  });

  if (error) {
    console.error('Failed to delete user:', error);
    return;
  }

  console.log(`Successfully deleted user ${userId}`);
  revalidatePath('/admin/users');
}
