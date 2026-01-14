import { Link } from 'react-router-dom';
import { SignedIn, SignedOut, AuthLoading } from '@daveyplate/better-auth-ui';

export function HomePage() {
  return (
    <div className="min-h-[calc(100vh-64px)]">
      {/* Hero Section */}
      <section className="px-6 py-16 text-center">
        <h1 className="mb-6 text-4xl font-bold leading-tight text-foreground">
          <span className="bg-linear-to-r from-emerald-500 to-cyan-500 bg-clip-text text-transparent">
            External better-auth-ui
          </span>
          <br />
          Demo Application
        </h1>
        <p className="mx-auto mb-8 max-w-xl text-lg text-muted-foreground">
          Using @daveyplate/better-auth-ui directly with Neon Auth backend.
        </p>

        <AuthLoading>
          <div className="flex justify-center gap-4">
            <div className="h-12 w-36 animate-pulse rounded-md bg-muted" />
            <div className="h-12 w-36 animate-pulse rounded-md bg-muted" />
          </div>
        </AuthLoading>

        <SignedOut>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="/auth/sign-up"
              className="rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground"
            >
              Get Started Free
            </Link>
            <Link
              to="/auth/sign-in"
              className="rounded-md border border-border bg-secondary px-6 py-3 font-medium text-secondary-foreground"
            >
              Sign In
            </Link>
          </div>
        </SignedOut>

        <SignedIn>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="/account/settings"
              className="rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground"
            >
              Account Settings
            </Link>
            <Link
              to="/auth/sign-out"
              className="rounded-md border border-border bg-secondary px-6 py-3 font-medium text-secondary-foreground"
            >
              Sign Out
            </Link>
          </div>
        </SignedIn>
      </section>

      {/* Auth Flows Section */}
      <section className="border-t border-border bg-card px-6 py-16 text-center">
        <h2 className="mb-4 text-2xl font-bold text-foreground">
          Try Different Auth Flows
        </h2>
        <p className="mb-8 text-muted-foreground">
          Explore all the authentication methods available.
        </p>

        <div className="mx-auto flex max-w-2xl flex-wrap justify-center gap-4">
          <Link
            to="/auth/sign-in"
            className="flex items-center gap-2 rounded-md border border-border bg-secondary px-6 py-4 font-medium text-secondary-foreground"
          >
            <span>👋</span>
            <span>Sign In</span>
          </Link>
          <Link
            to="/auth/sign-up"
            className="flex items-center gap-2 rounded-md border border-border bg-secondary px-6 py-4 font-medium text-secondary-foreground"
          >
            <span>🚀</span>
            <span>Sign Up</span>
          </Link>
          <Link
            to="/auth/forgot-password"
            className="flex items-center gap-2 rounded-md border border-border bg-secondary px-6 py-4 font-medium text-secondary-foreground"
          >
            <span>🔑</span>
            <span>Forgot Password</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
