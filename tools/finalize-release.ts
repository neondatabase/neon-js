#!/usr/bin/env bun

/**
 * finalize-release.ts -- Write-back script for the secure publishing repo
 *
 * Called by the central secure repo AFTER all packages have been successfully
 * published to npm. This script:
 *
 *   1. Verifies the checkout SHA matches the manifest's sourceCommitSha
 *   2. Verifies all packages exist on npm at their expected versions
 *   3. Applies the prepared versions to package.json files (via sync-versions apply)
 *   4. Updates CHANGELOG.md
 *   5. Commits with [skip ci] to prevent re-triggering prepare-release
 *   6. Creates annotated tags (one per package)
 *   7. Pushes via the provided GITHUB_TOKEN (GitHub App token)
 *
 * Usage:
 *   bun tools/finalize-release.ts \
 *     --manifest <path-to-release-manifest.json> \
 *     --repo-dir <path-to-neon-js-checkout>
 *
 * Environment:
 *   GITHUB_TOKEN -- GitHub App token for push and release creation
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Types (matches release-manifest.schema.json)
// ---------------------------------------------------------------------------

interface InternalDepUpdate {
  dependencyName: string;
  fromVersion: string;
  toVersion: string;
}

interface PackageEntry {
  packageId: string;
  packageName: string;
  packageDir: string;
  currentVersion: string;
  nextVersion: string;
  bumpType: string;
  directChange: boolean;
  cascadeFrom: string | null;
  publishOrder: number;
  tagName: string;
  tarballFilename: string;
  internalDependencyUpdates: InternalDepUpdate[];
}

interface ReleaseManifest {
  schemaVersion: string;
  sourceRepo: string;
  sourceCommitSha: string;
  sourceBranch: string;
  prepareWorkflowName: string;
  prepareRunId: string;
  prepareRunAttempt: string;
  generatedAt: string;
  packages: PackageEntry[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseArgs(): { manifestPath: string; repoDir: string } {
  const args = process.argv.slice(2);
  let manifestPath = "";
  let repoDir = "";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--manifest" && args[i + 1]) {
      manifestPath = path.resolve(args[++i]);
    } else if (args[i] === "--repo-dir" && args[i + 1]) {
      repoDir = path.resolve(args[++i]);
    }
  }

  if (!manifestPath || !repoDir) {
    console.error(
      "Usage: bun tools/finalize-release.ts --manifest <path> --repo-dir <path>"
    );
    process.exit(1);
  }

  return { manifestPath, repoDir };
}

function git(args: string, cwd: string): string {
  return execSync(`git ${args}`, { cwd, encoding: "utf8" }).trim();
}

function run(cmd: string, cwd: string): void {
  execSync(cmd, { cwd, stdio: "inherit" });
}

/**
 * Check whether a specific package@version exists on npm.
 */
