'use server';

import { auth } from '@/lib/auth/server';
import { redirect } from 'next/navigation';

export async function signIn(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const { error } = await auth.signIn.email({
    email,
    password,
  });

  if (error) {
    console.error('Sign in error:', error);
    redirect(
      `/auth/sign-in?error=${encodeURIComponent(error.message || 'Sign in failed')}`
    );
  }

  // Check if user is admin
  const { data: session } = await auth.getSession();

  if (!session?.user) {
    redirect('/auth/sign-in?error=Session+not+found');
  }

  // Check user role - only admins can access this portal
  if (session.user.role !== 'admin') {
    // Redirect non-admin users to main app
    const mainAppUrl = process.env.MAIN_APP_URL || 'http://localhost:3000';
    redirect(mainAppUrl);
  }

  redirect('/admin');
}

export async function signOut() {
  await auth.signOut();
  redirect('/');
}
