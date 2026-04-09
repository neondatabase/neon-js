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

Releases are published through the centralized secure publishing pipeline in
[`secure-public-registry-releases-eng`](https://github.com/databricks/secure-public-registry-releases-eng).

### How it works

1. Every push to `main` triggers the **Prepare Release** workflow in this repo
2. The workflow detects changed packages, computes version bumps and cascade,
   builds artifacts, and uploads an immutable release bundle
3. The secure repo polls for new bundles, verifies integrity, scans for
   vulnerabilities, and publishes via npm OIDC Trusted Publishing
4. After publish, `neon-js-release[bot]` writes back version bumps, tags,
   and changelog updates to this repo

Local releases are disabled. Running `bun run release` will show an error
directing you to the secure pipeline.

### Cascade rules

| Trigger package | Cascade                        |
| --------------- | ------------------------------ |
| `postgrest-js`  | postgrest-js, neon-js          |
| `auth-ui`       | auth-ui, auth, neon-js         |
| `auth`          | auth, neon-js                  |
| `neon-js`       | neon-js only                   |

### Release tooling

The release logic lives in `tools/`:

- `tools/sync-versions.ts plan` -- detect changes, compute cascade, write `release-manifest.json`
- `tools/sync-versions.ts apply` -- rewrite package.json versions from the manifest
- `tools/finalize-release.ts` -- write-back script called by the secure repo after publish
- `tools/release-manifest.schema.json` -- JSON Schema contract between both repos

## Support

- [GitHub Issues](https://github.com/neondatabase/neon-js/issues)
- [Neon Community Discord](https://discord.gg/H24eC2UN)

## Links

- [Neon Documentation](https://neon.com/docs/auth/overview)
- [Better Auth Documentation](https://www.better-auth.com/docs)

## License

Apache-2.0
