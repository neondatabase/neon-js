import { useParams, Link } from 'react-router-dom';
import { AuthView } from '@neondatabase/neon-js/auth/react';

export default function AuthPage() {
  const { pathname } = useParams();

  // Don't show extra UI for callback and sign-out routes
  const isMinimalView = ['callback', 'sign-out'].includes(pathname || '');

  return (
    <main style={styles.main}>
      <AuthView pathname={pathname} />

      {/* Additional info below auth card */}
      {!isMinimalView && (
        <div style={styles.footer}>
          <p style={styles.poweredBy}>
            Powered by{' '}
            <a
              href="https://better-auth.com"
              target="_blank"
              rel="noopener noreferrer"
              style={styles.linkGreen}
            >
              Better Auth
            </a>
            {' + '}
            <a
              href="https://neon.tech"
              target="_blank"
              rel="noopener noreferrer"
              style={styles.linkCyan}
            >
              Neon
            </a>
          </p>
          <Link to="/" style={styles.backLink}>
            ← Back to Home
          </Link>
        </div>
      )}
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 'calc(100vh - 64px)',
    padding: '2rem 1rem',
    gap: '1.5rem',
  },
  footer: {
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  poweredBy: {
    fontSize: '0.75rem',
    color: 'var(--muted-foreground)',
    margin: 0,
  },
  linkGreen: {
    color: 'oklch(0.696 0.17 162.48)',
    textDecoration: 'underline',
  },
  linkCyan: {
    color: 'oklch(0.715 0.143 215.221)',
    textDecoration: 'underline',
  },
  backLink: {
    color: 'var(--muted-foreground)',
    textDecoration: 'none',
    fontSize: '0.875rem',
  },
};
