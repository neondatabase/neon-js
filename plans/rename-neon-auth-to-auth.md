# Plan: Rename @neondatabase/neon-auth to @neondatabase/auth

## Overview

Rename the `@neondatabase/neon-auth` package to `@neondatabase/auth` across the entire monorepo. This is a **breaking change** affecting:
- The `neon-auth` package itself (folder rename + package name)
- All dependent packages (`neon-js`, `neon-auth-next`, `neon-auth-ui`)
- All documentation and configuration files

## Problem Statement / Motivation

The current package name `@neondatabase/neon-auth` is verbose. Shortening to `@neondatabase/auth` provides:
- Cleaner import statements
- Better alignment with typical SDK naming conventions
- Simpler developer experience

## Proposed Solution

Perform a comprehensive rename across:
1. Folder: `packages/neon-auth/` → `packages/auth/`
2. Package name: `@neondatabase/neon-auth` → `@neondatabase/auth`
3. All imports, dependencies, and references

## Technical Approach

### Dependency Graph

```
@neondatabase/neon-js
    ├── @neondatabase/neon-auth (workspace:*)  → @neondatabase/auth
    └── @neondatabase/postgrest-js

@neondatabase/neon-auth-next
    └── @neondatabase/neon-auth (workspace:*)  → @neondatabase/auth

@neondatabase/neon-auth-ui
    └── @neondatabase/neon-auth (peer dependency)  → @neondatabase/auth
```

### Implementation Phases

---

## Phase 1: Folder Rename

### 1.1 Rename Package Directory

**Task:** Rename `packages/neon-auth/` to `packages/auth/`

```bash
mv packages/neon-auth packages/auth
```

---

## Phase 2: Package Configuration Updates

### 2.1 Update Primary Package (packages/auth/package.json)

**File:** `packages/auth/package.json`

Changes:
- Line 2: `"name": "@neondatabase/neon-auth"` → `"name": "@neondatabase/auth"`
- Line 30 (release script): `'neon-auth-v%s'` → `'auth-v%s'`

### 2.2 Update Root package.json

**File:** `package.json` (root)

Changes:
- Line 10: `link:neon-js` script - update path `cd packages/neon-auth` → `cd packages/auth`
- Line 12: `dev` script filter `'@neondatabase/neon-auth'` → `'@neondatabase/auth'`
- Lines 13-15: `test`, `test:node`, `test:ci` scripts - update filter
- Line 18: `lint` script filter - update filter
- Line 20: `release` script filter - update filter
- Line 22: Script name `release:neon-auth` → `release:auth` and update args

### 2.3 Update neon-js Package

**File:** `packages/neon-js/package.json`

Changes:
- Line 57: `"@neondatabase/neon-auth": "workspace:*"` → `"@neondatabase/auth": "workspace:*"`

### 2.4 Update neon-auth-next Package

**File:** `packages/neon-auth-next/package.json`

Changes:
- Line 40: `"@neondatabase/neon-auth": "workspace:*"` → `"@neondatabase/auth": "workspace:*"`

### 2.5 Update neon-auth-ui Package

**File:** `packages/neon-auth-ui/package.json`

Changes:
- Line 93: Peer dependency `"@neondatabase/neon-auth"` → `"@neondatabase/auth"`
- Line 98: peerDependenciesMeta key `"@neondatabase/neon-auth"` → `"@neondatabase/auth"`

---

## Phase 3: TypeScript Configuration Updates

### 3.1 Update neon-js tsconfig.json

**File:** `packages/neon-js/tsconfig.json`

Changes:
- Line 9: Path mapping `"@neondatabase/neon-auth": ["../neon-auth/src"]` → `"@neondatabase/auth": ["../auth/src"]`
- Line 14: Project reference `{ "path": "../neon-auth" }` → `{ "path": "../auth" }`

### 3.2 Update neon-auth-ui tsconfig.json

**File:** `packages/neon-auth-ui/tsconfig.json`

Changes:
- Line 14: Project reference `{ "path": "../neon-auth" }` → `{ "path": "../auth" }`

