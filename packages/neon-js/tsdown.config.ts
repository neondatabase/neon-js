import { defineConfig } from 'tsdown';
import {
  readFileSync,
  writeFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
} from 'node:fs';
import path from 'node:path';
import { createPackageConfig } from '../../build/tsdown-base.ts';
import { preserveDirectives } from '../../build/preserve-directives.ts';

export default defineConfig(
  createPackageConfig({
    entry: [
      'src/index.ts',
      'src/cli/index.ts',
      // Auth re-export entries
      'src/auth/index.ts',
      'src/auth/react/index.ts',
      'src/auth/react/ui/index.ts',
      'src/auth/react/ui/server.ts',
      'src/auth/react/adapters/index.ts',
      'src/auth/vanilla/index.ts',
      'src/auth/vanilla/adapters/index.ts',
      'src/auth/next/index.ts',
    ],
    external: ['@neondatabase/auth', '@neondatabase/postgrest-js'],
    plugins: [
      preserveDirectives({
        clientPackages: ['@neondatabase/auth/react/ui'],
      }),
    ],
    hooks: {
      'build:done': async () => {
        // Read original package.json
        const pkgPath = path.resolve(import.meta.dirname, 'package.json');
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

        // Transform workspace:* dependencies to actual versions
        if (pkg.dependencies) {
          for (const [name, version] of Object.entries(pkg.dependencies)) {
            if (
              typeof version === 'string' &&
              version.startsWith('workspace:')
            ) {
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
        const cssTargetDir = path.join(distPath, 'ui');
        mkdirSync(cssTargetDir, { recursive: true });

        // Copy CSS files from auth/dist/ui/ to neon-js/dist/ui/
        const authCssDir = path.join(authDistPath, 'ui');
        const cssFilesToCopy = [
          { src: 'css.css', dest: 'css.css' },
          { src: 'tailwind.css', dest: 'tailwind.css' },
          { src: 'theme.css', dest: 'theme.css' },
        ];

        for (const { src, dest } of cssFilesToCopy) {
          try {
            copyFileSync(
              path.join(authCssDir, src),
              path.join(cssTargetDir, dest)
            );
            console.log(`✅ Copied ui/${src} → dist/ui/${dest}`);
          } catch (error) {
            console.warn(`⚠️  Could not copy ${src}:`, error);
          }
        }

        // Generate css.d.ts with correct module declaration for this package
        try {
          writeFileSync(
            path.join(cssTargetDir, 'css.d.ts'),
            "declare module '@neondatabase/neon-js/ui/css';\n"
          );
          console.log('✅ Generated css.d.ts → dist/ui/css.d.ts');
        } catch (error) {
          console.warn('⚠️  Could not generate css.d.ts:', error);
        }
      },
    },
  })
);
