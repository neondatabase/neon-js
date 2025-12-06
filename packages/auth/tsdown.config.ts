import { defineConfig } from 'tsdown';
import { copyFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createPackageConfig } from '../../build/tsdown-base.ts';
import { preserveDirectives } from '../../build/preserve-directives.ts';

export default defineConfig(
  createPackageConfig({
    entry: [
      'src/index.ts',

      'src/react/index.ts',
      'src/react/ui/index.ts',
      'src/react/ui/server.ts',
      'src/react/adapters/index.ts',

      'src/vanilla/index.ts',
      'src/vanilla/adapters/index.ts',

      'src/next/index.ts',
    ],
    skipNodeModulesBundle: true,
    plugins: [
      preserveDirectives({
        clientPackages: ['@neondatabase/auth-ui'],
      }),
    ],
    report: {
      gzip: true,
      brotli: true,
    },
    treeshake: true,
    hooks: {
      'build:done': async () => {
        // Copy CSS files from auth-ui after build completes
        const authUiDistPath = path.resolve(
          import.meta.dirname,
          '..',
          'auth-ui',
          'dist'
        );
        const distPath = path.resolve(import.meta.dirname, 'dist');

        // Check if auth-ui dist exists (it should be built first)
        if (!existsSync(authUiDistPath)) {
          console.warn(
            '⚠️  auth-ui dist not found. Run `bun run build` in auth-ui first.'
          );
          return;
        }

        // Create target directory for CSS files
        const cssTargetDir = path.join(distPath, 'ui');
        mkdirSync(cssTargetDir, { recursive: true });

        // Copy style.css for @neondatabase/auth/ui/css
        try {
          copyFileSync(
            path.join(authUiDistPath, 'style.css'),
            path.join(cssTargetDir, 'css.css')
          );
          console.log('✅ Copied style.css → dist/ui/css.css');
        } catch (error) {
          console.warn('⚠️  Could not copy style.css:', error);
        }

        // Copy tailwind.css for @neondatabase/auth/ui/tailwind
        try {
          copyFileSync(
            path.join(authUiDistPath, 'tailwind.css'),
            path.join(cssTargetDir, 'tailwind.css')
          );
          console.log('✅ Copied tailwind.css → dist/ui/tailwind.css');
        } catch (error) {
          console.warn('⚠️  Could not copy tailwind.css:', error);
        }

        // Generate css.d.ts with correct module declaration for this package
        try {
          writeFileSync(
            path.join(cssTargetDir, 'css.d.ts'),
            "declare module '@neondatabase/auth/ui/css';\n"
          );
          console.log('✅ Generated css.d.ts → dist/ui/css.d.ts');
        } catch (error) {
          console.warn('⚠️  Could not generate css.d.ts:', error);
        }

        // Copy theme.css (required by tailwind.css)
        try {
          copyFileSync(
            path.join(authUiDistPath, 'theme.css'),
            path.join(cssTargetDir, 'theme.css')
          );
          console.log('✅ Copied theme.css → dist/ui/theme.css');
        } catch (error) {
          console.warn('⚠️  Could not copy theme.css:', error);
        }
      },
    },
  })
);
