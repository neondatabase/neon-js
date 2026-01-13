# @neondatabase/auth-ui

[![npm version](https://img.shields.io/npm/v/@neondatabase/auth-ui.svg)](https://www.npmjs.com/package/@neondatabase/auth-ui)
[![npm downloads](https://img.shields.io/npm/dm/@neondatabase/auth-ui.svg)](https://www.npmjs.com/package/@neondatabase/auth-ui)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/npm/l/@neondatabase/auth-ui.svg)](https://github.com/neondatabase/neon-js/blob/main/LICENSE)

UI components for Neon Auth built on top of [better-auth-ui](https://better-auth-ui.com).

## Installation

```bash
npm install @neondatabase/auth-ui
# or
bun add @neondatabase/auth-ui
```

## Usage

### 1. Import the CSS

Choose the import method based on your project setup:

#### Option A: Without Tailwind CSS (recommended for most users)

If your project doesn't use Tailwind CSS, import the pre-built CSS bundle:

```typescript
// In your root layout or app entry point
import '@neondatabase/auth-ui/css';
```

This includes all necessary styles (~47KB minified) with no additional configuration required.

#### Option B: With Tailwind CSS

If your project already uses Tailwind CSS v4, import the Tailwind-ready CSS to avoid duplicate styles:

```css
/* In your main CSS file (e.g., globals.css, app.css) */
@import 'tailwindcss';
@import '@neondatabase/auth-ui/tailwind';
```

This imports only the theme variables and component scanning directive. Your Tailwind build will generate the necessary utility classes, avoiding duplication with your existing Tailwind setup.

### 2. Use the Provider

The `NeonAuthUIProvider` accepts all props from `@daveyplate/better-auth-ui`'s `AuthUIProvider`, plus:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `authClient` | `NeonAuthPublicApi` | required | Auth client from `@neondatabase/auth` |
| `className` | `string` | - | Additional classes for the wrapper div |
| `defaultTheme` | `'light' \| 'dark' \| 'system'` | `'system'` | Default theme for next-themes |

#### With Next.js (Recommended)

```typescript
// lib/auth-client.ts
"use client"

import { createAuthClient } from "@neondatabase/auth/next"

export const authClient = createAuthClient()
```

```typescript
// app/providers.tsx
"use client"

import { NeonAuthUIProvider } from "@neondatabase/auth-ui"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { authClient } from "@/lib/auth-client"

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  return (
    <NeonAuthUIProvider
      authClient={authClient}
      navigate={router.push}
      replace={router.replace}
      onSessionChange={() => router.refresh()}
      emailOTP
      social={{ providers: ["google"] }}
      redirectTo="/dashboard"
      Link={Link}
      organization={{}}
    >
      {children}
    </NeonAuthUIProvider>
  )
}
```

#### With Other Frameworks

```typescript
"use client"

import { NeonAuthUIProvider } from "@neondatabase/auth-ui"
import { createAuthClient } from "@neondatabase/auth"

const authClient = createAuthClient(process.env.NEXT_PUBLIC_AUTH_URL!)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <NeonAuthUIProvider authClient={authClient}>
      {children}
    </NeonAuthUIProvider>
  )
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
} from '@neondatabase/auth-ui';
```

## Features

- ✅ **Works with or without Tailwind CSS** - Pre-built CSS bundle or Tailwind-ready import
- ✅ **Theme-safe** - Never overrides your custom CSS variables (uses fallback pattern)
- ✅ **Automatic React adapter** - Works with both vanilla and React Better Auth clients
- ✅ **Full better-auth-ui compatibility** - All components and utilities re-exported
- ✅ **Type-safe** - Full TypeScript support
- ✅ **Dark mode support** - Built-in next-themes integration

## CSS Exports

| Export | Size | Use Case |
|--------|------|----------|
| `@neondatabase/auth-ui/css` | ~47KB | Projects without Tailwind |
| `@neondatabase/auth-ui/tailwind` | ~3KB | Projects with Tailwind CSS v4 |

> **Note:** These CSS exports are also available from `@neondatabase/auth/ui/css` and `@neondatabase/neon-js/ui/css` for convenience. Choose whichever package you're already using.

## Example (Next.js App Router)

### Without Tailwind

**app/layout.tsx**
```typescript
import '@neondatabase/auth-ui/css';
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
@import '@neondatabase/auth-ui/tailwind';

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

**lib/auth-client.ts**
```typescript
"use client"

import { createAuthClient } from "@neondatabase/auth/next"

export const authClient = createAuthClient()
```

**app/providers.tsx**
```typescript
"use client"

import { NeonAuthUIProvider } from "@neondatabase/auth-ui"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { authClient } from "@/lib/auth-client"

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  return (
    <NeonAuthUIProvider
      authClient={authClient}
      navigate={router.push}
      replace={router.replace}
      onSessionChange={() => router.refresh()}
      emailOTP
      social={{ providers: ["google"] }}
      redirectTo="/dashboard"
      Link={Link}
      organization={{}}
    >
      {children}
    </NeonAuthUIProvider>
  )
}
```

### Using Components

**app/auth/[path]/page.tsx**
```typescript
import { AuthView } from "@neondatabase/auth-ui"
import { authViewPaths } from "@neondatabase/auth-ui/server"

export const dynamicParams = false

export function generateStaticParams() {
  return Object.values(authViewPaths).map((path) => ({ path }))
}

export default async function AuthPage({
  params,
}: {
  params: Promise<{ path: string }>
}) {
  const { path } = await params

  return (
    <main className="container flex grow flex-col items-center justify-center p-4">
      <AuthView path={path} />
    </main>
  )
}
```

## Customizing Theme

Neon Auth UI uses CSS custom properties for theming. **Your existing theme variables are respected** - auth-ui uses a fallback pattern that won't override your custom styles.

### How It Works

Auth-UI variables are scoped to `.neon-auth-ui` and use this pattern:
```css
--neon-primary: var(--primary, oklch(0.205 0 0));
```

This means:
1. If you define `--primary` in `:root`, auth-ui uses YOUR value
2. If you don't, auth-ui uses its default

### Core Color Tokens

Override in `:root` (light) and `.dark` (dark mode):

```css
:root {
  /* Primary - buttons, links, focus rings */
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);

  /* Secondary - secondary buttons */
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);

  /* Background/Foreground - page colors */
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);

  /* Muted - placeholders, disabled states */
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);

  /* Accent - hover states */
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);

  /* Destructive - errors, delete actions */
  --destructive: oklch(0.577 0.245 27.325);

  /* UI Elements */
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --radius: 0.625rem;
}

