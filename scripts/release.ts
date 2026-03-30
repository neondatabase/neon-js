#!/usr/bin/env bun

const packageName = process.argv[2];
const packageSuffix = packageName ? ` for "${packageName}"` : '';

console.error(`Error: Local releases${packageSuffix} are disabled.`);
console.error(
  'Use the GitHub Actions "Release" workflow on the main branch instead.'
);
console.error(
  'That workflow is the only supported implementation for version bumps, tags, lockfile updates, and publishes.'
);
process.exit(1);
