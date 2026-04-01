# Neon JavaScript SDK

[![License](https://img.shields.io/npm/l/@neondatabase/neon-js.svg)](LICENSE)

> The official Neon SDK for building applications - integrates Neon Auth and Neon Data API.

## Packages

| Package                                                 | Use Case                       | npm                                                                                                                         |
| ------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| [`@neondatabase/neon-js`](./packages/neon-js)           | Full SDK: Auth + Database + UI | [![npm](https://img.shields.io/npm/v/@neondatabase/neon-js)](https://www.npmjs.com/package/@neondatabase/neon-js)           |
| [`@neondatabase/auth`](./packages/auth)                 | Authentication + UI only       | [![npm](https://img.shields.io/npm/v/@neondatabase/auth)](https://www.npmjs.com/package/@neondatabase/auth)                 |
| [`@neondatabase/postgrest-js`](./packages/postgrest-js) | Database queries (no auth)     | [![npm](https://img.shields.io/npm/v/@neondatabase/postgrest-js)](https://www.npmjs.com/package/@neondatabase/postgrest-js) |

## Which Package Should I Use?

```
Do you need authentication?
├── Yes → Do you also need database queries?
│   ├── Yes → @neondatabase/neon-js (full SDK)
│   └── No  → @neondatabase/auth
└── No  → @neondatabase/postgrest-js
```

Pre-built login forms and auth pages are included in both `neon-js` and `auth` packages.

## Quick Links

- [Full SDK Guide](./packages/neon-js/README.md)
- [Authentication Guide](./packages/auth/README.md)
- [Next.js Integration](./packages/auth/NEXT-JS.md)
- [Database Queries (No Auth)](./packages/postgrest-js/README.md)

## Development

This is a Bun workspaces monorepo. See [CLAUDE.md](./CLAUDE.md) for detailed development setup.

**Quick start:**

```bash
bun install          # Install dependencies
bun dev              # Watch mode for all packages
bun run build        # Build all packages
bun test             # Run tests
bun typecheck        # Type check all packages
```

## Releasing

Releases must be triggered from the GitHub Actions `Release` workflow on the
`main` branch. Local release scripts are intentionally blocked so version bumps,
tags, lockfile updates, and npm publishes all happen in CI.

When running the workflow:

- choose the package to release: `auth`, `auth-ui`, `postgrest-js`, or `neon-js`
- choose the bump type: `patch`, `minor`, or `major`
- the workflow applies the same bump across the full release cascade and pushes
  the final commits and tags before publishing
- the workflow rebuilds the final package artifacts, generates CycloneDX SBOMs,
  and creates GitHub artifact attestations before publish

Do not run `bun run release` or package-level `release` scripts from a local
checkout.

### Release cascade

The dependency graph determines which packages get bumped together:

```
postgrest-js → neon-js
auth-ui → auth → neon-js
```

When you release a package, all downstream dependents are bumped with the same
semver increment. For example, releasing `auth` with a `minor` bump also bumps
`neon-js` as `minor`, since `neon-js` re-exports `auth`.

| You release    | Also bumped        |
| -------------- | ------------------ |
| `postgrest-js` | `neon-js`          |
| `auth-ui`      | `auth`, `neon-js`  |
| `auth`         | `neon-js`          |
| `neon-js`      | _(none)_           |

> **Note:** The cascade is currently hardcoded in the workflow. If you add a new
> package, update the `case` statement in the "Compute release cascade" step of
> `.github/workflows/release.yml`.

## Support

- [GitHub Issues](https://github.com/neondatabase/neon-js/issues)
- [Neon Community Discord](https://discord.gg/H24eC2UN)

## Links

- [Neon Documentation](https://neon.com/docs/auth/overview)
- [Better Auth Documentation](https://www.better-auth.com/docs)

## License

Apache-2.0
