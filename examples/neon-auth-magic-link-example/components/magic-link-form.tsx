"use client";

import { authClient } from "@/lib/auth/client";
import Link from "next/link";
import { useState } from "react";

type Status = "idle" | "sending" | "sent" | "error";

export function MagicLinkForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("sending");

    try {
      const result = await authClient.signIn.magicLink({
        email,
        callbackURL: "/dashboard",
      });

      if (result.error) {
        setError(result.error.message ?? "Failed to send magic link");
        setStatus("error");
        return;
      }

      setStatus("sent");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to send magic link",
      );
      setStatus("error");
    }
  }

  function handleChangeEmail() {
    setStatus("idle");
    setError(null);
  }

  async function handleResend() {
    setError(null);
    setStatus("sending");

    try {
      const result = await authClient.signIn.magicLink({
        email,
        callbackURL: "/dashboard",
      });

      if (result.error) {
        setError(result.error.message ?? "Failed to resend magic link");
        setStatus("sent");
        return;
      }

      setStatus("sent");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to resend magic link",
      );
      setStatus("sent");
    }
  }

  const showForm = status === "idle" || status === "error";

  return (
    <div className="w-full max-w-md rounded-xl border border-border bg-card p-8">
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <svg
            className="h-6 w-6 text-primary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-foreground">
          {showForm ? "Sign in with Magic Link" : "Check your email"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {showForm
            ? "We'll send a magic link to your email"
            : `We sent a magic link to ${email}`}
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {showForm ? (
        <form onSubmit={handleSendMagicLink} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label
              htmlFor="email"
              className="text-sm font-medium text-foreground"
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="h-11 rounded-lg border border-input bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={status === "sending"}
            />
          </div>
          <button
            type="submit"
            disabled={status === "sending"}
            className="h-11 rounded-lg bg-primary font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {status === "sending" ? "Sending..." : "Send Magic Link"}
          </button>
        </form>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-center text-sm text-muted-foreground">
            Click the link in the email to sign in. You can close this tab.
          </p>
          <Link
            href="/webhooks"
            className="text-center text-sm text-primary transition-colors hover:text-primary/80"
          >
            Or check your webhooks &rarr;
          </Link>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleChangeEmail}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Use different email
            </button>
            <button
              type="button"
              onClick={handleResend}
              disabled={status === "sending"}
              className="text-sm text-primary transition-colors hover:text-primary/80 disabled:opacity-50"
            >
              Resend link
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
