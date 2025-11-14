import type { AuthClient } from '@neon-js/auth';
import { PostgrestClient } from '@supabase/postgrest-js';

// Internal constructor options (accepts auth options at runtime)
export type NeonClientConstructorOptions<SchemaName> = {
  dataApiUrl: string;
  options?: {
    db?: {
      schema?: Exclude<SchemaName, '__InternalSupabase'>;
    };
    global?: {
      fetch: typeof fetch;
      headers?: Record<string, string>;
    };
  };
};

export type DefaultSchemaName<Database> = 'public' extends keyof Database
  ? 'public'
  : string & keyof Database;

export class NeonClient<
  Database = any,
  SchemaName extends string & keyof Database = DefaultSchemaName<Database>,
> extends PostgrestClient<
  Database,
  { PostgrestVersion: '12' },
  Exclude<SchemaName, '__InternalSupabase'>
> {
  auth?: AuthClient;

  constructor({
    dataApiUrl,
    options,
  }: NeonClientConstructorOptions<SchemaName>) {
    super(dataApiUrl, {
      headers: options?.global?.headers,
      fetch: options?.global?.fetch,
      schema: options?.db?.schema,
    });
  }
}
