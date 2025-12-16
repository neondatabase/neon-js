'use server';

import { authServer } from '@/lib/auth/server';
import { redirect } from 'next/navigation';

export async function signUpWithEmail(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const { error } = await authServer.signUp.email({
    name,
    email,
    password,
  });

  if (error) {
    return { error: error.message || 'Failed to create account' };
  }

  redirect('/server');
}

