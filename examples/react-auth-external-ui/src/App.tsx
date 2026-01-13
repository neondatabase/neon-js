import { Routes, Route } from 'react-router-dom';
import { Header } from './components/Header';
import { Providers } from './providers';
import { HomePage } from './pages/HomePage';
import { AuthPage } from './pages/AuthPage';
import { AccountPage } from './pages/AccountPage';

function AppContent() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/auth/:pathname" element={<AuthPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/account/:view" element={<AccountPage />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <Providers>
      <AppContent />
    </Providers>
  );
}
