import pkg from '../../package.json' with { type: 'json' };

// better-auth is pinned exactly (no range prefix) in package.json. The Neon Auth
// server only accepts a bare `major.minor[.patch]` string, so the pin is used as-is.
export const BETTER_AUTH_VERSION: string = pkg.dependencies['better-auth'];
