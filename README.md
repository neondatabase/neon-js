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

This is a pnpm workspaces monorepo. See [CLAUDE.md](./CLAUDE.md) for detailed development setup.

**Quick start:**

```bash
pnpm install         # Install dependencies
pnpm dev             # Watch mode for all packages
pnpm run build       # Build all packages
pnpm test            # Run tests
pnpm typecheck       # Type check all packages
```

## Releasing

Releases use a two-stage pipeline. No GitHub App is needed.

### How it works

**Stage 1** (`prepare-release.yml` in this repo, manual `workflow_dispatch`):
1. Select the trigger package and bump type
2. The workflow bumps versions via cascade, pushes a release branch, and opens a PR
3. After manual squash merge, `post-release.yml` tags the merge commit and posts Stage 2 dispatch instructions

**Stage 2** (`neon-js.yml` in [`secure-public-registry-releases-eng`](https://github.com/databricks/secure-public-registry-releases-eng), manual `workflow_dispatch`):
1. Point it at the tag/ref from the post-release handoff
2. It checks out the tagged commit, builds from source, scans, and publishes via npm OIDC
3. If publish fails, a prominent warning is shown with remediation steps

Local releases are disabled. Running `pnpm run release` will show an error
directing you to the two-stage pipeline.

### Cascade rules

| Trigger package | Cascade                        |
| --------------- | ------------------------------ |
| `postgrest-js`  | postgrest-js, neon-js          |
| `auth-ui`       | auth-ui, auth, neon-js         |
| `auth`          | auth, neon-js                  |
| `neon-js`       | neon-js only                   |
| `all`           | postgrest-js, auth-ui, auth, neon-js |

`all` releases every public package together, while keeping independent package
versions. It bumps each package once from its own current version; it does not
force every package to share the same version number.

### Release tooling

All release logic lives inside the two GitHub Actions workflows:

- **`prepare-release.yml`** (this repo) -- bumps versions via cascade and opens the release PR
- **`post-release.yml`** (this repo) -- tags the merged release commit and writes the Stage 2 handoff
- **`neon-js.yml`** (`secure-public-registry-releases-eng`) -- checks out the tagged commit, builds from source, scans, and publishes via npm OIDC

## Support

- [GitHub Issues](https://github.com/neondatabase/neon-js/issues)
- [Neon Community Discord](https://discord.gg/H24eC2UN)

## Links

- [Neon Documentation](https://neon.com/docs/auth/overview)
- [Better Auth Documentation](https://www.better-auth.com/docs)

## License

Apache-2.0
