# CSS Variables Theme Conflict: Auth-UI Overriding User's Tailwind Theme

---
category: ui-bugs
tags: [css, tailwind, theming, css-variables, auth-ui]
component: packages/auth-ui
severity: medium
date_solved: 2026-01-12
date_updated: 2026-01-13
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
1. Auth-UI defined standard variable names (`--primary`, `--background`) on `:root`
2. CSS specificity rules meant whichever loaded last won
3. Build tools often reorder CSS unpredictably

## Root Cause

The auth-ui package was defining CSS custom properties with standard names that conflicted with user's theme variables.

## Solution

Two-part isolation strategy using **namespaced variables** and **CSS layers**:

### 1. Namespaced CSS Variables

Use `--neon-*` prefix for all auth-ui variables to avoid naming collisions. Use the **fallback pattern** to inherit user's variables if defined:

```css
@layer neon-auth {
  :root {
    /* Respects user's --primary if defined, otherwise uses default */
    --neon-primary: var(--primary, oklch(0.205 0 0));
    --neon-background: var(--background, oklch(1 0 0));
    /* ... other variables ... */
  }

  :root.dark {
    --neon-background: var(--background, oklch(0.145 0 0));
    /* ... dark mode variables ... */
  }
}
```

**Why `:root`?** Variables need to be accessible everywhere, including portal-rendered components (modals, dropdowns, toasts) that render outside the normal component tree.

### 2. CSS Layers for Priority Control

Wrap all auth-ui styles in a named CSS layer. Layered CSS has **lower priority** than unlayered CSS, so user's styles always win.

```css
@layer neon-auth {
  /* All auth-ui styles here - user's unlayered CSS takes precedence */
}
```

### 3. Map Internal Variables to Tailwind Theme

Keep `@theme inline` at root level for Tailwind's build-time processing, referencing the namespaced variables:

```css
@theme inline {
  --color-primary: var(--neon-primary);
  --color-background: var(--neon-background);
  /* ... */
}
```

### 4. Global Base Styles (Within Layer)

Base styles are applied globally but within the `@layer neon-auth`, so user's unlayered styles always win:

```css
@layer neon-auth {
  * {
    box-sizing: border-box;
    @apply border-border outline-ring/50;
  }

  body {
    @apply text-foreground;
  }
}
```

**Why is this safe?**
- CSS layers ensure user's styles take precedence
- `--neon-*` prefix prevents variable name conflicts
- Users can override any style with unlayered CSS

## Files Changed

| File | Change |
|------|--------|
| `packages/auth-ui/src/theme.css` | Variables on `:root` with `--neon-*` prefix, wrapped in `@layer neon-auth` |

## Verification

After the fix, user's custom themes work correctly:

```css
/* User's styles - these now take precedence */
:root {
  --primary: oklch(0.7 0.2 240); /* Custom blue - PRESERVED! */
}

/* Auth-UI uses --neon-primary internally */
/* --neon-primary falls back to user's --primary if defined */
```

## Prevention Strategies

### For Library Authors

1. **Use namespace prefixes** (e.g., `--neon-*`, `--mylib-*`) for all variables
2. **Use CSS layers** (`@layer`) to give user styles priority
3. **Use fallback pattern**: `var(--user-var, default-value)`

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
- [ ] Check library components render correctly with default theme
- [ ] Verify portal components (modals, dropdowns) use correct theme

## Related Resources

- [CSS Cascade Layers (MDN)](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer)
- [CSS Custom Properties Scoping](https://css-tricks.com/a-complete-guide-to-custom-properties/)
- [Tailwind CSS v4 Theming](https://tailwindcss.com/docs/theme)

## Dark Mode Support

The fix uses a custom variant for dark mode:
```css
@custom-variant dark (&:is(.dark *));
```

And applies dark mode variables to `:root.dark`:
```css
:root.dark {
  --neon-background: var(--background, oklch(0.145 0 0));
  /* ... */
}
```

This is compatible with next-themes (which adds `.dark` to the `<html>` element).
