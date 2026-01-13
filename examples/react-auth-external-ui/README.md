# React + Vite with External better-auth-ui

This example demonstrates how to use `@neondatabase/auth` with [`@daveyplate/better-auth-ui`](https://better-auth-ui.com) as an external UI library, instead of using `@neondatabase/auth-ui` directly.

## When to Use This Approach

Use this pattern when you want:

- Full control over UI components and styling
- Custom routing integration (React Router, TanStack Router, etc.)
- Direct access to all UI components and hooks
- Freedom to customize or extend the authentication UI

## Requirements

Using better-auth-ui directly requires significant setup. See the [official requirements](https://better-auth-ui.com/getting-started/requirements).

You need:

- **Tailwind CSS v4** - configured in your project
- **shadcn/ui** - installed with CSS variables enabled
- **Sonner** - toast notifications configured
- **React Router** (or your routing library of choice)

### Install Dependencies

```bash
# Core packages
npm install @neondatabase/neon-js @daveyplate/better-auth-ui react-router-dom

# Peer dependencies for better-auth-ui
npm install @radix-ui/react-avatar @radix-ui/react-checkbox @radix-ui/react-dialog \
  @radix-ui/react-dropdown-menu @radix-ui/react-label @radix-ui/react-select \
  @radix-ui/react-separator @radix-ui/react-slot @radix-ui/react-tabs \
  @radix-ui/react-tooltip @hookform/resolvers class-variance-authority clsx \
  input-otp lucide-react next-themes react-hook-form sonner tailwind-merge zod

# Tailwind CSS v4
npm install tailwindcss @tailwindcss/vite

# Dev dependencies
npm install -D tw-animate-css
```

### Configure Vite

```typescript
// vite.config.ts
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### Configure Styles

```css
/* src/index.css */
@import 'tailwindcss';
@import 'tw-animate-css';
@import '@daveyplate/better-auth-ui/css';

@custom-variant dark (&:is(.dark *));

/* shadcn/ui theme variables required */
@theme inline {
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  /* ... full theme configuration */
}

:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  /* ... all CSS custom properties */
}

.dark {
  /* ... dark mode overrides */
}
```

### Set Up App Entry Point

```tsx
// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import './index.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Toaster />
      <App />
    </BrowserRouter>
  </StrictMode>
);
```

### Create the Auth Client

```typescript
// src/client.ts
import { createAuthClient } from '@neondatabase/neon-js/auth';
import { BetterAuthReactAdapter } from '@neondatabase/neon-js/auth/react';

export const neonAuthClient = createAuthClient(
  import.meta.env.VITE_NEON_AUTH_URL,
  {
    adapter: BetterAuthReactAdapter(),
  }
);
```

### Configure the Provider

```tsx
// src/providers.tsx
import { AuthUIProvider } from '@daveyplate/better-auth-ui';
import { neonAuthClient } from './client';
import { useNavigate, Link as RouterLink } from 'react-router-dom';

const Link = ({ href, className, children }) => (
  <RouterLink to={href} className={className}>
    {children}
  </RouterLink>
);

export function Providers({ children }) {
  const navigate = useNavigate();

  return (
    // @ts-expect-error - neonAuthClient is a valid auth client
    <AuthUIProvider authClient={neonAuthClient} navigate={navigate} Link={Link}>
      {children}
    </AuthUIProvider>
  );
}
```

### Configure Routes

```tsx
// src/App.tsx
import { Routes, Route } from 'react-router-dom';
import { AuthView, AccountView } from '@daveyplate/better-auth-ui';

function App() {
  return (
    <Providers>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/auth/:pathname" element={<AuthPage />} />
        <Route path="/account/:view" element={<AccountPage />} />
      </Routes>
    </Providers>
  );
}
```

## Environment Variables

```bash
VITE_NEON_AUTH_URL=https://your-project.neonauth.c-3.us-east-1.aws.neon.tech/neondb/auth
```

## Comparison with @neondatabase/auth-ui

With `@neondatabase/auth-ui`, the entire setup is:

```bash
npm install @neondatabase/neon-js
```

```tsx
import { NeonAuthUIProvider, SignInForm } from '@neondatabase/neon-js/auth/react/ui';
import '@neondatabase/neon-js/ui/css';

function App() {
  return (
    <NeonAuthUIProvider authClient={authClient}>
      <SignInForm />
    </NeonAuthUIProvider>
  );
}
```

That's it. No peer dependencies, no Tailwind setup, no shadcn/ui configuration.

Use `@neondatabase/auth-ui` for quick setup with sensible defaults. Use external `better-auth-ui` only when you need complete control over the UI and routing.

## Resources

- [better-auth-ui Documentation](https://better-auth-ui.com)
- [better-auth-ui Requirements](https://better-auth-ui.com/getting-started/requirements)
- [Neon Auth Documentation](https://neon.tech/docs/guides/neon-auth)
