# feat: Add auth subpath exports to @neondatabase/neon-js

**Created:** 2025-12-05
**Status:** Draft
**Category:** Enhancement

---

## Overview

Update `@neondatabase/neon-js` package to re-export all `@neondatabase/auth` package exports with an `/auth` prefix, creating a unified import experience where developers can access all Neon functionality from a single package.

## Problem Statement / Motivation

Currently, the Neon JavaScript SDK has two usage patterns:

1. **Separate packages:** Install `@neondatabase/auth` for authentication and `@neondatabase/neon-js` for database queries
2. **Root re-export:** Import auth from `@neondatabase/neon-js` root, which re-exports everything from `@neondatabase/auth`

The root re-export approach has limitations:
- **No tree-shaking:** `export * from '@neondatabase/auth'` bundles the entire auth package
- **No granular imports:** Users can't import from specific subpaths like `/react/adapters`
- **Inconsistent with auth package structure:** Auth package has well-organized subpath exports (`/react`, `/vanilla`, `/next`, etc.)

**Goal:** Allow developers to use the same import patterns from `@neondatabase/neon-js/auth/*` as they would from `@neondatabase/auth/*`.

## Proposed Solution

Mirror all `@neondatabase/auth` exports in `@neondatabase/neon-js` with an `/auth` prefix:

| Auth Package Export | Neon-JS Equivalent |
|---------------------|-------------------|
| `@neondatabase/auth` | `@neondatabase/neon-js/auth` |
| `@neondatabase/auth/react` | `@neondatabase/neon-js/auth/react` |
| `@neondatabase/auth/react/ui` | `@neondatabase/neon-js/auth/react/ui` |
| `@neondatabase/auth/react/adapters` | `@neondatabase/neon-js/auth/react/adapters` |
| `@neondatabase/auth/vanilla` | `@neondatabase/neon-js/auth/vanilla` |
| `@neondatabase/auth/vanilla/adapters` | `@neondatabase/neon-js/auth/vanilla/adapters` |
| `@neondatabase/auth/next` | `@neondatabase/neon-js/auth/next` |
| `@neondatabase/auth/react/ui/css` | `@neondatabase/neon-js/auth/react/ui/css` |
| `@neondatabase/auth/react/ui/tailwind` | `@neondatabase/neon-js/auth/react/ui/tailwind` |

---

## Technical Approach

