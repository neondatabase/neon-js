import { describe, expect, test } from 'vitest';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findMissingAuthUiExports } from './migrate-auth-ui-imports.mjs';

const packageDir = resolve(fileURLToPath(import.meta.url), '..', '..');

describe('migrate-auth-ui-imports codemod', () => {
  test('covers every value export from the auth UI compatibility entrypoint', () => {
    const missingExports = findMissingAuthUiExports(
      resolve(packageDir, 'src/react/ui/index.ts')
    );

    expect(missingExports).toEqual([]);
  });
});
