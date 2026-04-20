'use client';

import { authClient } from '@/lib/auth/client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type FormState = 'idle' | 'sending' | 'verify' | 'verifying' | 'success' | 'error';

/**
 * PhoneSignInForm — for unauthenticated users to sign in with a phone number.
 * Does NOT pass `updatePhoneNumber` so Better Auth treats the OTP verification
 * as a sign-in (finds existing user by phone number, creates a session).
 */
export function PhoneSignInForm() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const [state, setState] = useState<FormState>('idle');
  const [error, setError] = useState('');

  async function sendOTP() {
    if (!phoneNumber.trim()) return;
    setState('sending');
    setError('');

    try {
      await authClient.phoneNumber.sendOtp({
        phoneNumber: phoneNumber.trim(),
      });
      setState('verify');
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Failed to send OTP');
    }
  }

  async function verifyOTP() {
    if (!code.trim()) return;
    setState('verifying');
    setError('');

    try {
      await authClient.phoneNumber.verify({
        phoneNumber: phoneNumber.trim(),
        code: code.trim(),
      });
      setState('success');
      router.push('/dashboard');
    } catch (err) {
      // Preserve status-aware behavior: a 400 INVALID_OTP means the user can
      // retry against the SAME OTP (allowedAttempts is only consumed by
      // repeated attempts on one OTP — re-sending resets the counter).
      // A 403 TOO_MANY_ATTEMPTS means the OTP has been invalidated; the user
      // must request a new one via Start over / Use a different number.
      const status = (err as { status?: number } | undefined)?.status;
      const message =
        err instanceof Error ? err.message : 'Verification failed';
      setError(message);
      if (status === 400) {
        // Stay in verify state so the user can enter another code and
        // actually consume the server-side allowedAttempts budget.
        setState('verify');
        setCode('');
      } else {
        // TOO_MANY_ATTEMPTS, OTP_EXPIRED, network error — OTP is unusable;
        // force the user through the resend flow.
        setState('error');
      }
    }
  }

  function reset() {
    setPhoneNumber('');
    setCode('');
    setState('idle');
    setError('');
  }

  if (state === 'success') {
    return (
      <div className="space-y-3">
        <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-primary text-sm">
          Signed in! Redirecting to dashboard...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Phone Number Input */}
      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">Phone Number</label>
        <div className="flex gap-2">
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+1234567890"
            disabled={state === 'verify' || state === 'verifying'}
            className="flex-1 px-3 py-2 rounded-lg bg-background border border-input text-foreground placeholder-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
          />
          {(state === 'idle' || state === 'error') && (
            <button
              onClick={sendOTP}
              disabled={state === 'sending' || !phoneNumber.trim()}
              className="px-4 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-sm disabled:opacity-50"
            >
              {state === 'sending' ? 'Sending...' : 'Send OTP'}
            </button>
          )}
        </div>
      </div>

      {/* OTP Input */}
      {(state === 'verify' || state === 'verifying') && (
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">Verification Code</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter code"
              maxLength={6}
              className="flex-1 px-3 py-2 rounded-lg bg-background border border-input text-foreground placeholder-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring font-mono tracking-widest text-center"
            />
            <button
              onClick={verifyOTP}
              disabled={state === 'verifying' || !code.trim()}
              className="px-4 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-sm disabled:opacity-50"
            >
              {state === 'verifying' ? 'Verifying...' : 'Verify'}
            </button>
          </div>
          <button
            onClick={() => { setState('idle'); setCode(''); }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Use a different number
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Reset after error */}
      {state === 'error' && (
        <button
          onClick={reset}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Start over
        </button>
      )}
    </div>
  );
}
