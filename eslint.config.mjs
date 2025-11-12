// @ts-check

import eslint from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  globalIgnores(['dist']),
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/member-ordering': [
        'warn',
        {
          default: {
            memberTypes: [
              // Static
              'public-static-field',
              'protected-static-field',
              'private-static-field',

              // Fields
              'public-instance-field',
              'protected-instance-field',
              'private-instance-field',

              // Constructor
              'constructor',

              // Methods
              'public-instance-method',
              'protected-instance-method',
              'private-instance-method',
            ],
          },
        },
      ],
    },
  }
);
