import type { AuthClient } from '@/auth/auth-interface';
import { PostgrestClient } from '@supabase/postgrest-js';
import type {
  StackClientAppConstructorOptions,
  StackServerAppConstructorOptions,
} from '@stackframe/js';

// Support both client and server Stack Auth options
export type StackAuthOptions<
  HasTokenStore extends boolean = boolean,
  ProjectId extends string = string
> =
  | StackClientAppConstructorOptions<HasTokenStore, ProjectId>
  | StackServerAppConstructorOptions<HasTokenStore, ProjectId>;

// Internal constructor options (accepts auth options at runtime)
type NeonClientConstructorOptions<
  HasTokenStore extends boolean = boolean,
  ProjectId extends string = string
> = {
  url: string;
  auth: StackAuthOptions<HasTokenStore, ProjectId>;
  fetch?: typeof fetch;
};

export class NeonClient<Database = any> extends PostgrestClient<Database> {
  auth!: AuthClient;

  constructor({ url, auth, fetch: customFetch }: NeonClientConstructorOptions) {
    super(url, {
      fetch: customFetch,
    });

    // Auth will be assigned by factory after construction
  }
}