.dark {
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  /* ... other dark tokens */
}
```

### Token Pairing Rules

**CRITICAL:** Always override pairs together to maintain contrast.

| Background Token | Foreground Token | Min Contrast |
|-----------------|------------------|--------------|
| `--primary` | `--primary-foreground` | 4.5:1 |
| `--secondary` | `--secondary-foreground` | 4.5:1 |
| `--background` | `--foreground` | 4.5:1 |
| `--muted` | `--muted-foreground` | 4.5:1 |
| `--accent` | `--accent-foreground` | 4.5:1 |
| `--destructive` | `--destructive-foreground` | 4.5:1 |

### OKLCH Color Format

Format: `oklch(L C H)` or `oklch(L C H / alpha)`

| Parameter | Range | Description |
|-----------|-------|-------------|
| L (Lightness) | 0-1 | 0 = black, 1 = white |
| C (Chroma) | 0-0.4 | 0 = gray, higher = more vivid |
| H (Hue) | 0-360 | Color wheel degrees |
| alpha | 0-1 | Opacity |

**Convert HEX/RGB to OKLCH:** https://oklch.com

### Dark Mode Implementation

`NeonAuthUIProvider` includes next-themes by default. Control the initial theme with the `defaultTheme` prop:

```typescript
<NeonAuthUIProvider
  authClient={authClient}
  defaultTheme="dark"  // 'light' | 'dark' | 'system'
>
  {children}
</NeonAuthUIProvider>
```

#### CSS Only (System Preference)

```css
@media (prefers-color-scheme: dark) {
  :root {
    --background: oklch(0.145 0 0);
    --foreground: oklch(0.985 0 0);
  }
}
```

### Component-Specific Styling

All UI components accept `classNames` props:

```typescript
<SignInForm
  className="mx-auto max-w-md"
  classNames={{
    card: "border-primary/20",
    button: "rounded-full",
    input: "bg-muted/50",
  }}
/>
```

Available interfaces: `AuthViewClassNames`, `AuthFormClassNames`, `UserAvatarClassNames`, `UserButtonClassNames`, `SettingsCardClassNames`

## Documentation

For component documentation, see the [better-auth-ui docs](https://better-auth-ui.com).

## Related Packages

- [`@neondatabase/auth`](../auth) - Authentication adapters for Neon Auth
- [`@neondatabase/neon-js`](../neon-js) - Full SDK with database and auth integration

## Support

- [GitHub Issues](https://github.com/neondatabase/neon-js/issues)
- [Neon Community Discord](https://discord.gg/H24eC2UN)

## License

Apache-2.0
