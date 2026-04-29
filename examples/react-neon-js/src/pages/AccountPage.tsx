import { useParams, Link } from 'react-router-dom';
import {
  RedirectToSignIn,
  SignedIn,
  AuthLoading,
  AccountSettingsCards,
  SecuritySettingsCards,
  SessionsCard,
  ChangePasswordCard,
} from '@neondatabase/neon-js/auth/react';

type AccountView = 'settings' | 'security' | 'sessions';

export function AccountPage() {
  const { view } = useParams<{ view: string }>();
  const currentView = (view || 'settings') as AccountView;

  return (
    <>
      <RedirectToSignIn />

      <AuthLoading>
        <AccountSkeleton />
      </AuthLoading>

      <SignedIn>
        <div style={styles.container}>
          {/* Header */}
          <div style={styles.header}>
            <h1 style={styles.title}>Account Settings</h1>
            <p style={styles.subtitle}>
              Manage your account settings and preferences
            </p>
          </div>

          {/* Tab Navigation */}
          <div style={styles.tabs}>
            <TabLink to="/account/settings" active={currentView === 'settings'}>
              👤 Profile
            </TabLink>
            <TabLink to="/account/security" active={currentView === 'security'}>
              🔒 Security
            </TabLink>
            <TabLink to="/account/sessions" active={currentView === 'sessions'}>
              📱 Sessions
            </TabLink>
          </div>

          {/* Content */}
          <div style={styles.content}>
            {currentView === 'settings' && <SettingsView />}
            {currentView === 'security' && <SecurityView />}
            {currentView === 'sessions' && <SessionsView />}
          </div>
        </div>
      </SignedIn>
    </>
  );
}

function TabLink({
  to,
  active,
  children,
}: {
  to: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      style={{
        ...styles.tab,
        ...(active ? styles.tabActive : {}),
      }}
    >
      {children}
    </Link>
  );
}

function SettingsView() {
  return (
    <div style={styles.section}>
      <div style={styles.sectionCard}>
        <h2 style={styles.sectionTitle}>Profile Information</h2>
        <p style={styles.sectionDesc}>
          Update your profile picture, name, and other personal information.
        </p>
        <AccountSettingsCards />
      </div>
    </div>
  );
}

function SecurityView() {
  return (
    <div style={styles.section}>
      {/* Change Password */}
      <div style={styles.sectionCard}>
        <h2 style={styles.sectionTitle}>🔐 Change Password</h2>
        <p style={styles.sectionDesc}>
          Update your password to keep your account secure.
        </p>
        <ChangePasswordCard />
      </div>

      {/* Security Settings */}
      <div style={styles.sectionCard}>
        <h2 style={styles.sectionTitle}>Security Settings</h2>
        <p style={styles.sectionDesc}>
          Manage linked accounts and other security settings.
        </p>
        <SecuritySettingsCards />
      </div>
    </div>
  );
}

function SessionsView() {
  return (
    <div style={styles.section}>
      <div style={styles.sectionCard}>
        <h2 style={styles.sectionTitle}>Active Sessions</h2>
        <p style={styles.sectionDesc}>
          View and manage all devices that are currently signed in to your
          account.
        </p>
        <SessionsCard />
      </div>
    </div>
  );
}

function AccountSkeleton() {
  return (
    <div style={styles.container}>
      <div
        style={{
          height: 32,
          width: 200,
          backgroundColor: 'var(--muted)',
          borderRadius: 8,
          marginBottom: 32,
        }}
      />
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              height: 40,
              width: 100,
              backgroundColor: 'var(--muted)',
              borderRadius: 8,
            }}
          />
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '2rem 1.5rem',
  },
  header: {
    marginBottom: '2rem',
  },
  title: {
    fontSize: '1.875rem',
    fontWeight: 'bold',
    color: 'var(--foreground)',
    margin: 0,
    marginBottom: '0.5rem',
  },
  subtitle: {
    color: 'var(--muted-foreground)',
    margin: 0,
  },
  tabs: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '2rem',
    borderBottom: '1px solid var(--border)',
    paddingBottom: '1rem',
    flexWrap: 'wrap',
  },
  tab: {
    padding: '0.5rem 1rem',
    borderRadius: 'var(--radius)',
    color: 'var(--muted-foreground)',
    textDecoration: 'none',
    fontSize: '0.875rem',
    fontWeight: 500,
  },
  tabActive: {
    backgroundColor: 'color-mix(in oklch, var(--primary) 10%, transparent)',
    color: 'var(--primary)',
    border: '1px solid color-mix(in oklch, var(--primary) 20%, transparent)',
  },
  content: {},
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  sectionCard: {
    backgroundColor: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '1.5rem',
  },
  sectionTitle: {
    color: 'var(--card-foreground)',
    fontSize: '1.125rem',
    fontWeight: 600,
    margin: 0,
    marginBottom: '0.5rem',
  },
  sectionDesc: {
    color: 'var(--muted-foreground)',
    fontSize: '0.875rem',
    margin: 0,
    marginBottom: '1.5rem',
  },
};
