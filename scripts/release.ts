#!/usr/bin/env node
/**
 * This release script has been removed as part of the pnpm migration.
 * Use the pnpm scripts defined in package.json instead:
 *
 *   pnpm release              # Bump version and publish all packages
 *   pnpm release:postgrest-js
 *   pnpm release:auth
 *   pnpm release:auth-ui
 *   pnpm release:neon-js
 */

console.error('Error: scripts/release.ts is no longer used.');
console.error('Use the pnpm release scripts defined in package.json instead.');
console.error('');
console.error('  pnpm release              # Bump version and publish all packages');
console.error('  pnpm release:postgrest-js');
console.error('  pnpm release:auth');
console.error('  pnpm release:auth-ui');
console.error('  pnpm release:neon-js');
process.exit(1);
