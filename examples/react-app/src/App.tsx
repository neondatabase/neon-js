import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Header } from './components/Header';

// Lazy load pages for code splitting
const HomePage = lazy(() =>
  import('./pages/HomePage').then((module) => ({ default: module.HomePage }))
);
const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((module) => ({
    default: module.DashboardPage,
  }))
);
const AccountPage = lazy(() =>
  import('./pages/AccountPage').then((module) => ({
    default: module.AccountPage,
  }))
);
const AuthPage = lazy(() => import('./pages/AuthPage'));
const IframeTestPage = lazy(() =>
  import('./pages/IframeTestPage').then((module) => ({
    default: module.IframeTestPage,
  }))
);

// Loading fallback component
function PageLoadingFallback() {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 'calc(100vh - 64px)',
        padding: '2rem',
      }}
    >
      <div
        style={{
          width: '40px',
          height: '40px',
          border: '3px solid var(--muted)',
          borderTopColor: 'var(--primary)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default function App() {
  return (
    <>
      <Header />
      <Suspense fallback={<PageLoadingFallback />}>
        <Routes>
          {/* Home */}
          <Route path="/" element={<HomePage />} />

          {/* iframe SSO Test */}
          <Route path="/iframe-test" element={<IframeTestPage />} />

          {/* Auth routes */}
          <Route path="/auth/:pathname" element={<AuthPage />} />

          {/* Protected routes */}
          <Route path="/dashboard" element={<DashboardPage />} />

          {/* Account settings */}
          <Route path="/account" element={<AccountPage />} />
          <Route path="/account/:view" element={<AccountPage />} />
        </Routes>
      </Suspense>
    </>
  );
}
