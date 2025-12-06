import { defineConfig } from 'tsdown';
import { copyFileSync, existsSync } from 'node:fs';
import path from 'node:path';

export default defineConfig({
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
  format: ['esm'],
  clean: true,
  dts: {
    build: true,
  },
  // this makes sure that devDependencies are not bundled into the package
  skipNodeModulesBundle: true,

  // Shows bundle sizes after build - useful for tracking bloat.
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

      // Copy style.css for @neondatabase/auth/css
      try {
        copyFileSync(
          path.join(authUiDistPath, 'style.css'),
          path.join(distPath, 'css.css')
        );
        console.log('✅ Copied style.css → dist/css.css');
      } catch (error) {
        console.warn('⚠️  Could not copy style.css:', error);
      }

      // Copy tailwind.css for @neondatabase/auth/tailwind
      try {
        copyFileSync(
          path.join(authUiDistPath, 'tailwind.css'),
          path.join(distPath, 'tailwind.css')
        );
        console.log('✅ Copied tailwind.css → dist/tailwind.css');
      } catch (error) {
        console.warn('⚠️  Could not copy tailwind.css:', error);
      }

      // Copy css.d.ts for TypeScript types
      try {
        copyFileSync(
          path.join(authUiDistPath, 'css.d.ts'),
          path.join(distPath, 'css.d.ts')
        );
        console.log('✅ Copied css.d.ts → dist/css.d.ts');
      } catch (error) {
        console.warn('⚠️  Could not copy css.d.ts:', error);
      }

      // Copy theme.css (required by tailwind.css)
      try {
        copyFileSync(
          path.join(authUiDistPath, 'theme.css'),
          path.join(distPath, 'theme.css')
        );
        console.log('✅ Copied theme.css → dist/theme.css');
      } catch (error) {
        console.warn('⚠️  Could not copy theme.css:', error);
      }
    },
  },
});
