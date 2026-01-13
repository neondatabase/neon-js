import { useState } from 'react';

export function IframeTestPage() {
  const [iframeSrc, setIframeSrc] = useState('/auth/sign-in');

  const testRoutes = [
    { label: 'Sign In', path: '/auth/sign-in' },
    { label: 'Sign Up', path: '/auth/sign-up' },
    { label: 'Forgot Password', path: '/auth/forgot-password' },
  ];

  return (
    <main style={styles.main}>
      <div style={styles.header}>
        <h1 style={styles.title}>🧪 SSO in iframe Test</h1>
        <p style={styles.description}>
          This page embeds the auth flow in an iframe to test SSO functionality.
        </p>
        <div style={styles.featureBox}>
          <span style={styles.featureIcon}>✨</span>
          <div>
            <strong style={styles.featureTitle}>
              <a
                href="https://www.npmjs.com/package/@neondatabase/auth"
                target="_blank"
                rel="noopener noreferrer"
                style={styles.featureLink}
              >
                @neondatabase/auth
              </a>{' '}
              supports OAuth flows from within iframes
            </strong>
            <p style={styles.featureText}>
              Unlike many auth libraries that break when embedded, Neon Auth
              handles OAuth popups correctly even when your app runs inside an
              iframe — perfect for embedded apps, widgets, and multi-tenant
              platforms.
            </p>
          </div>
        </div>
      </div>

      <div style={styles.controls}>
        <span style={styles.controlLabel}>Test Route:</span>
        {testRoutes.map((route) => (
          <button
            key={route.path}
            onClick={() => setIframeSrc(route.path)}
            style={{
              ...styles.button,
              ...(iframeSrc === route.path ? styles.buttonActive : {}),
            }}
          >
            {route.label}
          </button>
        ))}
      </div>

      <div style={styles.iframeContainer}>
        <div style={styles.iframeHeader}>
          <span style={styles.iframeUrl}>iframe src: {iframeSrc}</span>
        </div>
        <iframe
          key={iframeSrc}
          src={iframeSrc}
          style={styles.iframe}
          title="Auth iframe test"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
        />
      </div>

      <div style={styles.info}>
        <h3 style={styles.infoTitle}>What to test:</h3>
        <ul style={styles.infoList}>
          <li>Click on Google/GitHub SSO buttons inside the iframe</li>
          <li>Verify the OAuth popup opens correctly</li>
          <li>
            Complete the SSO flow and check if auth completes in the iframe
          </li>
          <li>Check browser console for any errors</li>
        </ul>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    padding: '2rem',
    maxWidth: '1000px',
    margin: '0 auto',
  },
  header: {
    marginBottom: '1.5rem',
  },
  title: {
    fontSize: '1.75rem',
    fontWeight: 'bold',
    marginBottom: '0.5rem',
    color: 'var(--foreground)',
  },
  description: {
    color: 'var(--muted-foreground)',
    margin: 0,
  },
  featureBox: {
    display: 'flex',
    gap: '1rem',
    marginTop: '1.25rem',
    padding: '1rem 1.25rem',
    background:
      'linear-gradient(135deg, color-mix(in oklch, var(--primary) 10%, transparent), color-mix(in oklch, var(--primary) 5%, transparent))',
    border: '1px solid color-mix(in oklch, var(--primary) 30%, transparent)',
    borderRadius: '8px',
  },
  featureIcon: {
    fontSize: '1.5rem',
    flexShrink: 0,
  },
  featureTitle: {
    color: 'var(--foreground)',
    fontSize: '0.9375rem',
  },
  featureLink: {
    color: 'var(--primary)',
    textDecoration: 'none',
  },
  featureText: {
    color: 'var(--muted-foreground)',
    fontSize: '0.875rem',
    margin: '0.5rem 0 0 0',
    lineHeight: 1.6,
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '1rem',
    flexWrap: 'wrap',
  },
  controlLabel: {
    color: 'var(--muted-foreground)',
    fontSize: '0.875rem',
  },
  button: {
    padding: '0.5rem 1rem',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    background: 'var(--card)',
    color: 'var(--foreground)',
    cursor: 'pointer',
    fontSize: '0.875rem',
    transition: 'all 0.2s',
  },
  buttonActive: {
    background: 'var(--primary)',
    color: 'var(--primary-foreground)',
    borderColor: 'var(--primary)',
  },
  iframeContainer: {
    border: '2px solid var(--border)',
    borderRadius: '8px',
    overflow: 'hidden',
    background: 'var(--card)',
  },
  iframeHeader: {
    padding: '0.75rem 1rem',
    background: 'var(--muted)',
    borderBottom: '1px solid var(--border)',
  },
  iframeUrl: {
    fontFamily: 'monospace',
    fontSize: '0.875rem',
    color: 'var(--muted-foreground)',
  },
  iframe: {
    width: '100%',
    height: '600px',
    border: 'none',
    display: 'block',
  },
  info: {
    marginTop: '1.5rem',
    padding: '1rem',
    background: 'var(--muted)',
    borderRadius: '8px',
  },
  infoTitle: {
    margin: '0 0 0.75rem 0',
    fontSize: '1rem',
    color: 'var(--foreground)',
  },
  infoList: {
    margin: 0,
    paddingLeft: '1.25rem',
    color: 'var(--muted-foreground)',
    lineHeight: 1.8,
  },
};

export default IframeTestPage;
