## Neon-js React Example

This is a simple example of how to use Neon-js with React.

## Covered features

- [x] Authentication
  - done through `neon-js` with `auth-ui` for components
- [x] Authorization
  - done through RLS (Row Level Security), by applying the policies in the migration
- [x] Data fetching/mutating
  - done through `neon-js`, which uses neon Data API
- [x] Database types
  - generated `database.types.ts` with `npx neon-js gen-types --db-url "postgresql://user:pass@host/db"` from the Neon DB URL


