#!/usr/bin/env npx tsx

const packageName = process.argv[2];
const packageSuffix = packageName ? ` for "${packageName}"` : '';

console.error(`
Error: Local releases${packageSuffix} are disabled.

Releases are published through the two-stage secure publishing pipeline.

How it works:
  Stage 1: Run the "Prepare Release" workflow in neondatabase/neon-js
           (workflow_dispatch). It bumps versions, pushes a release branch,
           and opens a PR. For all public packages, choose package="all".

  Handoff: After the release PR is manually squash-merged, "Post-release"
           tags the merge commit and comments with Stage 2 dispatch instructions.

  Stage 2: Run the "neon-js" workflow in secure-public-registry-releases-eng
           (workflow_dispatch). Point it at the tag from the handoff.
           It builds from the tagged commit, scans, and publishes via OIDC.

See: https://github.com/databricks/secure-public-registry-releases-eng
`);
process.exit(1);
