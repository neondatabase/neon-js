#!/usr/bin/env bun

const packageName = process.argv[2];
const packageSuffix = packageName ? ` for "${packageName}"` : '';

console.error(`Error: Local releases${packageSuffix} are disabled.`);
console.error('');
console.error(
  'Releases are published through the centralized secure publishing pipeline.'
);
console.error('');
console.error('How it works:');
console.error('  1. Every push to main triggers the "Prepare Release" workflow');
console.error('     which builds artifacts and uploads a release bundle.');
console.error('  2. The secure repo (secure-public-registry-releases-eng) polls');
console.error('     for new bundles, scans, and publishes via npm OIDC.');
console.error('  3. The neon-js-release[bot] writes back version bumps, tags,');
console.error('     and changelog updates to this repo.');
console.error('');
console.error(
  'See: https://github.com/databricks/secure-public-registry-releases-eng'
);
process.exit(1);
