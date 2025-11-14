#!/usr/bin/env node

import meow from 'meow';
import { genTypes } from './commands/gen-types.js';

async function main() {
  const cli = meow(
    `
    Usage
      $ neon-js gen-types --db-url <url> [options]

    Commands
      gen-types    Generate TypeScript types from your database schema

    Required Options
      --db-url <url>              Database connection string

    Options
      --output, -o <path>         Output file path (default: database.types.ts)
      --schema, -s <name>         Schema to include (repeatable, default: public)
      --postgrest-v9-compat       Disable one-to-one relationship detection
      --query-timeout <duration>  Query timeout (default: 15s, format: 30s, 1m, 90s)

    Examples
      $ neon-js gen-types --db-url "postgresql://user:pass@host:5432/db"
      $ neon-js gen-types --db-url "postgresql://..." --output src/types/db.ts
      $ neon-js gen-types --db-url "postgresql://..." -s public -s auth
      $ neon-js gen-types --db-url "postgresql://..." --postgrest-v9-compat
      $ neon-js gen-types --db-url "postgresql://..." --query-timeout 30s
  `,
    {
      importMeta: import.meta,
      description: 'A TypeScript SDK for Neon services',
      flags: {
        dbUrl: {
          type: 'string',
          isRequired: (flags, input) => {
            // Don't require if showing help/version, or if no command provided
            if (flags.help || flags.version || input.length === 0) return false;
            return true;
          },
        },
        output: {
          type: 'string',
          shortFlag: 'o',
          default: 'database.types.ts',
        },
        schema: {
          type: 'string',
          shortFlag: 's',
          isMultiple: true,
          default: ['public'],
        },
        postgrestV9Compat: {
          type: 'boolean',
          default: false,
        },
        queryTimeout: {
          type: 'string',
        },
      },
    }
  );

  const command = cli.input[0];

  if (!command) {
    cli.showHelp(0);
    return;
  }

  // Show help if --help flag is present
  if (cli.flags.help) {
    cli.showHelp(0);
    return;
  }

  if (command === 'gen-types') {
    await genTypes(cli.flags);
  } else {
    console.error(`Unknown command: ${command}`);
    console.error('Run "neon-js --help" for usage information');
    process.exit(1);
  }
}

await main();
