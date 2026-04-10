#!/usr/bin/env bun

const packageName = process.argv[2];
const packageSuffix = packageName ? ` for "${packageName}"` : '';

console.error(`Error: Local releases${packageSuffix} are disabled.`);
console.error('');
console.error(
  'Releases are published through the two-stage secure publishing pipeline.'
);
console.error('');
console.error('How it works:');
console.error(
  '  Stage 1: Run the "Prepare Release" workflow in neondatabase/neon-js'
);
console.error(
  '           (workflow_dispatch). It bumps versions, commits, tags, pushes,'
);
console.error('           and uploads build artifacts.');
console.error('');
console.error(
  '  Stage 2: Run the "neon-js" workflow in secure-public-registry-releases-eng'
);
console.error(
  '           (workflow_dispatch). Point it at the tag from Stage 1.'
);
console.error(
  '           It builds from the tagged commit, scans, and publishes via OIDC.'
);
console.error('');
console.error(
  'See: https://github.com/databricks/secure-public-registry-releases-eng'
);
process.exit(1);
