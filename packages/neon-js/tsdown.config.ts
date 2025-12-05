import { defineConfig } from 'tsdown';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli/index.ts'],
  format: ['esm'],
  clean: true,
  // Mark workspace packages as external so their types aren't inlined/duplicated
  external: ['@neondatabase/auth', '@neondatabase/postgrest-js'],
  dts: {
    build: true,
  },
  // Transform package.json after build - this is only needed in development mode when sym linking
  hooks: {
    'build:done': async () => {
      // Read original package.json
      const pkgPath = path.resolve(import.meta.dirname, 'package.json');
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

      // Transform workspace:* dependencies to actual versions
      if (pkg.dependencies) {
        for (const [name, version] of Object.entries(pkg.dependencies)) {
          if (typeof version === 'string' && version.startsWith('workspace:')) {
            // Extract workspace package name (e.g., 'auth' from '@neondatabase/auth')
            const workspaceName = name.split('/').pop();
            const workspacePkgPath = path.resolve(
              import.meta.dirname,
              '..',
              workspaceName as string,
              'package.json'
            );

            try {
              const workspacePkg = JSON.parse(
                readFileSync(workspacePkgPath, 'utf8')
              );
              // Replace with caret version (e.g., ^0.1.0)
              pkg.dependencies[name] = `^${workspacePkg.version}`;
              console.log(
                `✅ Resolved ${name}: ${version} → ^${workspacePkg.version}`
              );
            } catch {
              console.warn(
                `⚠️  Could not resolve workspace dependency: ${name}`
              );
            }
          }
        }
      }

      // Write transformed package.json to dist/
      const distPkgPath = path.resolve(
        import.meta.dirname,
        'dist',
        'package.json'
      );
      writeFileSync(distPkgPath, JSON.stringify(pkg, null, 2));
      console.log('✅ Copied and transformed package.json to dist/');
    },
  },
});