---

## Phase 4: Build Configuration Updates

### 4.1 Update neon-js tsdown.config.ts

**File:** `packages/neon-js/tsdown.config.ts`

Changes:
- Line 10: External `'@neondatabase/neon-auth'` → `'@neondatabase/auth'`
- Lines 26-32: Comment and workspace name extraction logic (if applicable)

### 4.2 Update neon-auth-ui tsdown.config.ts

**File:** `packages/neon-auth-ui/tsdown.config.ts`

Changes:
- Line 10: External `'@neondatabase/neon-auth'` → `'@neondatabase/auth'`

### 4.3 Update neon-auth-next tsdown.config.ts

**File:** `packages/neon-auth-next/tsdown.config.ts`

Changes:
- Line 10: External `'@neondatabase/neon-auth'` → `'@neondatabase/auth'`

---

## Phase 5: Source Code Import Updates

### 5.1 Update neon-js Package Imports

**Files to update:**

| File | Lines | Change |
|------|-------|--------|
| `packages/neon-js/src/index.ts` | 3 | `export * from '@neondatabase/neon-auth'` → `export * from '@neondatabase/auth'` |
| `packages/neon-js/src/client/index.ts` | 24 | `from '@neondatabase/neon-auth'` → `from '@neondatabase/auth'` |
| `packages/neon-js/src/client/client-factory.ts` | 6, 13 | `from '@neondatabase/neon-auth'` → `from '@neondatabase/auth'` |
| `packages/neon-js/src/client/neon-client.ts` | 5 | `from '@neondatabase/neon-auth'` → `from '@neondatabase/auth'` |
| `packages/neon-js/src/__tests__/type-tests.ts` | 13, 128 | `from '@neondatabase/neon-auth'` → `from '@neondatabase/auth'` |

### 5.2 Update neon-auth-next Package Imports

**Files to update:**

| File | Lines | Change |
|------|-------|--------|
| `packages/neon-auth-next/src/index.ts` | 3, 5 | `from "@neondatabase/neon-auth"` and `export *` |

### 5.3 Update neon-auth-ui Package Imports

**Files to update:**

| File | Lines | Change |
|------|-------|--------|
| `packages/neon-auth-ui/src/react-adapter.ts` | 5 | `from '@neondatabase/neon-auth'` → `from '@neondatabase/auth'` |
| `packages/neon-auth-ui/src/neon-auth-ui-provider.tsx` | 10 | `from '@neondatabase/neon-auth'` → `from '@neondatabase/auth'` |

---

## Phase 6: Release Script Updates

### 6.1 Update scripts/release.ts

**File:** `scripts/release.ts`

Changes:
- Line 9: Comment `# Releases neon-auth` → `# Releases auth`
- Line 22: DEPENDENCY_GRAPH key `'neon-auth'` → `'auth'`
- Any package name validation/handling logic

---

## Phase 7: Documentation Updates

### 7.1 Update Root Documentation

**Files:**
- `README.md` - All import examples and package references
- `CLAUDE.md` - All package references and examples
- `DEVELOPMENT.md` - Package references

### 7.2 Update Package READMEs

**Files:**
- `packages/auth/README.md` - Package name, import examples, badges
- `packages/neon-js/README.md` - Dependency references, import examples
- `packages/neon-auth-ui/README.md` - Peer dependency references, import examples
- `packages/neon-auth-next/README.md` - Dependency references, import examples
- `packages/postgrest-js/README.md` - Cross-references (if any)

### 7.3 Update Internal Documentation

**Files:**
- `packages/auth/src/adapters/supabase/better-auth-plugins.md`
- `packages/auth/src/neon-auth.ts` - JSDoc comments (lines 77, 90, 104)

### 7.4 Update Changelogs

**Files:**
- `packages/auth/CHANGELOG.md` - Add rename notice
- `packages/neon-js/CHANGELOG.md` - Add dependency update notice
- `packages/neon-auth-ui/CHANGELOG.md` - Add peer dependency update notice
- `packages/neon-auth-next/CHANGELOG.md` - Add dependency update notice

