import { defineConfig } from 'tsdown';
import path from 'node:path';
import { createPackageConfig } from '../../build/tsdown-base.ts';
import { preserveDirectives } from '../../build/preserve-directives.ts';
import {
  copyPackageJsonToDist,
  copyFileSafe,
} from '../../build/build-utils.ts';

export default defineConfig(
  createPackageConfig({
    entry: ['src/index.ts', 'src/server.ts'],
    clean: false, // Don't clean dist since CSS is generated first by TailwindCSS CLI
    external: ['@neondatabase/auth'],
    plugins: [preserveDirectives()],
    noExternal: [/^@daveyplate\/better-auth-ui/],
    hooks: {
      'build:done': async () => {
        // Transform workspace:* deps and copy package.json to dist/
        copyPackageJsonToDist(import.meta.dirname, { transform: true });

        // Copy CSS type declaration to dist/
        copyFileSafe(
          path.resolve(import.meta.dirname, 'src', 'css.d.ts'),
          path.resolve(import.meta.dirname, 'dist', 'css.d.ts'),
          'css.d.ts → dist/css.d.ts'
        );
      },
    },
  })
);
