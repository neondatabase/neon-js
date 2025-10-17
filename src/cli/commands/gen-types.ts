import { parseDuration } from '@/cli/utils/parse-duration.js';
import {
  generateTypes,
  type GenerateTypesOptions,
} from '@/cli/commands/generate-types.js';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

export interface GenTypesFlags {
  dbUrl?: string;
  output: string;
  schema: string[];
  postgrestV9Compat: boolean;
  queryTimeout?: string;
}

export async function genTypes(flags: GenTypesFlags) {
  const dbUrl = flags.dbUrl?.trim();
  if (!dbUrl) {
    console.error('Error: --db-url is required');
    console.error('Run "neon-js gen-types --help" for usage information');
    process.exit(1);
  }

  const options: GenerateTypesOptions = {
    connectionString: dbUrl,
    schemas: flags.schema,
    detectOneToOneRelationships: !flags.postgrestV9Compat,
  };

  if (flags.queryTimeout) {
    try {
      options.queryTimeout = parseDuration(flags.queryTimeout);
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : error}`);
      process.exit(1);
    }
  }

  const outputPath = flags.output;

  console.log('Generating types...');
  console.log(
    `Database: ${options.connectionString.split('@')[1] || 'connected'}`
  );
  console.log(`Schemas: ${options.schemas?.join(', ') || 'public'}`);
  console.log(`Output: ${outputPath}`);

  const types = await generateTypes(options);

  const outputDir = dirname(outputPath);
  if (outputDir !== '.') {
    mkdirSync(outputDir, { recursive: true });
  }

  writeFileSync(outputPath, types);

  console.log(`✅ Types generated successfully at ${outputPath}`);
}
