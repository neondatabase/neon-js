'use server';

import { authServer } from '@/lib/auth/server';
import { redirect } from 'next/navigation';

export async function signInWithEmail(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const { error } = await authServer.signIn.email({
    email,
    password,
  });

  if (error) {
    return { error: error.message || 'Invalid email or password' };
  }

  redirect('/server');
}

// OTP Sign In - Step 1: Send OTP
export async function sendOtp(email: string) {
  const { error } = await authServer.emailOtp.sendVerificationOtp({
    email,
    type: 'sign-in',
  });

  if (error) {
    return { error: error.message || 'Failed to send OTP' };
  }

  return { success: true };
}

// OTP Sign In - Step 2: Verify OTP and sign in
export async function verifyOtp(email: string, otp: string) {
  const { error } = await authServer.signIn.emailOtp({
    email,
    otp,
  });

  if (error) {
    return { error: error.message || 'Invalid OTP' };
  }

  redirect('/server');
}

// Google Sign In
export async function signInWithGoogle() {
  const { data, error } = await authServer.signIn.social({
    provider: 'google',
    callbackURL: '/server/account',
  });

  if (error) {
    return { error: error.message || 'Failed to initiate Google sign in' };
  }

  // Redirect to Google OAuth
  if (data?.url) {
    redirect(data.url);
  }

  return { error: 'No redirect URL returned' };
}

// Sign Out
export async function signOutAction() {
  await authServer.signOut();
  redirect('/server/auth/sign-in');
}

