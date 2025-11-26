# @neondatabase/neon-auth-ui

UI components for Neon Auth built on top of [better-auth-ui](https://better-auth-ui.com).

## Installation

```bash
npm install @neondatabase/neon-auth-ui
# or
bun add @neondatabase/neon-auth-ui
# or
pnpm add @neondatabase/neon-auth-ui
```

## Usage

### 1. Import the CSS

Add this to your root layout or app entry point:

```typescript
import '@neondatabase/neon-auth-ui/css';
```

### 2. Use the Provider

```typescript
'use client';

import { NeonAuthUIProvider } from '@neondatabase/neon-auth-ui';
import { createAuthClient } from '@neondatabase/neon-auth';

const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_AUTH_URL,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <NeonAuthUIProvider authClient={authClient}>
      {children}
    </NeonAuthUIProvider>
  );
}
```

### 3. Use Components

All components from `@daveyplate/better-auth-ui` are re-exported:

```typescript
import { 
  SignInForm, 
  SignUpForm, 
  UserButton,
  // ... all other components
} from '@neondatabase/neon-auth-ui';
```

## Features

- ✅ **No TailwindCSS required** - Complete CSS bundle included (7KB minified)
- ✅ **Automatic React adapter** - Works with both vanilla and React Better Auth clients
- ✅ **Full better-auth-ui compatibility** - All components and utilities re-exported
- ✅ **Type-safe** - Full TypeScript support

## Example (Next.js App Router)

**app/layout.tsx**
```typescript
import '@neondatabase/neon-auth-ui/css';
import { AuthProvider } from './auth-provider';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
```

**app/auth-provider.tsx**
```typescript
'use client';

import { NeonAuthUIProvider } from '@neondatabase/neon-auth-ui';
import { authClient } from './auth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <NeonAuthUIProvider authClient={authClient}>
      {children}
    </NeonAuthUIProvider>
  );
}
```

**app/auth/page.tsx**
```typescript
import { SignInForm } from '@neondatabase/neon-auth-ui';

export default function AuthPage() {
  return <SignInForm />;
}
```

## Documentation

For component documentation, see the [better-auth-ui docs](https://better-auth-ui.com).

## License

Apache-2.0
