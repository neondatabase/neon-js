# CSS Variables Theme Conflict: Auth-UI Overriding User's Tailwind Theme

---
category: ui-bugs
tags: [css, tailwind, theming, css-variables, auth-ui]
component: packages/auth-ui
severity: medium
date_solved: 2026-01-12
---

## Problem

When integrating `@neondatabase/auth-ui` into an application with a custom Tailwind theme, the auth-ui CSS was **overriding the user's custom CSS variables** defined in `:root`.

### Symptoms

- User's custom `--primary`, `--background`, `--foreground` colors were being replaced
- Dark mode themes broke after importing auth-ui CSS
- Application-wide styling changed unexpectedly when auth-ui was included
- Buttons and UI elements outside auth components adopted auth-ui's default theme

### Example of the Problem

```css
/* User's custom theme in their app */
:root {
  --primary: oklch(0.7 0.2 240); /* Custom blue */
  --background: oklch(0.98 0 0);
}

/* Auth-UI was defining (and winning due to load order): */
:root {
  --primary: oklch(0.205 0 0);   /* Auth-UI's dark gray - OVERWRITES! */
  --background: oklch(1 0 0);
}
```

The conflict occurred because:
1. Auth-UI defined variables on `:root` (global scope)
2. CSS specificity rules meant whichever loaded last won
3. Build tools often reorder CSS unpredictably

## Root Cause

The auth-ui package was defining CSS custom properties directly on `:root`, which pollutes the global CSS namespace. Additionally, it included a global reset (`* { margin: 0; padding: 0 }`) that affected all elements in the application.

**Before (problematic code):**
```css
:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --primary: oklch(0.205 0 0);
  /* ... all other variables ... */
}

.dark {
  --background: oklch(0.145 0 0);
  /* ... dark mode variables ... */
}

@layer base {
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
}
```

## Solution

Three-part isolation strategy:

### 1. CSS Layers for Priority Control

Wrap all auth-ui styles in a named CSS layer. Layered CSS has **lower priority** than unlayered CSS, so user's styles always win.

```css
@layer neon-auth {
  /* All auth-ui styles here - user's unlayered CSS takes precedence */
}
```

### 2. Scoped CSS Variables with Namespaced Prefix

Move variables from `:root` to a scoped wrapper class (`.neon-auth-ui`) and use a `--neon-*` prefix to avoid any naming collisions.

Use the **fallback pattern** to inherit user's variables if defined:

```css
@layer neon-auth {
  .neon-auth-ui {
    /* Respects user's --primary if defined, otherwise uses default */
    --neon-primary: var(--primary, oklch(0.205 0 0));
    --neon-background: var(--background, oklch(1 0 0));
    /* ... other variables ... */
  }

  .dark .neon-auth-ui {
    --neon-background: var(--background, oklch(0.145 0 0));
    /* ... dark mode variables ... */
  }
}
```

### 3. Wrapper Component with `display: contents`

Add a wrapper `<div>` in the React provider that applies the scoping class without affecting layout:

```tsx
// NeonAuthUIProvider.tsx
export function NeonAuthUIProvider({ children, className, ...props }) {
  return (
    <div className={cn('neon-auth-ui', className)}>
      <ThemeProvider attribute="class" defaultTheme="system">
        <AuthUIProvider {...props}>
          {children}
        </AuthUIProvider>
      </ThemeProvider>
    </div>
  );
}
```

```css
.neon-auth-ui {
  display: contents; /* Invisible to layout, only provides variable scope */
}
```

### 4. Map Internal Variables to Tailwind Theme

Keep `@theme inline` at root level for Tailwind's build-time processing, but reference the namespaced variables:

```css
@theme inline {
  --color-primary: var(--neon-primary);
  --color-background: var(--neon-background);
  /* ... */
}
```

### 5. Scoped Base Styles (Required by better-auth-ui)

The better-auth-ui library expects certain base styles to be applied (border colors, outline colors, text colors). Instead of applying these globally, we scope them to the wrapper:

```css
@layer neon-auth {
  /* Base styles scoped to auth-ui components only */
  .neon-auth-ui * {
    box-sizing: border-box;
    @apply border-border outline-ring/50;
  }

  .neon-auth-ui {
    @apply text-foreground;
  }
}
```

**Why scope these styles?**

The original global version was:
```css
@layer base {
  * {
    box-sizing: border-box;
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

This caused problems because:
1. **Global `*` reset** - Overrode the host app's CSS reset, breaking carefully tuned styles
2. **`body` styles** - Modified the page body, which is not auth-ui's responsibility
3. **Applied theme colors globally** - Every element got `border-border`, not just auth components

**Why use `@layer neon-auth` instead of `@layer base`?**

- All auth-ui styles stay in ONE layer with consistent priority
- Custom layers have lower priority than Tailwind's built-in layers, so user's `@layer base` always wins
- The **selector scoping** (`.neon-auth-ui *`) provides the main isolation
- Using `@layer base` could conflict with the user's own `@layer base` styles depending on load order

## Files Changed

| File | Change |
|------|--------|
| `packages/auth-ui/src/theme.css` | Scoped variables to `.neon-auth-ui`, added `@layer neon-auth`, removed global resets |
| `packages/auth-ui/src/neon-auth-ui-provider.tsx` | Added wrapper `<div className="neon-auth-ui">` |
| `packages/auth-ui/src/utils.ts` | Added `cn()` helper for className merging |
| `packages/auth-ui/build-css.mjs` | Minor build config update |

## Verification

After the fix, user's custom themes work correctly:

```css
/* User's styles - these now take precedence */
:root {
  --primary: oklch(0.7 0.2 240); /* Custom blue - PRESERVED! */
}

/* Auth-UI components use their internal variables, falling back to defaults */
/* User's app components use user's custom --primary */
```

## Prevention Strategies

### For Library Authors

1. **Never define CSS variables on `:root`** - always scope to a wrapper class
2. **Use namespace prefixes** (e.g., `--neon-*`, `--mylib-*`) for all variables
3. **Use CSS layers** (`@layer`) to give user styles priority
4. **Avoid global resets** - let the consuming application handle resets
5. **Use fallback pattern**: `var(--user-var, default-value)`

### For Library Consumers

1. Load library CSS **before** your custom styles (or use CSS layers)
2. Use CSS layers in your own styles if you need guaranteed priority:
   ```css
   @layer vendor, app;
   @import '@neondatabase/auth-ui/css' layer(vendor);
   /* Your styles go in 'app' layer or unlayered (highest priority) */
   ```

### Testing Checklist

- [ ] Import library CSS into an app with custom `--primary`, `--background`
- [ ] Verify custom variables are not overwritten
- [ ] Test dark mode toggle preserves user's dark theme
- [ ] Inspect DevTools: library's `:root` should show NO variable definitions
- [ ] Check library components still render correctly with default theme

## Related Resources

- [CSS Cascade Layers (MDN)](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer)
- [CSS Custom Properties Scoping](https://css-tricks.com/a-complete-guide-to-custom-properties/)
- [Tailwind CSS v4 Theming](https://tailwindcss.com/docs/theme)
- Commit: `271607b fix(auth-ui): isolate CSS variables to prevent theme conflicts`

## Dark Mode Support

The fix supports multiple dark mode detection patterns:

```css
/* next-themes: adds .dark to html/body */
.dark .neon-auth-ui { ... }

/* Direct dark class on wrapper */
.neon-auth-ui.dark { ... }

/* data-theme attribute */
[data-theme="dark"] .neon-auth-ui { ... }
```
