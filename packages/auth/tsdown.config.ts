import { defineConfig } from 'tsdown';
import path from 'node:path';
import { createPackageConfig } from '../../build/tsdown-base.ts';
import { preserveDirectives } from '../../build/preserve-directives.ts';
import { copyCssBundle } from '../../build/build-utils.ts';

export default defineConfig(
  createPackageConfig({
    entry: [
      'src/index.ts',
      'src/types/index.ts',

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
        // Copy CSS bundle from auth-ui package
        copyCssBundle({
          sourceDir: path.resolve(import.meta.dirname, '..', 'auth-ui', 'dist'),
          targetDir: path.resolve(import.meta.dirname, 'dist', 'ui'),
          files: [
            { src: 'style.css', dest: 'css.css' },
            { src: 'tailwind.css', dest: 'tailwind.css' },
            { src: 'theme.css', dest: 'theme.css' },
            { src: '.safelist.html', dest: '.safelist.html' },
          ],
          packageName: '@neondatabase/auth',
        });
      },
    },
  })
);
