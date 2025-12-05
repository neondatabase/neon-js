import { defineConfig } from 'tsdown';
import {
  readFileSync,
  writeFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
} from 'node:fs';
import path from 'node:path';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/cli/index.ts',
    // Auth re-export entries
    'src/auth/index.ts',
    'src/auth/react/index.ts',
    'src/auth/react/ui/index.ts',
    'src/auth/react/adapters/index.ts',
    'src/auth/vanilla/index.ts',
    'src/auth/vanilla/adapters/index.ts',
    'src/auth/next/index.ts',
  ],
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

      // Copy CSS files from auth package dist
      const authDistPath = path.resolve(
        import.meta.dirname,
        '..',
        'auth',
        'dist'
      );
      const distPath = path.resolve(import.meta.dirname, 'dist');

      // Check if auth dist exists (it should be built first)
      if (!existsSync(authDistPath)) {
        console.warn(
          '⚠️  auth dist not found. Run `bun run build` in auth first.'
        );
        return;
      }

      // Ensure target directory exists
      const cssTargetDir = path.join(distPath, 'auth', 'react', 'ui');
      mkdirSync(cssTargetDir, { recursive: true });

      // Copy CSS files
      const cssFiles = [
        { src: 'css.css', dest: 'css.css' },
        { src: 'tailwind.css', dest: 'tailwind.css' },
        { src: 'css.d.ts', dest: 'css.d.ts' },
        { src: 'theme.css', dest: 'theme.css' },
      ];

      for (const { src, dest } of cssFiles) {
        try {
          copyFileSync(
            path.join(authDistPath, src),
            path.join(cssTargetDir, dest)
          );
          console.log(`✅ Copied ${src} → dist/auth/react/ui/${dest}`);
        } catch (error) {
          console.warn(`⚠️  Could not copy ${src}:`, error);
        }
      }
    },
  },
});