---

## Phase 8: Verification

### 8.1 Dependency Resolution

```bash
# Clean install to regenerate lock file
rm -rf node_modules bun.lock
bun install
```

### 8.2 Build Verification

```bash
# Build all packages
bun run build
```

### 8.3 Type Checking

```bash
# Run type checker
bun typecheck
```

### 8.4 Test Execution

```bash
# Run all tests
bun test:node
```

### 8.5 Grep Verification

```bash
# Ensure no remaining references to old package name
git grep "@neondatabase/neon-auth" -- "*.ts" "*.tsx" "*.json" "*.md"
git grep "neon-auth" -- "package.json" "*.config.ts"
```

---

## Acceptance Criteria

### Functional Requirements

- [ ] Folder renamed from `packages/neon-auth/` to `packages/auth/`
- [ ] Package name in `packages/auth/package.json` is `@neondatabase/auth`
- [ ] All workspace dependencies updated to `@neondatabase/auth`
- [ ] All import statements updated across all packages
- [ ] All TypeScript configurations updated
- [ ] All build configurations updated
- [ ] Release script updated to handle new package name

### Quality Gates

- [ ] `bun install` completes without errors
- [ ] `bun run build` completes without errors
- [ ] `bun typecheck` completes without errors
- [ ] `bun test:node` passes all tests
- [ ] No remaining references to `@neondatabase/neon-auth` in codebase
- [ ] All documentation updated with correct package name

---

## Files Requiring Changes Summary

### Package Configuration (6 files)
1. `packages/auth/package.json` (renamed from neon-auth)
2. `package.json` (root)
3. `packages/neon-js/package.json`
4. `packages/neon-auth-next/package.json`
5. `packages/neon-auth-ui/package.json`

### TypeScript Configuration (2 files)
6. `packages/neon-js/tsconfig.json`
7. `packages/neon-auth-ui/tsconfig.json`

### Build Configuration (3 files)
8. `packages/neon-js/tsdown.config.ts`
9. `packages/neon-auth-ui/tsdown.config.ts`
10. `packages/neon-auth-next/tsdown.config.ts`

### Source Code (9 files)
11. `packages/neon-js/src/index.ts`
12. `packages/neon-js/src/client/index.ts`
13. `packages/neon-js/src/client/client-factory.ts`
14. `packages/neon-js/src/client/neon-client.ts`
15. `packages/neon-js/src/__tests__/type-tests.ts`
16. `packages/neon-auth-next/src/index.ts`
17. `packages/neon-auth-ui/src/react-adapter.ts`
18. `packages/neon-auth-ui/src/neon-auth-ui-provider.tsx`

### Release Script (1 file)
19. `scripts/release.ts`

### Documentation (10+ files)
20. `README.md` (root)
21. `CLAUDE.md` (root)
22. `DEVELOPMENT.md` (root)
23. `packages/auth/README.md`
24. `packages/neon-js/README.md`
25. `packages/neon-auth-ui/README.md`
26. `packages/neon-auth-next/README.md`
27. `packages/postgrest-js/README.md`
28. `packages/auth/CHANGELOG.md`
29. `packages/neon-js/CHANGELOG.md`
30. `packages/neon-auth-ui/CHANGELOG.md`
31. `packages/neon-auth-next/CHANGELOG.md`
32. `packages/auth/src/adapters/supabase/better-auth-plugins.md`

### Folder Structure (1 rename)
- `packages/neon-auth/` → `packages/auth/`

**Total: ~32 files + 1 folder rename**

---

## Risk Assessment

### High Risk
- **Incomplete rename**: Missing one reference will break builds
- **Cascading failures**: All dependent packages must be updated together

### Mitigation
- Use `git grep` to verify all references updated
- Run full build and test suite before committing
- Perform changes atomically in single commit

---

## References

- [Bun Workspaces Documentation](https://bun.com/docs/pm/workspaces)
- [npm Package Deprecation Guide](https://docs.npmjs.com/deprecating-and-undeprecating-packages-or-package-versions/)
