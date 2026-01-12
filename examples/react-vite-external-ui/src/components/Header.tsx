import { Link, NavLink } from 'react-router-dom';
import {
  SignedIn,
  SignedOut,
  UserButton,
  AuthLoading,
} from '@daveyplate/better-auth-ui';

export function Header() {
  return (
    <header className="sticky top-0 z-50 flex h-16 w-full items-center justify-between border-b border-border bg-card/90 px-6 backdrop-blur-xl">
      {/* Logo / Brand */}
      <Link
        to="/"
        className="flex items-center gap-2 text-foreground no-underline"
      >
        <span className="text-2xl">⚡</span>
        <span className="text-lg font-bold">External UI Demo</span>
      </Link>

      {/* Navigation */}
      <nav className="flex items-center gap-6">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `text-sm no-underline transition-colors ${isActive ? 'font-semibold text-primary' : 'text-muted-foreground'}`
          }
        >
          Home
        </NavLink>
        <SignedIn>
          <NavLink
            to="/account/settings"
            className={({ isActive }) =>
              `text-sm no-underline transition-colors ${isActive ? 'font-semibold text-primary' : 'text-muted-foreground'}`
            }
          >
            Settings
          </NavLink>
        </SignedIn>
      </nav>

      {/* Auth Section */}
      <div className="flex items-center gap-3">
        <AuthLoading>
          <div className="size-9 animate-pulse rounded-full bg-muted" />
        </AuthLoading>

        <SignedOut>
          <Link
            to="/auth/sign-in"
            className="text-sm text-muted-foreground no-underline"
          >
            Sign In
          </Link>
          <Link
            to="/auth/sign-up"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground no-underline"
          >
            Get Started
          </Link>
        </SignedOut>

        <SignedIn>
          <UserButton />
        </SignedIn>
      </div>
    </header>
  );
}
