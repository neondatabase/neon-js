import {
  SignedIn,
  SignedOut,
  AuthLoading,
  UserAvatar,
} from '@neondatabase/neon-js/auth/react';
import { Link } from 'react-router-dom';
import { useContext } from 'react';
import { AuthUIContext } from '@neondatabase/neon-js/auth/react';

export function HomePage() {
  return (
    <div style={styles.container}>
      {/* Hero Section */}
      <section style={styles.hero}>
        <h1 style={styles.title}>
          <span style={styles.gradient}>Neon Auth UI</span>
          <br />
          Demo Application
        </h1>
        <p style={styles.subtitle}>
          A comprehensive demonstration of all client-side authentication
          features. Explore social logins, magic links, and more.
        </p>

        {/* Dynamic content based on auth state */}
        <AuthLoading>
          <div style={styles.loadingButtons}>
            <div style={styles.skeletonButton} />
            <div style={styles.skeletonButton} />
          </div>
        </AuthLoading>

        <SignedOut>
          <div style={styles.buttonGroup}>
            <Link to="/auth/sign-up" style={styles.primaryButton}>
              Get Started Free
            </Link>
            <Link to="/auth/sign-in" style={styles.secondaryButton}>
              Sign In
            </Link>
          </div>
        </SignedOut>

        <SignedIn>
          <WelcomeBackSection />
        </SignedIn>
      </section>

      {/* Features Section */}
      <section style={styles.features}>
        <h2 style={styles.sectionTitle}>Features Demonstrated</h2>

        <div style={styles.grid}>
          <FeatureCard
            icon="🔐"
            title="Email & Password"
            description="Traditional authentication with email and password credentials."
            link="/auth/sign-in"
          />
          <FeatureCard
            icon="🌐"
            title="Social Providers"
            description="Sign in with GitHub, Google, Discord, Apple, or Microsoft."
            link="/auth/sign-in"
          />
          <FeatureCard
            icon="🔄"
            title="Reset Password"
            description="Securely reset your password via email verification link."
            link="/auth/forgot-password"
          />
          <FeatureCard
            icon="🔐"
            title="Change Password"
            description="Update your password from account security settings."
            link="/account/security"
          />
          <FeatureCard
            icon="👤"
            title="User Settings"
            description="Comprehensive account management and profile settings."
            link="/account/settings"
          />
          <FeatureCard
            icon="👻"
            title="Anonymous Access"
            description="Browse the dashboard without an account. Anonymous tokens are generated automatically!"
            link="/dashboard"
          />
        </div>
      </section>

      {/* Auth Flows Section */}
      <section style={styles.authFlows}>
        <h2 style={styles.sectionTitle}>Try Different Auth Flows</h2>
        <p style={styles.authFlowsSubtitle}>
          Explore all the authentication methods available.
        </p>

        <div style={styles.flowButtons}>
          <AuthFlowButton to="/auth/sign-in" label="Sign In" emoji="👋" />
          <AuthFlowButton to="/auth/sign-up" label="Sign Up" emoji="🚀" />
          <AuthFlowButton
            to="/auth/forgot-password"
            label="Forgot Password"
            emoji="🔑"
          />
          <AuthFlowButton to="/dashboard" label="Try as Guest" emoji="👻" />
        </div>
      </section>
    </div>
  );
}

function WelcomeBackSection() {
  const { hooks } = useContext(AuthUIContext);
  const { data: session } = hooks.useSession();

  return (
    <div style={styles.welcomeBack}>
      <div style={styles.welcomeCard}>
        <UserAvatar user={session?.user} style={{ width: 64, height: 64 }} />
        <div>
          <p style={styles.welcomeLabel}>Welcome back,</p>
          <p style={styles.welcomeName}>
            {session?.user?.name || session?.user?.email?.split('@')[0]}
          </p>
        </div>
      </div>

      <div style={styles.buttonGroup}>
        <Link to="/dashboard" style={styles.primaryButton}>
          Go to Dashboard
        </Link>
        <Link to="/account/settings" style={styles.secondaryButton}>
          Account Settings
        </Link>
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  link,
}: {
  icon: string;
  title: string;
  description: string;
  link: string;
}) {
  return (
    <Link to={link} style={styles.featureCard}>
      <div style={styles.featureIcon}>{icon}</div>
      <h3 style={styles.featureTitle}>{title}</h3>
      <p style={styles.featureDesc}>{description}</p>
    </Link>
  );
}

