## Neon-js React Example

This is a simple example of how to use Neon-js with React.

## Covered features

- [x] Authentication
  - done through `neon-js` with `auth-ui` for components
- [x] Organizations (multi-tenancy)
  - `NeonAuthUIProvider` with `organization={{}}`, `OrganizationSwitcher`, and `/organization/:pathname` routes
  - team todos scoped to the active organization via JWT claim `o` and RLS
- [x] Personal todos
  - signed-in users can create private todos (`organization_id` IS NULL) with or without an active org
- [x] Authorization
  - Row Level Security in `migration.sql`
- [x] Data fetching/mutating
  - done through `neon-js`, which uses the Neon Data API
- [x] Database types
  - generated `database.types.ts` with `npx neon-js gen-types --db-url "postgresql://user:pass@host/db"`

## Prerequisites

1. Enable the **Organizations** plugin on your Neon Auth endpoint (Neon Console → Auth).
2. Apply the database schema:
   - **New project:** run `migration.sql`
   - **Existing project (user-owned todos):** run `migration-organization.sql`
   - **Existing project (org-only RLS):** run `migration-personal-todos.sql`

## JWT organization claim

Team todos use claim `o` on the session JWT:

```json
{
  "o": {
    "id": "<active-organization-id>",
    "slug": "<organization-slug>",
    "role": "<member-role>"
  }
}
```

RLS compares `organization_id` on team rows to `auth.jwt() -> 'o' ->> 'id'`. Personal rows keep `organization_id` NULL and are limited to `user_id = auth.user_id()`.
