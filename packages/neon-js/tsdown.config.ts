import { defineConfig } from 'tsdown';
import path from 'node:path';
import { createPackageConfig } from '../../build/tsdown-base.ts';
import { preserveDirectives } from '../../build/preserve-directives.ts';
import { copyPackageJsonToDist, copyCssBundle } from '../../build/build-utils.ts';

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
        // Transform workspace:* deps and copy package.json to dist/
        copyPackageJsonToDist(import.meta.dirname, { transform: true });

        // Copy CSS bundle from auth package
        copyCssBundle({
          sourceDir: path.resolve(import.meta.dirname, '..', 'auth', 'dist', 'ui'),
          targetDir: path.resolve(import.meta.dirname, 'dist', 'ui'),
          files: [
            { src: 'css.css', dest: 'css.css' },
            { src: 'tailwind.css', dest: 'tailwind.css' },
            { src: 'theme.css', dest: 'theme.css' },
          ],
          packageName: '@neondatabase/neon-js',
        });
      },
    },
  })
);
