import { PostgresMeta } from '@supabase/postgres-meta';
import { getGeneratorMetadata } from '@supabase/postgres-meta/dist/lib/generators.js';
import { apply as applyTypescriptTemplate } from '@supabase/postgres-meta/dist/server/templates/typescript.js';

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
