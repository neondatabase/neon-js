import type { NeonAuthClient } from '@neondatabase/auth';
import {
  NeonPostgrestClient,
  type NeonPostgrestClientConstructorOptions,
  type DefaultSchemaName,
} from '@neondatabase/postgrest-js';

// Constructor options for NeonClient with required auth
export type NeonClientConstructorOptions<SchemaName> =
  NeonPostgrestClientConstructorOptions<SchemaName> & {
    authClient: NeonAuthClient;
  };

/**
 * Neon client with integrated authentication
 *
 * Extends NeonPostgrestClient with Neon Auth integration.
 * For auth-free clients, use @neondatabase/postgrest-js instead.
 */
export class NeonClient<
  Database = any,
  SchemaName extends string & keyof Database = DefaultSchemaName<Database>,
> extends NeonPostgrestClient<Database, SchemaName> {
  auth: NeonAuthClient;

  constructor({
    dataApiUrl,
    options,
    authClient,
  }: NeonClientConstructorOptions<SchemaName>) {
    super({ dataApiUrl, options });
    this.auth = authClient;
  }
}

export { type DefaultSchemaName } from '@neondatabase/postgrest-js';
