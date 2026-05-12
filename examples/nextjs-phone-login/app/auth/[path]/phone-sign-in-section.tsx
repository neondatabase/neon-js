'use client';

import { PhoneSignInForm } from '@/components/phone-sign-in-form';

export function PhoneSignInSection() {
  return (
    <>
      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground uppercase tracking-wide">or</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Phone sign-in */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-3">
        <h3 className="text-sm font-medium">Sign in with phone number</h3>
        <p className="text-xs text-muted-foreground">
          If you have already linked a phone number to your account, enter it
          below to receive an OTP code.
        </p>
        <PhoneSignInForm />
      </div>
    </>
  );
}
