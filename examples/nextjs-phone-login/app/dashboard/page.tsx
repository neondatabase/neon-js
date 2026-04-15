'use client';

import { authClient } from '@/lib/auth/client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AddPhoneForm } from '@/components/phone-login-form';

export default function Dashboard() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (!isPending && !session) {
      router.push('/auth/sign-in');
    }
  }, [isPending, session, router]);

  if (isPending) {
    return (
      <div className="flex justify-center py-12">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-1">Dashboard</h1>
        <p className="text-muted-foreground">Your authentication details</p>
      </div>

      {/* User Info */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold">User Info</h2>
        <div className="grid grid-cols-1 gap-3 text-sm">
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-muted-foreground">Name</span>
            <span>{session.user.name || '—'}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-muted-foreground">Email</span>
            <span>{session.user.email}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-muted-foreground">User ID</span>
            <span className="font-mono text-xs text-muted-foreground">{session.user.id}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-muted-foreground">Email Verified</span>
            <span>{session.user.emailVerified ? 'Yes' : 'No'}</span>
          </div>
        </div>
      </div>

      {/* Session Info */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Session</h2>
        <div className="grid grid-cols-1 gap-3 text-sm">
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-muted-foreground">Session ID</span>
            <span className="font-mono text-xs text-muted-foreground">{session.session.id}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-muted-foreground">Expires</span>
            <span>{new Date(session.session.expiresAt).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Add Phone Number */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Phone Number</h2>
        <p className="text-sm text-muted-foreground">
          Add a phone number to your account to enable phone sign-in.
        </p>
        <AddPhoneForm />
      </div>

      {/* Sign Out */}
      <button
        onClick={async () => {
          await authClient.signOut();
          router.push('/');
        }}
        className="px-4 py-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors text-sm"
      >
        Sign Out
      </button>
    </div>
  );
}
