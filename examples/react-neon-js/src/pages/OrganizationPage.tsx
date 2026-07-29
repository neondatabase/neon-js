import { useParams, Link } from 'react-router-dom';
import { OrganizationView } from '@neondatabase/neon-js/auth/react';

export function OrganizationPage() {
  const { pathname } = useParams();

  return (
    <main style={styles.main}>
      <OrganizationView pathname={pathname} />

      <div style={styles.footer}>
        <Link to="/dashboard" style={styles.backLink}>
          ← Back to Dashboard
        </Link>
      </div>
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
  },
  backLink: {
    color: 'var(--muted-foreground)',
    textDecoration: 'none',
    fontSize: '0.875rem',
  },
};
