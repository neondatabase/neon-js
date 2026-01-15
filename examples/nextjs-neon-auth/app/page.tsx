import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-secondary font-sans">
      <main className="flex w-full max-w-4xl flex-col items-center justify-center gap-8 px-6 py-20">
        <div className="flex flex-col items-center gap-6 text-center">
          <h1 className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
            Neon Auth
          </h1>
          <p className="max-w-2xl text-xl leading-relaxed text-muted-foreground">
            Serverless authentication for modern applications. Built on top of{" "}
            <a
              href="https://better-auth.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-foreground underline decoration-muted-foreground transition-colors hover:decoration-foreground"
            >
              Better Auth
            </a>
            , powered by{" "}
            <a
              href="https://neon.tech"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-foreground underline decoration-muted-foreground transition-colors hover:decoration-foreground"
            >
              Neon
            </a>
            &apos;s serverless Postgres.
          </p>
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground/80">
            Get started with secure, scalable authentication in minutes. No complex setup, no infrastructure management—just plug in and authenticate.
          </p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <Link
            href="/notes"
            className="flex h-12 items-center justify-center rounded-lg bg-primary px-8 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            My Notes
          </Link>
          <Link
            href="/account/settings"
            className="flex h-12 items-center justify-center rounded-lg border border-input bg-background px-8 text-base font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Account Settings
          </Link>

        </div>

        <div className="mt-8 grid max-w-3xl grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-6">
            <h3 className="font-semibold text-card-foreground">Serverless First</h3>
            <p className="text-sm text-muted-foreground">
              Built for serverless environments with Neon&apos;s autoscaling Postgres.
            </p>
          </div>
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-6">
            <h3 className="font-semibold text-card-foreground">Better Auth Core</h3>
            <p className="text-sm text-muted-foreground">
              Leverage the full power of Better Auth&apos;s flexible authentication framework.
            </p>
          </div>
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-6">
            <h3 className="font-semibold text-card-foreground">Zero Config</h3>
            <p className="text-sm text-muted-foreground">
              Start authenticating users with minimal setup and configuration.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
