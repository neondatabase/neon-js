# Unified tsdown Configuration Evaluation

## Overview

Evaluate whether implementing a unified tsdown configuration makes sense for this Bun workspaces monorepo, and if so, which approach to take.

## Problem Statement

The monorepo currently has 5 packages, each with its own `tsdown.config.ts`. While this provides maximum flexibility, there's potential for:
- Configuration drift between packages
- Copy-paste errors when creating new packages
- Difficulty making monorepo-wide config changes

The question: **Would a unified or shared tsdown configuration improve maintainability without sacrificing flexibility?**

## Current State Analysis

### Package Configuration Summary

| Package | Entry Points | CSS Handling | External Deps | Special Plugins | Post-Build Hooks |
|---------|-------------|--------------|---------------|-----------------|------------------|
| **postgrest-js** | 1 | None | None | None | Copy package.json |
| **neon-auth-next** | 1 | None | `@neondatabase/auth` | None | None |
| **auth-ui** | 2 | Generates via TailwindCSS | `@neondatabase/auth` | `preserveDirectives` | Workspace resolution, copy css.d.ts |
| **auth** | 8 | Copies from auth-ui | `@neondatabase/auth-ui` | `preserveDirectives` + `clientPackages` | Copy CSS files from auth-ui |
| **neon-js** | 10 | Copies from auth | `@neondatabase/auth`, `@neondatabase/postgrest-js` | `preserveDirectives` + `clientPackages` | Workspace resolution, copy CSS from auth |

### Existing Shared Infrastructure

```
neon-js/
├── build/
│   └── preserve-directives.ts  # Shared Rolldown plugin (already exists)
├── packages/
│   ├── auth/tsdown.config.ts
│   ├── auth-ui/tsdown.config.ts
│   ├── neon-js/tsdown.config.ts
│   ├── postgrest-js/tsdown.config.ts
│   └── neon-auth-next/tsdown.config.ts
```

### Common Settings Across All Packages

```typescript
// These are identical in ALL packages:
format: ['esm']
dts: { build: true }
```

### Variable Settings

- `entry`: 1-10 entries depending on package
- `external`: Different workspace dependencies per package
- `clean`: `false` only for auth-ui (CSS pre-generated)
- `plugins`: `preserveDirectives` only for React packages
- `hooks`: Custom per-package for CSS/workspace resolution
- `treeshake`/`report`: Only in auth package

## Research Findings

### tsdown Workspace Support Status

- **Experimental** - Not recommended for production
- Built-in `workspace: true` option exists but lacks documentation
- Post-build hooks behavior in workspace mode is undocumented
- Cross-package artifact access timing is unclear

### Industry Best Practice

**Recommended: Hybrid Pattern** (shared base + per-package overrides)

This approach is used by major open-source monorepos and provides:
- Shared foundation for common settings
- Package-specific flexibility where needed
- Gradual migration path
- Easy rollback capability

### Key Constraint: CSS Build Chain

Critical dependency order that must be preserved:
```
1. auth-ui (generates CSS via TailwindCSS CLI)
   ↓
2. auth (copies CSS from auth-ui/dist)
   ↓
3. neon-js (copies CSS from auth/dist)
```

This is handled by Bun's topological sort based on workspace dependencies.

## Proposed Solution

### Recommendation: Hybrid Pattern (Minimal Base Config)

Create a shared base configuration helper that extracts only the truly common settings, while preserving per-package configs for flexibility.

### Implementation

#### 1. Create Base Config Helper

```typescript
// build/tsdown-base.ts
import { defineConfig } from 'tsdown';
import type { Options } from 'tsdown';

export interface PackageConfigOptions extends Partial<Options> {
  entry: Options['entry'];
}

/**
 * Creates a tsdown configuration with shared defaults.
 *
 * Shared defaults:
 * - format: ['esm'] (ESM-only, modern standard)
 * - dts: { build: true } (TypeScript declarations)
 * - clean: true (can be overridden)
 */
export function createPackageConfig(options: PackageConfigOptions): Options {
  return {
    format: ['esm'],
    dts: { build: true },
    clean: true,
    ...options,
  };
}
```

#### 2. Update Package Configs

