# Neon JavaScript SDK

[![License](https://img.shields.io/npm/l/@neondatabase/neon-js.svg)](LICENSE)

> A unified TypeScript SDK for Neon Auth and Neon Data API.

## Packages

| Package | Use Case | npm |
|---------|----------|-----|
| [`@neondatabase/neon-js`](./packages/neon-js) | Full SDK: Auth + Database + UI | [![npm](https://img.shields.io/npm/v/@neondatabase/neon-js)](https://www.npmjs.com/package/@neondatabase/neon-js) |
| [`@neondatabase/auth`](./packages/auth) | Authentication + UI only | [![npm](https://img.shields.io/npm/v/@neondatabase/auth)](https://www.npmjs.com/package/@neondatabase/auth) |
| [`@neondatabase/postgrest-js`](./packages/postgrest-js) | Database queries (no auth) | [![npm](https://img.shields.io/npm/v/@neondatabase/postgrest-js)](https://www.npmjs.com/package/@neondatabase/postgrest-js) |

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
bun build            # Build all packages
bun test             # Run tests
bun typecheck        # Type check all packages
```

## Support

- [GitHub Issues](https://github.com/neondatabase/neon-js/issues)
- [Neon Community Discord](https://discord.gg/H24eC2UN)

## Links

- [Neon Documentation](https://neon.com/docs/auth/overview)
- [Better Auth Documentation](https://www.better-auth.com/docs)

## License

Apache-2.0