function AuthFlowButton({
  to,
  label,
  emoji,
}: {
  to: string;
  label: string;
  emoji: string;
}) {
  return (
    <Link to={to} style={styles.flowButton}>
      <span style={{ fontSize: '1.25rem' }}>{emoji}</span>
      <span>{label}</span>
    </Link>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: 'calc(100vh - 64px)',
  },
  hero: {
    padding: '4rem 1.5rem',
    textAlign: 'center',
    background:
      'radial-gradient(ellipse at center, color-mix(in oklch, var(--primary) 10%, transparent) 0%, transparent 70%)',
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: 'bold',
    color: 'var(--foreground)',
    marginBottom: '1.5rem',
    lineHeight: 1.2,
  },
  gradient: {
    background: 'linear-gradient(to right, #10b981, #06b6d4)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  subtitle: {
    fontSize: '1.125rem',
    color: 'var(--muted-foreground)',
    maxWidth: '600px',
    margin: '0 auto 2rem',
  },
  loadingButtons: {
    display: 'flex',
    justifyContent: 'center',
    gap: '1rem',
  },
  skeletonButton: {
    height: '48px',
    width: '140px',
    borderRadius: 'var(--radius)',
    backgroundColor: 'var(--muted)',
  },
  buttonGroup: {
    display: 'flex',
    justifyContent: 'center',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  primaryButton: {
    backgroundColor: 'var(--primary)',
    color: 'var(--primary-foreground)',
    padding: '0.75rem 1.5rem',
    borderRadius: 'var(--radius)',
    textDecoration: 'none',
    fontWeight: 500,
    fontSize: '1rem',
  },
  secondaryButton: {
    backgroundColor: 'var(--secondary)',
    border: '1px solid var(--border)',
    color: 'var(--secondary-foreground)',
    padding: '0.75rem 1.5rem',
    borderRadius: 'var(--radius)',
    textDecoration: 'none',
    fontWeight: 500,
    fontSize: '1rem',
  },
  welcomeBack: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1.5rem',
  },
  welcomeCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    backgroundColor: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: '1rem',
    padding: '1.5rem',
  },
  welcomeLabel: {
    color: 'var(--muted-foreground)',
    fontSize: '0.875rem',
    marginBottom: '0.25rem',
  },
  welcomeName: {
    color: 'var(--card-foreground)',
    fontSize: '1.25rem',
    fontWeight: 600,
  },
  features: {
    padding: '4rem 1.5rem',
    borderTop: '1px solid var(--border)',
  },
  sectionTitle: {
    fontSize: '1.75rem',
    fontWeight: 'bold',
    color: 'var(--foreground)',
    textAlign: 'center',
    marginBottom: '2rem',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '1.5rem',
    maxWidth: '1000px',
    margin: '0 auto',
  },
  featureCard: {
    backgroundColor: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '1.5rem',
    textDecoration: 'none',
    transition: 'all 0.2s',
  },
  featureIcon: {
    fontSize: '2rem',
    marginBottom: '0.75rem',
  },
  featureTitle: {
    color: 'var(--card-foreground)',
    fontSize: '1.125rem',
    fontWeight: 600,
    marginBottom: '0.5rem',
  },
  featureDesc: {
    color: 'var(--muted-foreground)',
    fontSize: '0.875rem',
  },
  authFlows: {
    padding: '4rem 1.5rem',
    borderTop: '1px solid var(--border)',
    backgroundColor: 'var(--card)',
    textAlign: 'center',
  },
  authFlowsSubtitle: {
    color: 'var(--muted-foreground)',
    marginBottom: '2rem',
  },
  flowButtons: {
    display: 'flex',
    justifyContent: 'center',
    gap: '1rem',
    flexWrap: 'wrap',
    maxWidth: '800px',
    margin: '0 auto',
  },
  flowButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    backgroundColor: 'var(--secondary)',
    border: '1px solid var(--border)',
    color: 'var(--secondary-foreground)',
    padding: '1rem 1.5rem',
    borderRadius: 'var(--radius)',
    textDecoration: 'none',
    fontWeight: 500,
  },
};
