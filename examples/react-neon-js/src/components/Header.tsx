import { useState, useContext } from 'react';
import {
  SignedIn,
  SignedOut,
  UserButton,
  UserAvatar,
  AuthLoading,
  AuthUIContext,
} from '@neondatabase/neon-js/auth/react';
import { Link, NavLink } from 'react-router-dom';
import { ThemeToggle } from './ThemeToggle';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { hooks } = useContext(AuthUIContext);
  const { data: session } = hooks.useSession();

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <>
      <header style={styles.header}>
        {/* Logo / Brand */}
        <Link to="/" style={styles.brand}>
          <span style={styles.logo}>⚡</span>
          <span style={styles.brandText} className="header-brand-text">
            Neon Auth Demo
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav style={styles.nav} className="header-desktop-nav">
          <NavLink
            to="/"
            end
            style={({ isActive }) => ({
              ...styles.navLink,
              ...(isActive ? styles.navLinkActive : {}),
            })}
          >
            Home
          </NavLink>
          <NavLink
            to="/dashboard"
            style={({ isActive }) => ({
              ...styles.navLink,
              ...(isActive ? styles.navLinkActive : {}),
            })}
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/iframe-test"
            style={({ isActive }) => ({
              ...styles.navLink,
              ...(isActive ? styles.navLinkActive : {}),
            })}
          >
            Iframe Test
          </NavLink>
          <SignedIn>
            <NavLink
              to="/account/settings"
              style={({ isActive }) => ({
                ...styles.navLink,
                ...(isActive ? styles.navLinkActive : {}),
              })}
            >
              Settings
            </NavLink>
          </SignedIn>
        </nav>

        {/* Auth Section */}
        <div style={styles.authSection}>
          {/* GitHub Link */}
          <a
            href="https://github.com/pffigueiredo/neon-js-react"
            target="_blank"
            rel="noopener noreferrer"
            style={styles.iconButton}
            title="View on GitHub"
            className="header-desktop-only"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
          </a>

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Loading State */}
          <AuthLoading>
            <div style={styles.skeleton} />
          </AuthLoading>

          {/* Signed Out State - Desktop */}
          <SignedOut>
            <Link
              to="/auth/sign-in"
              style={styles.navLink}
              className="header-desktop-only"
            >
              Sign In
            </Link>
            <Link
              to="/auth/sign-up"
              style={styles.primaryButton}
              className="header-desktop-only"
            >
              Get Started
            </Link>
          </SignedOut>

          {/* Signed In State - Desktop Only */}
          <SignedIn>
            <div className="header-desktop-only">
              <UserButton />
            </div>
          </SignedIn>

          {/* Hamburger Menu Button - Mobile Only */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={styles.hamburgerButton}
            className="header-mobile-only"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          style={styles.mobileOverlay}
          onClick={closeMobileMenu}
          className="header-mobile-only"
        />
      )}

      {/* Mobile Menu Drawer */}
      <div
        style={{
          ...styles.mobileMenu,
          transform: mobileMenuOpen ? 'translateX(0)' : 'translateX(100%)',
        }}
        className="header-mobile-menu"
      >
        <nav style={styles.mobileNav}>
          <NavLink
            to="/"
            end
            onClick={closeMobileMenu}
            style={({ isActive }) => ({
              ...styles.mobileNavLink,
              ...(isActive ? styles.mobileNavLinkActive : {}),
            })}
          >
            Home
          </NavLink>
          <NavLink
            to="/dashboard"
            onClick={closeMobileMenu}
            style={({ isActive }) => ({
              ...styles.mobileNavLink,
              ...(isActive ? styles.mobileNavLinkActive : {}),
            })}
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/iframe-test"
            onClick={closeMobileMenu}
            style={({ isActive }) => ({
              ...styles.mobileNavLink,
              ...(isActive ? styles.mobileNavLinkActive : {}),
            })}
          >
            Iframe Test
          </NavLink>
          <SignedIn>
            <NavLink
              to="/account/settings"
              onClick={closeMobileMenu}
              style={({ isActive }) => ({
                ...styles.mobileNavLink,
                ...(isActive ? styles.mobileNavLinkActive : {}),
              })}
            >
              Settings
            </NavLink>
          </SignedIn>
        </nav>

        <div style={styles.mobileMenuFooter}>
          {/* User Info - Mobile */}
          <SignedIn>
            <Link
              to="/account/settings"
              onClick={closeMobileMenu}
              style={styles.mobileUserCard}
            >
              <UserAvatar
                user={session?.user}
                style={{ width: 40, height: 40, flexShrink: 0 }}
              />
              <div style={styles.mobileUserInfo}>
                <span style={styles.mobileUserName}>
                  {session?.user?.name || 'User'}
                </span>
                <span style={styles.mobileUserEmail}>
                  {session?.user?.email || 'Manage account'}
                </span>
              </div>
            </Link>
          </SignedIn>

          {/* GitHub Link */}
          <a
            href="https://github.com/pffigueiredo/neon-js-react"
            target="_blank"
            rel="noopener noreferrer"
            style={styles.mobileGithubLink}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            <span>View on GitHub</span>
          </a>

          <SignedOut>
            <div style={styles.mobileAuthButtons}>
              <Link
                to="/auth/sign-in"
                onClick={closeMobileMenu}
                style={styles.mobileSecondaryButton}
              >
                Sign In
              </Link>
              <Link
                to="/auth/sign-up"
                onClick={closeMobileMenu}
                style={styles.mobilePrimaryButton}
              >
                Get Started
              </Link>
            </div>
          </SignedOut>
        </div>
      </div>

      <style>{`
        @media (min-width: 769px) {
          .header-mobile-only {
            display: none !important;
          }
          .header-mobile-menu {
            display: none !important;
          }
        }
        
        @media (max-width: 768px) {
          .header-desktop-nav {
            display: none !important;
          }
          .header-desktop-only {
            display: none !important;
          }
          .header-brand-text {
            font-size: 1rem !important;
          }
        }
      `}</style>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 50,
    width: '100%',
    borderBottom: '1px solid var(--border)',
    backgroundColor: 'color-mix(in oklch, var(--card) 90%, transparent)',
    backdropFilter: 'blur(12px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 1.5rem',
    height: '64px',
    transition: 'background-color 0.3s ease, border-color 0.3s ease',
    boxSizing: 'border-box',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    textDecoration: 'none',
    color: 'var(--foreground)',
    flexShrink: 0,
  },
  logo: {
    fontSize: '1.5rem',
  },
  brandText: {
    fontSize: '1.125rem',
    fontWeight: 'bold',
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.5rem',
  },
  navLink: {
    color: 'var(--muted-foreground)',
    textDecoration: 'none',
    fontSize: '0.875rem',
    transition: 'color 0.2s',
  },
  navLinkActive: {
    color: 'var(--primary)',
    fontWeight: 600,
  },
  authSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  iconButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    borderRadius: 'var(--radius)',
    color: 'var(--muted-foreground)',
    transition: 'color 0.2s, background-color 0.2s',
    textDecoration: 'none',
  },
  skeleton: {
    height: '36px',
    width: '36px',
    borderRadius: '50%',
    backgroundColor: 'var(--muted)',
    animation: 'pulse 2s infinite',
  },
  primaryButton: {
    backgroundColor: 'var(--primary)',
    color: 'var(--primary-foreground)',
    padding: '0.5rem 1rem',
    borderRadius: 'var(--radius)',
    textDecoration: 'none',
    fontSize: '0.875rem',
    fontWeight: 500,
  },
  hamburgerButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    padding: 0,
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--foreground)',
    cursor: 'pointer',
    borderRadius: 'var(--radius)',
  },
  mobileOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 40,
  },
  mobileMenu: {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    width: '280px',
    maxWidth: '80vw',
    backgroundColor: 'var(--card)',
    borderLeft: '1px solid var(--border)',
    zIndex: 60,
    display: 'flex',
    flexDirection: 'column',
    transition: 'transform 0.3s ease',
    paddingTop: '80px',
  },
  mobileNav: {
    display: 'flex',
    flexDirection: 'column',
    padding: '1rem',
    gap: '0.5rem',
    flex: 1,
  },
  mobileNavLink: {
    display: 'block',
    padding: '0.875rem 1rem',
    color: 'var(--foreground)',
    textDecoration: 'none',
    fontSize: '1rem',
    borderRadius: 'var(--radius)',
    transition: 'background-color 0.2s',
  },
  mobileNavLinkActive: {
    backgroundColor: 'var(--secondary)',
    color: 'var(--primary)',
    fontWeight: 600,
  },
  mobileMenuFooter: {
    padding: '1rem',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  mobileGithubLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem 1rem',
    color: 'var(--muted-foreground)',
    textDecoration: 'none',
    fontSize: '0.875rem',
    borderRadius: 'var(--radius)',
    backgroundColor: 'var(--secondary)',
  },
  mobileAuthButtons: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  mobileSecondaryButton: {
    display: 'block',
    textAlign: 'center',
    padding: '0.75rem 1rem',
    color: 'var(--foreground)',
    textDecoration: 'none',
    fontSize: '0.875rem',
    fontWeight: 500,
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--secondary)',
  },
  mobilePrimaryButton: {
    display: 'block',
    textAlign: 'center',
    padding: '0.75rem 1rem',
    backgroundColor: 'var(--primary)',
    color: 'var(--primary-foreground)',
    textDecoration: 'none',
    fontSize: '0.875rem',
    fontWeight: 500,
    borderRadius: 'var(--radius)',
  },
  mobileUserCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem 1rem',
    backgroundColor: 'var(--secondary)',
    borderRadius: 'var(--radius)',
    textDecoration: 'none',
    marginBottom: '0.5rem',
  },
  mobileUserInfo: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  mobileUserName: {
    color: 'var(--foreground)',
    fontSize: '0.875rem',
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  mobileUserEmail: {
    color: 'var(--muted-foreground)',
    fontSize: '0.75rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
};