async function npmVersionExists(
  packageName: string,
  version: string
): Promise<boolean> {
  try {
    execSync(`npm view ${packageName}@${version} version`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { manifestPath, repoDir } = parseArgs();
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    console.error("GITHUB_TOKEN environment variable is required.");
    process.exit(1);
  }

  if (!existsSync(manifestPath)) {
    console.error(`Manifest not found: ${manifestPath}`);
    process.exit(1);
  }

  const manifest: ReleaseManifest = JSON.parse(
    readFileSync(manifestPath, "utf8")
  );

  // -----------------------------------------------------------------------
  // 1. Verify checkout SHA
  // -----------------------------------------------------------------------
  const headSha = git("rev-parse HEAD", repoDir);
  if (headSha !== manifest.sourceCommitSha) {
    console.error(
      `SHA mismatch: checkout is ${headSha}, manifest expects ${manifest.sourceCommitSha}`
    );
    process.exit(1);
  }
  console.log(`Verified checkout SHA: ${headSha}`);

  // -----------------------------------------------------------------------
  // 2. Verify all packages are published on npm
  // -----------------------------------------------------------------------
  console.log("Verifying npm publish status...");
  for (const pkg of manifest.packages) {
    const exists = await npmVersionExists(pkg.packageName, pkg.nextVersion);
    if (!exists) {
      console.error(
        `${pkg.packageName}@${pkg.nextVersion} not found on npm. ` +
          "Finalize requires all packages to be published first."
      );
      process.exit(1);
    }
    console.log(`  ${pkg.packageName}@${pkg.nextVersion} -- published`);
  }

  // -----------------------------------------------------------------------
  // 3. Apply versions (rewrite package.json files)
  // -----------------------------------------------------------------------
  console.log("Applying versions from manifest...");

  // Copy manifest into the repo so sync-versions can find it
  const repoManifestPath = path.join(repoDir, "release-manifest.json");
  writeFileSync(repoManifestPath, readFileSync(manifestPath, "utf8"));

  run("bun tools/sync-versions.ts apply", repoDir);

  // -----------------------------------------------------------------------
  // 4. Update CHANGELOG.md
  // -----------------------------------------------------------------------
  console.log("Updating CHANGELOG.md...");
  const changelogPath = path.join(repoDir, "CHANGELOG.md");
  const date = new Date().toISOString().split("T")[0];
  const entries: string[] = [];

  for (const pkg of manifest.packages) {
    entries.push(
      `### ${pkg.packageName} v${pkg.nextVersion}\n\n` +
        `- ${pkg.directChange ? "Direct changes" : `Cascade from ${pkg.cascadeFrom}`}` +
        ` (${pkg.bumpType} bump)\n`
    );
  }

  const newSection =
    `## ${date} (prepare run ${manifest.prepareRunId})\n\n` +
    entries.join("\n");

  if (existsSync(changelogPath)) {
    const existing = readFileSync(changelogPath, "utf8");
    // Insert after the first heading line (# CHANGELOG or similar)
    const firstNewline = existing.indexOf("\n");
    if (firstNewline !== -1) {
      const updated =
        existing.slice(0, firstNewline + 1) +
        "\n" +
        newSection +
        "\n" +
        existing.slice(firstNewline + 1);
      writeFileSync(changelogPath, updated);
    } else {
      writeFileSync(changelogPath, existing + "\n\n" + newSection);
    }
  } else {
    writeFileSync(changelogPath, `# Changelog\n\n${newSection}\n`);
  }

  // -----------------------------------------------------------------------
  // 5. Commit with [skip ci]
  // -----------------------------------------------------------------------
  console.log("Committing finalized versions...");

  git('config user.name "neon-js-release[bot]"', repoDir);
  git(
    'config user.email "neon-js-release[bot]@users.noreply.github.com"',
    repoDir
  );

  // Stage all modified files
  git("add -A", repoDir);

  const commitMessage =
    `[skip ci] chore(release): finalize prepared release from run ${manifest.prepareRunId}\n\n` +
    manifest.packages
      .map((p) => `- ${p.packageName}@${p.nextVersion}`)
      .join("\n");

  git(`commit -m "${commitMessage}"`, repoDir);

  // -----------------------------------------------------------------------
  // 6. Create annotated tags
  // -----------------------------------------------------------------------
  console.log("Creating tags...");
  for (const pkg of manifest.packages) {
    git(
      `tag -a "${pkg.tagName}" -m "Release ${pkg.packageName}@${pkg.nextVersion}"`,
      repoDir
    );
    console.log(`  Tagged: ${pkg.tagName}`);
  }

  // -----------------------------------------------------------------------
  // 7. Push commits and tags
  // -----------------------------------------------------------------------
  console.log("Pushing to remote...");
  const remote = `https://x-access-token:${token}@github.com/${manifest.sourceRepo}.git`;
  git(`push "${remote}" HEAD:${manifest.sourceBranch} --follow-tags`, repoDir);

  console.log("Finalize complete.");
  console.log(
    `Published: ${manifest.packages.map((p) => `${p.packageName}@${p.nextVersion}`).join(", ")}`
  );
}

main().catch((err) => {
  console.error("Finalize failed:", err);
  process.exit(1);
});
