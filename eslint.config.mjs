// @ts-check

import eslint from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';
import unicorn from 'eslint-plugin-unicorn';

export default defineConfig(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  unicorn.configs.recommended, // Use Unicorn's recommended preset
  globalIgnores(['**/dist/**']),
  {
    rules: {
      // Unicorn customizations (override recommended preset)
      'unicorn/filename-case': [
        'error',
        {
          case: 'kebabCase',
          ignore: [String.raw`^CLAUDE\.md$`, String.raw`^README\.md$`],
        },
      ],
      'unicorn/no-null': 'off', // Common in TypeScript
      'unicorn/no-process-exit': 'off', // CLI tools need process.exit
      'unicorn/no-array-reduce': 'warn', // Reduce strictness
      'unicorn/prevent-abbreviations': 'off', // Allow SDK abbreviations
      'unicorn/string-content': 'off',
      'unicorn/consistent-function-scoping': 'off', // Allow inline arrow functions in class methods,
      'unicorn/explicit-length-check': 'off', // Allow explicit length checks

      // TypeScript rules
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
