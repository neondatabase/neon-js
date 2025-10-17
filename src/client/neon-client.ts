import type { AuthClient } from '@/auth/auth-interface';
import { PostgrestClient } from '@supabase/postgrest-js';

// Internal constructor options (accepts auth options at runtime)
export type NeonClientConstructorOptions<SchemaName> = {
  url: string;
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

  constructor({ url, options }: NeonClientConstructorOptions<SchemaName>) {
    super(url, {
      headers: options?.global?.headers,
      fetch: options?.global?.fetch,
      schema: options?.db?.schema,
    });
  }
}
