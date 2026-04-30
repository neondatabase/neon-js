import PostgresMeta from '../../vendor/postgres-meta/lib/PostgresMeta.js';
import { getGeneratorMetadata } from '../../vendor/postgres-meta/lib/generators.js';
import { apply as applyTypescriptTemplate } from '../../vendor/postgres-meta/templates/typescript.js';

export interface GenerateTypesOptions {
  connectionString: string;
  schemas?: string[];
  detectOneToOneRelationships?: boolean;
  queryTimeout?: number;
}

export async function generateTypes(options: GenerateTypesOptions): Promise<string> {
  const {
    connectionString,
    schemas = ['public'],
    detectOneToOneRelationships = true,
  } = options;

  const pgMeta = new PostgresMeta({ connectionString });

  try {
    const { data: metadata } = await getGeneratorMetadata(pgMeta, {
      includedSchemas: schemas,
    });

    if (!metadata) {
      throw new Error('No metadata found. Please check your database connection and schema.');
    }

    const types = await applyTypescriptTemplate({
      ...metadata,
      detectOneToOneRelationships,
    });

    return types;
  } finally {
    await pgMeta.end();
  }
}