### Current Auth Package Exports (`packages/auth/package.json`)

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.mts",
      "default": "./dist/index.mjs"
    },
    "./react": {
      "types": "./dist/react/index.d.mts",
      "default": "./dist/react/index.mjs"
    },
    "./react/ui": {
      "types": "./dist/react/ui/index.d.mts",
      "default": "./dist/react/ui/index.mjs"
    },
    "./react/adapters": {
      "types": "./dist/react/adapters/index.d.mts",
      "default": "./dist/react/adapters/index.mjs"
    },
    "./vanilla": {
      "types": "./dist/vanilla/index.d.mts",
      "default": "./dist/vanilla/index.mjs"
    },
    "./vanilla/adapters": {
      "types": "./dist/vanilla/adapters/index.d.mts",
      "default": "./dist/vanilla/adapters/index.mjs"
    },
    "./next": {
      "types": "./dist/next/index.d.mts",
      "default": "./dist/next/index.mjs"
    },
    "./react/ui/css": {
      "types": "./dist/css.d.ts",
      "default": "./dist/css.css"
    },
    "./react/ui/tailwind": {
      "default": "./dist/tailwind.css"
    }
  }
}
```

### Implementation Strategy

**Approach: Source file re-exports + package.json exports map**

Create thin re-export files in `neon-js/src/auth/` that simply re-export from `@neondatabase/auth`, then add corresponding entries to package.json exports and tsdown entry points.

#### Step 1: Create Source Directory Structure

```
packages/neon-js/src/
├── auth/
│   ├── index.ts           # Re-exports @neondatabase/auth
│   ├── react/
│   │   ├── index.ts       # Re-exports @neondatabase/auth/react
│   │   ├── ui/
│   │   │   └── index.ts   # Re-exports @neondatabase/auth/react/ui
│   │   └── adapters/
│   │       └── index.ts   # Re-exports @neondatabase/auth/react/adapters
│   ├── vanilla/
│   │   ├── index.ts       # Re-exports @neondatabase/auth/vanilla
│   │   └── adapters/
│   │       └── index.ts   # Re-exports @neondatabase/auth/vanilla/adapters
│   └── next/
│       └── index.ts       # Re-exports @neondatabase/auth/next
├── index.ts               # (existing)
├── client/                # (existing)
└── cli/                   # (existing)
```

#### Step 2: Source Files Content

**`src/auth/index.ts`**
```typescript
export * from '@neondatabase/auth';
```

**`src/auth/react/index.ts`**
```typescript
export * from '@neondatabase/auth/react';
```

**`src/auth/react/ui/index.ts`**
```typescript
export * from '@neondatabase/auth/react/ui';
```

**`src/auth/react/adapters/index.ts`**
```typescript
export * from '@neondatabase/auth/react/adapters';
```

**`src/auth/vanilla/index.ts`**
```typescript
export * from '@neondatabase/auth/vanilla';
```

**`src/auth/vanilla/adapters/index.ts`**
```typescript
export * from '@neondatabase/auth/vanilla/adapters';
```

**`src/auth/next/index.ts`**
```typescript
export * from '@neondatabase/auth/next';
```

#### Step 3: Update tsdown.config.ts Entry Points

```typescript
// packages/neon-js/tsdown.config.ts
import { defineConfig } from 'tsdown';
import { copyFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/cli/index.ts',
    // New auth re-export entries
    'src/auth/index.ts',
    'src/auth/react/index.ts',
    'src/auth/react/ui/index.ts',
    'src/auth/react/adapters/index.ts',
    'src/auth/vanilla/index.ts',
    'src/auth/vanilla/adapters/index.ts',
    'src/auth/next/index.ts',
  ],
  format: ['esm'],
  dts: true,
  external: [
    '@neondatabase/auth',
    '@neondatabase/auth-ui',
    '@neondatabase/postgrest-js',
  ],
  hooks: {
    'build:done': async () => {
      // Copy CSS files from auth package dist
      const authDistPath = join(__dirname, '../auth/dist');
      const neonJsDistPath = join(__dirname, 'dist');

      // Ensure target directory exists
      const cssTargetDir = join(neonJsDistPath, 'auth/react/ui');
      mkdirSync(cssTargetDir, { recursive: true });

      // Copy CSS files
      copyFileSync(
        join(authDistPath, 'css.css'),
        join(cssTargetDir, 'css.css')
      );
      copyFileSync(
        join(authDistPath, 'tailwind.css'),
        join(cssTargetDir, 'tailwind.css')
      );
      copyFileSync(
        join(authDistPath, 'css.d.ts'),
        join(cssTargetDir, 'css.d.ts')
      );
    },
  },
});
```

#### Step 4: Update package.json Exports

```json
{
  "name": "@neondatabase/neon-js",
  "exports": {
    ".": {
      "types": "./dist/index.d.mts",
      "default": "./dist/index.mjs"
    },
    "./client": {
      "types": "./dist/client/index.d.mts",
      "default": "./dist/client/index.mjs"
    },
    "./cli": {
      "types": "./dist/cli/index.d.mts",
      "default": "./dist/cli/index.mjs"
    },
    "./auth": {
      "types": "./dist/auth/index.d.mts",
      "default": "./dist/auth/index.mjs"
    },
    "./auth/react": {
      "types": "./dist/auth/react/index.d.mts",
      "default": "./dist/auth/react/index.mjs"
    },
    "./auth/react/ui": {
      "types": "./dist/auth/react/ui/index.d.mts",
      "default": "./dist/auth/react/ui/index.mjs"
    },
    "./auth/react/adapters": {
      "types": "./dist/auth/react/adapters/index.d.mts",
      "default": "./dist/auth/react/adapters/index.mjs"
    },
    "./auth/vanilla": {
      "types": "./dist/auth/vanilla/index.d.mts",
      "default": "./dist/auth/vanilla/index.mjs"
    },
    "./auth/vanilla/adapters": {
      "types": "./dist/auth/vanilla/adapters/index.d.mts",
      "default": "./dist/auth/vanilla/adapters/index.mjs"
    },
    "./auth/next": {
      "types": "./dist/auth/next/index.d.mts",
      "default": "./dist/auth/next/index.mjs"
    },
    "./auth/react/ui/css": {
      "types": "./dist/auth/react/ui/css.d.ts",
      "default": "./dist/auth/react/ui/css.css"
    },
    "./auth/react/ui/tailwind": {
      "default": "./dist/auth/react/ui/tailwind.css"
    }
  }
}
```

---

## Acceptance Criteria

### Functional Requirements

- [ ] All 9 auth subpath exports are accessible from `@neondatabase/neon-js/auth/*`
- [ ] CSS imports work correctly:
  - [ ] `@import '@neondatabase/neon-js/auth/react/ui/css'` works
  - [ ] `@import '@neondatabase/neon-js/auth/react/ui/tailwind'` works
- [ ] TypeScript types resolve correctly for all subpaths
- [ ] Existing root-level re-exports (`import { createAuthClient } from '@neondatabase/neon-js'`) continue to work
- [ ] Existing `/client` and `/cli` exports continue to work

### Non-Functional Requirements

- [ ] No increase in bundle size for existing root import users
- [ ] Build completes without errors
- [ ] TypeScript strict mode passes
- [ ] IDE autocomplete works for new subpaths

### Testing Requirements

- [ ] Add type tests verifying imports from all new subpaths
- [ ] Verify CSS files are copied during build
- [ ] Test imports work in a sample project

---

## Implementation Phases

### Phase 1: Source File Structure

**Files to create:**
- `packages/neon-js/src/auth/index.ts`
- `packages/neon-js/src/auth/react/index.ts`
- `packages/neon-js/src/auth/react/ui/index.ts`
- `packages/neon-js/src/auth/react/adapters/index.ts`
- `packages/neon-js/src/auth/vanilla/index.ts`
- `packages/neon-js/src/auth/vanilla/adapters/index.ts`
- `packages/neon-js/src/auth/next/index.ts`

### Phase 2: Build Configuration

**Files to modify:**
- `packages/neon-js/tsdown.config.ts` - Add entry points and CSS copy hook
- `packages/neon-js/package.json` - Add exports map entries

### Phase 3: Testing & Validation

**Files to modify/create:**
- `packages/neon-js/src/__tests__/auth-exports.test.ts` - Type tests for all exports

### Phase 4: Documentation (Optional)

- Update `CLAUDE.md` with new export structure
- Update package README with import examples

---

## Files Summary

### New Files

| File | Purpose |
|------|---------|
| `packages/neon-js/src/auth/index.ts` | Re-export `@neondatabase/auth` |
| `packages/neon-js/src/auth/react/index.ts` | Re-export `@neondatabase/auth/react` |
| `packages/neon-js/src/auth/react/ui/index.ts` | Re-export `@neondatabase/auth/react/ui` |
| `packages/neon-js/src/auth/react/adapters/index.ts` | Re-export `@neondatabase/auth/react/adapters` |
| `packages/neon-js/src/auth/vanilla/index.ts` | Re-export `@neondatabase/auth/vanilla` |
| `packages/neon-js/src/auth/vanilla/adapters/index.ts` | Re-export `@neondatabase/auth/vanilla/adapters` |
| `packages/neon-js/src/auth/next/index.ts` | Re-export `@neondatabase/auth/next` |

### Modified Files

| File | Changes |
|------|---------|
| `packages/neon-js/package.json` | Add exports map entries for `/auth/*` |
| `packages/neon-js/tsdown.config.ts` | Add entry points and CSS copy hook |

---

## Usage Examples

### After Implementation

```typescript
// Core auth
import { createAuthClient, SupabaseAuthAdapter } from '@neondatabase/neon-js/auth';

// React adapter with hooks
import { BetterAuthReactAdapter } from '@neondatabase/neon-js/auth/react/adapters';

// UI components
import { NeonAuthUIProvider, SignInForm } from '@neondatabase/neon-js/auth/react/ui';

// Vanilla adapters
import { BetterAuthVanillaAdapter } from '@neondatabase/neon-js/auth/vanilla/adapters';

// Next.js integration
import { toNextJsHandler, neonAuthMiddleware } from '@neondatabase/neon-js/auth/next';
```

**CSS Imports:**
```css
/* Without Tailwind */
@import '@neondatabase/neon-js/auth/react/ui/css';

/* With Tailwind */
@import 'tailwindcss';
@import '@neondatabase/neon-js/auth/react/ui/tailwind';
```

---

## Dependencies & Prerequisites

- `@neondatabase/auth` package must be built first (CSS files copied from its dist/)
- No new npm dependencies required
- Existing workspace dependency (`@neondatabase/auth`: `workspace:*`) already covers the dependency

---

## Backwards Compatibility

- **Root re-exports preserved:** `import { ... } from '@neondatabase/neon-js'` continues to work
- **No breaking changes:** This is purely additive
- **Migration optional:** Users can migrate at their own pace

---

## References

### Internal References
- `packages/auth/package.json:5-45` - Auth package exports configuration
- `packages/neon-js/package.json:5-15` - Current neon-js exports
- `packages/auth/tsdown.config.ts:1-40` - Auth build config with CSS copy hook

### External References
- [Node.js Package Exports Documentation](https://nodejs.org/api/packages.html)
- [TypeScript Module Resolution](https://www.typescriptlang.org/docs/handbook/modules/reference.html)
