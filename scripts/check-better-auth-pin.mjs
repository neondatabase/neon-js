#!/usr/bin/env node
// Fails build if root pnpm.overrides better-auth version drifts from
// packages/auth-ui/package.json's direct better-auth dep. When this
// invariant holds, the `as unknown as AuthUIProviderProps['authClient']`
// cast in neon-auth-ui-provider.tsx is safe at runtime because both
// resolved instances are byte-identical.
import {readFileSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rootPkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const uiPkg = JSON.parse(readFileSync(resolve(root, 'packages/auth-ui/package.json'), 'utf8'));

const override = rootPkg.pnpm?.overrides?.['better-auth'];
const direct = uiPkg.dependencies?.['better-auth'] ?? uiPkg.devDependencies?.['better-auth'];

if (!override) {
  console.error('pnpm.overrides.better-auth is missing in root package.json');
  process.exit(1);
}
if (!direct) {
  console.error('better-auth is not a direct dep in packages/auth-ui/package.json');
  process.exit(1);
}
if (override !== direct) {
  console.error(`better-auth version drift: pnpm.overrides=${override} vs packages/auth-ui=${direct}`);
  console.error('See neon-auth-ui-provider.tsx for why these must match.');
  process.exit(1);
}
console.log(`better-auth pin OK: ${override}`);
