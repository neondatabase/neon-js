import Link from 'next/link';

export default function Home() {
  return (
    <div className="space-y-8">
      <div className="text-center space-y-4 py-12">
        <h1 className="text-4xl font-bold">Phone Number Auth</h1>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">
          Example app demonstrating phone number OTP sign-in with Neon Auth.
        </p>
      </div>

      {/* Two-flow explanation */}
      <div className="max-w-lg mx-auto space-y-3 mb-8">
        <div className="rounded-lg border border-border bg-card p-4 space-y-1">
          <p className="text-sm font-medium">New users</p>
          <p className="text-sm text-muted-foreground">
            Sign up with email or Google, then add a phone number from the dashboard.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 space-y-1">
          <p className="text-sm font-medium">Returning users</p>
          <p className="text-sm text-muted-foreground">
            Sign in with email, Google, or your linked phone number via OTP.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg mx-auto">
        <Link
          href="/auth/sign-up"
          className="block p-4 rounded-lg border border-border hover:border-primary/50 transition-colors text-center"
        >
          <div className="font-medium">Sign Up</div>
          <div className="text-sm text-muted-foreground">Email or Google</div>
        </Link>

        <Link
          href="/auth/sign-in"
          className="block p-4 rounded-lg border border-border hover:border-primary/50 transition-colors text-center"
        >
          <div className="font-medium">Sign In</div>
          <div className="text-sm text-muted-foreground">Email, Google, or Phone</div>
        </Link>

        <Link
          href="/dashboard"
          className="block p-4 rounded-lg border border-border hover:border-primary/50 transition-colors text-center"
        >
          <div className="font-medium">Dashboard</div>
          <div className="text-sm text-muted-foreground">Profile and session info</div>
        </Link>

        <Link
          href="/webhooks"
          className="block p-4 rounded-lg border border-border hover:border-primary/50 transition-colors text-center"
        >
          <div className="font-medium">Webhooks</div>
          <div className="text-sm text-muted-foreground">Live event viewer</div>
        </Link>
      </div>
    </div>
  );
}