**packages/postgrest-js/tsdown.config.ts** (simplest):
```typescript
import { defineConfig } from 'tsdown';
import { createPackageConfig } from '../../build/tsdown-base';

export default defineConfig(createPackageConfig({
  entry: ['src/index.ts'],
  hooks: {
    'build:done': async () => {
      // Copy package.json to dist/
    }
  }
}));
```

**packages/auth/tsdown.config.ts** (complex):
```typescript
import { defineConfig } from 'tsdown';
import { createPackageConfig } from '../../build/tsdown-base';
import { preserveDirectives } from '../../build/preserve-directives';

export default defineConfig(createPackageConfig({
  entry: [
    'src/index.ts',
    'src/react/index.ts',
    'src/react/ui/index.ts',
    // ... remaining entries
  ],
  external: ['@neondatabase/auth-ui'],
  skipNodeModulesBundle: true,
  plugins: [
    preserveDirectives({ clientPackages: ['@neondatabase/auth-ui'] })
  ],
  report: { gzip: true, brotli: true },
  treeshake: true,
  hooks: {
    'build:done': async () => {
      // Copy CSS files from auth-ui
    }
  }
}));
```

### What This Achieves

1. **Single source of truth** for ESM-only output and DTS generation
2. **Explicit overrides** - each package clearly shows its deviations
3. **Type-safe** - TypeScript catches configuration errors
4. **Minimal disruption** - post-build hooks unchanged
5. **Easy additions** - new packages extend base with clear pattern

### What This Does NOT Do

- Does NOT use tsdown's experimental workspace feature
- Does NOT consolidate post-build hooks
- Does NOT change CSS build chain
- Does NOT require changing build order

## Acceptance Criteria

- [ ] Create `build/tsdown-base.ts` with `createPackageConfig` helper
- [ ] Update all 5 package configs to use the helper
- [ ] Verify build output is identical (byte-for-byte comparison)
- [ ] Verify CSS build chain still works correctly
- [ ] Verify workspace resolution hooks still work
- [ ] Update CLAUDE.md with new pattern documentation
- [ ] All existing tests pass

## Technical Considerations

### Build Output Verification

```bash
# Before migration - capture baseline
bun build
cp -r packages/*/dist packages/*/dist-baseline

# After migration - compare
bun build
diff -r packages/auth/dist packages/auth/dist-baseline
diff -r packages/neon-js/dist packages/neon-js/dist-baseline
# etc.
```

### Migration Order

1. `postgrest-js` (simplest, no CSS, no plugins)
2. `neon-auth-next` (simple, just external deps)
3. `auth-ui` (CSS generation, preserveDirectives)
4. `auth` (complex, CSS copying, multiple entries)
5. `neon-js` (most complex, 10 entries, CSS re-export)

### Rollback Strategy

Each package can be individually reverted by removing the import and inlining settings.

## Alternative Approaches Considered

### 1. Full Unified Config (Rejected)

Using tsdown's `workspace: true`:
- **Why rejected**: Experimental, undocumented post-build hook behavior, unclear cross-package artifact timing

### 2. Status Quo (Valid Alternative)

Keep per-package configs as-is:
- **Trade-off**: Acceptable if team prefers explicitness over DRY
- **When to choose**: If config changes are rare and packages diverge significantly

### 3. Internal Config Package (Over-engineering)

Create `@internal/tsdown-config` package:
- **Why rejected**: Overkill for 5 packages, adds dependency management overhead

## Success Metrics

1. **No build regressions** - All packages build successfully
2. **Identical output** - Build artifacts unchanged
3. **Reduced duplication** - Common settings in one place
4. **Clear pattern** - New package setup is documented and obvious

## References

### Internal References
- `build/preserve-directives.ts` - Existing shared plugin pattern
- `packages/auth/tsdown.config.ts:1-50` - Most complex current config
- `packages/postgrest-js/tsdown.config.ts` - Simplest current config

### External References
- [tsdown Documentation](https://tsdown.dev/)
- [tsdown Workspace Discussion #215](https://github.com/rolldown/tsdown/discussions/215)
- [Bun Workspaces Guide](https://bun.sh/docs/install/workspaces)
- [belgattitude/nextjs-monorepo-example](https://github.com/belgattitude/nextjs-monorepo-example) - Hybrid pattern example
