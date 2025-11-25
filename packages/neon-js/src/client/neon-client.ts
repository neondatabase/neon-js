import type {
  NeonAuth,
  NeonAuthAdapter,
  NeonAuthPublicApi,
} from '@neondatabase/neon-auth';
import {
  NeonPostgrestClient,
  type NeonPostgrestClientConstructorOptions,
  type DefaultSchemaName,
} from '@neondatabase/postgrest-js';

// Constructor options for NeonClient with required auth
export type NeonClientConstructorOptions<
  SchemaName,
  TAuth extends NeonAuthAdapter = NeonAuthAdapter,
> = NeonPostgrestClientConstructorOptions<SchemaName> & {
  authClient: NeonAuth<TAuth>;
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
  TAuth extends NeonAuthAdapter = NeonAuthAdapter,
> extends NeonPostgrestClient<Database, SchemaName> {
  auth: NeonAuthPublicApi<TAuth>;

  constructor({
    dataApiUrl,
    options,
    authClient,
  }: NeonClientConstructorOptions<SchemaName, TAuth>) {
    super({ dataApiUrl, options });

    this.auth = authClient.adapter;

    console.log(this.auth);
    // Or try accessing the actual methods:
    console.log('signUp:', typeof this.auth.signUp);
    // @ts-expect-error - signIn is not a method of SupabaseAdapter
    console.log('signIn:', typeof this.auth.signIn);
    // @ts-expect-error - getSession is not a method of SupabaseAdapter
    console.log('getSession:', typeof this.auth.getSession);
  }
}

export { type DefaultSchemaName } from '@neondatabase/postgrest-js';
