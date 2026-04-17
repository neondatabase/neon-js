#!/usr/bin/env npx tsx

const packageName = process.argv[2];
const packageSuffix = packageName ? ` for "${packageName}"` : '';

console.error(`
Error: Local releases${packageSuffix} are disabled.

Releases are published through the two-stage secure publishing pipeline.

How it works:
  Stage 1: Run the "Prepare Release" workflow in neondatabase/neon-js
           (workflow_dispatch). It bumps versions, commits, tags, pushes,
           and uploads build artifacts.

  Stage 2: Run the "neon-js" workflow in secure-public-registry-releases-eng
           (workflow_dispatch). Point it at the tag from Stage 1.
           It builds from the tagged commit, scans, and publishes via OIDC.

See: https://github.com/databricks/secure-public-registry-releases-eng
`);
process.exit(1);
