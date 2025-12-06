# Alternative: Fix "use client" with preserveModules

## Problem

The `@neondatabase/auth-ui` package needs to preserve the `"use client"` directive in its bundled output for Next.js/RSC compatibility.

## Previous Attempt (Stashed)

Used post-build injection to add `"use client"` to entry points and chunks. This worked but required custom logic in multiple tsdown configs.

**Stash ref**: `use-client-directive-fix-post-build-injection`

## Alternative Approach: preserveModules

Use `preserveModules: true` in tsdown to output unbundled files, which allows `rollup-plugin-preserve-directives` to work properly.

### Why This Should Work

1. `rollup-plugin-preserve-directives` requires unbundled output (`preserveModules: true`)
2. With unbundled output, each source file becomes its own output file
3. The plugin can then preserve directives at the top of each file that has them
4. No post-build injection needed - directives flow naturally

### Implementation Steps

#### 1. Install the plugin in auth-ui

```bash
cd packages/auth-ui
bun add -D rollup-plugin-preserve-directives
```

#### 2. Update `packages/auth-ui/tsdown.config.ts`

```typescript
import { defineConfig } from 'tsdown';
import preserveDirectives from 'rollup-plugin-preserve-directives';

export default defineConfig({
  entry: ['src/index.ts', 'src/server.ts'],
  format: ['esm'],
  clean: false,
  external: ['@neondatabase/auth'],
  dts: {
    build: true,
  },

  // Enable unbundled output for directive preservation
  outputOptions: {
    preserveModules: true,
    preserveModulesRoot: 'src',
  },

  // Use rollup plugin to preserve "use client" directives
  plugins: [
    preserveDirectives({
      directives: ['use client', 'use server'],
      include: /\.(js|ts|jsx|tsx)$/,
      exclude: /node_modules/,
    }),
  ],

  // ... rest of existing config (hooks, etc.)
});
```

#### 3. Update `packages/auth/tsdown.config.ts`

Mark `@neondatabase/auth-ui` as external (no post-build injection needed):

```typescript
export default defineConfig({
  // ... existing config
  external: ['@neondatabase/auth-ui'],
  // ... no post-build "use client" injection needed
});
```

### Trade-offs

| Aspect | Bundled (current) | Unbundled (preserveModules) |
|--------|-------------------|----------------------------|
| Output files | Few (chunked) | Many (1 per source file) |
| Bundle size | Smaller (tree-shaken) | Potentially larger |
| Directive handling | Post-build injection | Native via plugin |
| Complexity | Custom build hooks | Standard plugin |

### Verification

After implementation:

```bash
# Build
bun build

# Check auth-ui output structure
ls -la packages/auth-ui/dist/

# Verify "use client" in client files
head -3 packages/auth-ui/dist/index.mjs
head -3 packages/auth-ui/dist/neon-auth-ui-provider.mjs  # or wherever it lands

# Verify NO "use client" in server files
head -3 packages/auth-ui/dist/server.mjs
```

### Potential Issues

1. **Output structure change**: The dist folder will have more files, may need to update package.json exports
2. **TypeScript declarations**: May need to adjust dts generation for unbundled output
3. **Import paths**: Internal imports may need adjustment if module structure changes

### References

- [rollup-plugin-preserve-directives](https://github.com/nicolo-ribaudo/rollup-plugin-preserve-directives)
- [tsdown outputOptions](https://tsdown.dev/reference/options#outputoptions)
- [Rolldown preserveModules](https://rolldown.rs/guide/configuration-options#output-preservemodules)
