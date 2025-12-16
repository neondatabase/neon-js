'use server';

import { authServer } from '@/lib/auth/server';
import { redirect } from 'next/navigation';

export async function signOut() {
  await authServer.signOut();
  redirect('/server');
}

