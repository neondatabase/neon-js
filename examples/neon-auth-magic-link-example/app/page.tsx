import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-secondary font-sans">
      <main className="flex w-full max-w-md flex-col items-center justify-center gap-8 px-6 py-20">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <svg
              className="h-8 w-8 text-primary"
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
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            Magic Link Auth
          </h1>
          <p className="max-w-sm text-base leading-relaxed text-muted-foreground">
            Passwordless authentication with email OTP, powered by{" "}
            <a
              href="https://neon.tech/docs/guides/neon-auth"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-foreground underline decoration-muted-foreground transition-colors hover:decoration-foreground"
            >
              Neon Auth
            </a>
            . Enter your email, get a code, sign in.
          </p>
        </div>

        <Link
          href="/auth/sign-in"
          className="flex h-12 w-full items-center justify-center rounded-lg bg-primary px-8 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Sign in with Magic Link
        </Link>

        <p className="text-center text-sm text-muted-foreground">
          No password needed. We&apos;ll send a one-time code to your email.
        </p>
      </main>
    </div>
  );
}
