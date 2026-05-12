'use client';

import { authClient } from '@/lib/auth/client';
import { useState } from 'react';

type FormState = 'idle' | 'sending' | 'verify' | 'verifying' | 'success' | 'error';

/**
 * AddPhoneForm — for logged-in users to link a phone number to their account.
 * Uses `updatePhoneNumber: true` so Better Auth associates the number with the
 * current session's user rather than attempting a standalone sign-in.
 *
 * On load, checks the session for an existing phone number:
 *  - verified   -> shows the number with a green badge and "Change" button
 *  - unverified -> offers to re-send OTP
 *  - none       -> shows the input form
 */
export function AddPhoneForm() {
  const { data: session } = authClient.useSession();

  // Session user carries phoneNumber / phoneNumberVerified at runtime
  // (Better Auth phone-number plugin, `returned: true`), but the generated
  // TypeScript types don't include them — cast once here.
  const sessionUser = session?.user as
    | (typeof session extends { user: infer U } ? U : never) & {
        phoneNumber?: string;
        phoneNumberVerified?: boolean;
      }
    | undefined;

  const existingPhone = sessionUser?.phoneNumber ?? '';
  const isVerified = sessionUser?.phoneNumberVerified ?? false;

  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const [state, setState] = useState<FormState>('idle');
  const [error, setError] = useState('');
  // When the user has a verified number and clicks "Change phone number"
  const [changingNumber, setChangingNumber] = useState(false);

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
        updatePhoneNumber: true,
      });
      setState('success');
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Verification failed');
    }
  }

  function reset() {
    setPhoneNumber('');
    setCode('');
    setState('idle');
    setError('');
    setChangingNumber(false);
  }

  // ── Verified phone already on record ──────────────────────────────
  if (existingPhone && isVerified && !changingNumber && state !== 'success') {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm">{existingPhone}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            <svg
              className="h-3 w-3"
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16Zm3.78-9.72a.75.75 0 0 0-1.06-1.06L6.75 9.19 5.28 7.72a.75.75 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.06 0l4.5-4.5Z"
                clipRule="evenodd"
              />
            </svg>
            Verified
          </span>
        </div>
        <button
          onClick={() => setChangingNumber(true)}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Change phone number
        </button>
      </div>
    );
  }

  // ── Unverified phone on record (not currently changing) ───────────
  if (existingPhone && !isVerified && !changingNumber && state === 'idle') {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm">{existingPhone}</span>
          <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">
            Not verified
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setPhoneNumber(existingPhone);
              sendOTP();
            }}
            className="px-4 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-sm"
          >
            Resend verification code
          </button>
          <button
            onClick={() => setChangingNumber(true)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors px-4 py-2"
          >
            Use different number
          </button>
        </div>
      </div>
    );
  }

  // ── Just verified — show same UI as "verified on record" ──────────
  if (state === 'success') {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm">{phoneNumber}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            <svg
              className="h-3 w-3"
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16Zm3.78-9.72a.75.75 0 0 0-1.06-1.06L6.75 9.19 5.28 7.72a.75.75 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.06 0l4.5-4.5Z"
                clipRule="evenodd"
              />
            </svg>
            Verified
          </span>
        </div>
        <button
          onClick={reset}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Change phone number
        </button>
      </div>
    );
  }

  // ── Input form (no phone, or user chose to change) ────────────────
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

      {/* Cancel — back to existing phone display */}
      {changingNumber && state === 'idle' && (
        <button
          onClick={reset}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      )}
    </div>
  );
}
