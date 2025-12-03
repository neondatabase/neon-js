# @neondatabase/neon-auth-ui

[![npm downloads](https://img.shields.io/npm/dm/@neondatabase/neon-auth-ui.svg)](https://www.npmjs.com/package/@neondatabase/neon-auth-ui)

UI components for Neon Auth built on top of [better-auth-ui](https://better-auth-ui.com).

## Installation

```bash
npm install @neondatabase/neon-auth-ui
# or
bun add @neondatabase/neon-auth-ui
```

## Usage

### 1. Import the CSS

Choose the import method based on your project setup:

#### Option A: Without Tailwind CSS (recommended for most users)

If your project doesn't use Tailwind CSS, import the pre-built CSS bundle:

```typescript
// In your root layout or app entry point
import '@neondatabase/neon-auth-ui/css';
```

This includes all necessary styles (~47KB minified) with no additional configuration required.

#### Option B: With Tailwind CSS

If your project already uses Tailwind CSS v4, import the Tailwind-ready CSS to avoid duplicate styles:

```css
/* In your main CSS file (e.g., globals.css, app.css) */
@import 'tailwindcss';
@import '@neondatabase/neon-auth-ui/tailwind';
```

This imports only the theme variables and component scanning directive. Your Tailwind build will generate the necessary utility classes, avoiding duplication with your existing Tailwind setup.

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

- ✅ **Works with or without Tailwind CSS** - Pre-built CSS bundle or Tailwind-ready import
- ✅ **Automatic React adapter** - Works with both vanilla and React Better Auth clients
- ✅ **Full better-auth-ui compatibility** - All components and utilities re-exported
- ✅ **Type-safe** - Full TypeScript support
- ✅ **Dark mode support** - Add `.dark` class to enable dark theme

## CSS Exports

| Export | Size | Use Case |
|--------|------|----------|
| `@neondatabase/neon-auth-ui/css` | ~47KB | Projects without Tailwind |
| `@neondatabase/neon-auth-ui/tailwind` | ~3KB | Projects with Tailwind CSS v4 |

## Example (Next.js App Router)

### Without Tailwind

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

### With Tailwind CSS

**app/globals.css**
```css
@import 'tailwindcss';
@import '@neondatabase/neon-auth-ui/tailwind';

/* Your custom styles... */
```

**app/layout.tsx**
```typescript
import './globals.css';
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

### Provider Setup

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

### Using Components

**app/auth/page.tsx**
```typescript
import { SignInForm } from '@neondatabase/neon-auth-ui';

export default function AuthPage() {
  return <SignInForm />;
}
```

## Customizing Theme

The CSS uses CSS custom properties for theming. Override them in your CSS:

```css
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  /* ... see theme.css for all variables */
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  /* ... dark mode overrides */
}
```

## Documentation

For component documentation, see the [better-auth-ui docs](https://better-auth-ui.com).

## Related Packages

- [`@neondatabase/neon-auth`](../neon-auth) - Authentication adapters for Neon Auth
- [`@neondatabase/neon-js`](../neon-js) - Full SDK with database and auth integration

## Support

- [GitHub Issues](https://github.com/neondatabase/neon-js/issues)
- [Neon Community Discord](https://discord.gg/H24eC2UN)

## License

Apache-2.0
