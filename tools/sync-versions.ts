#!/usr/bin/env bun

/**
 * sync-versions.ts -- Release planner and version applier for neon-js monorepo
 *
 * Subcommands:
 *   plan   Detect changed packages since their last tag, compute the cascade,
 *          determine bump levels, and write release-manifest.json.
 *          Exits cleanly (no manifest) if there are no releasable changes.
 *
 *   apply  Read release-manifest.json and rewrite package.json versions and
 *          internal dependency references. Run `bun install` to refresh the
 *          lockfile afterward.
 *
 * Cascade graph:
 *   auth-ui -> auth -> neon-js
 *   postgrest-js -> neon-js
 *
 * Publish order (leaves first):
 *   0: auth-ui
 *   1: postgrest-js
 *   2: auth
 *   3: neon-js
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROOT_DIR = path.resolve(import.meta.dirname, "..");
const MANIFEST_PATH = path.join(ROOT_DIR, "release-manifest.json");

/** All publishable packages in dependency-first (publish) order. */
const PACKAGES = ["auth-ui", "postgrest-js", "auth", "neon-js"] as const;
type PackageId = (typeof PACKAGES)[number];

/** npm scope prefix. */
const SCOPE = "@neondatabase";

/** Tag prefix per package: <packageId>-v<version> */
function tagPrefix(pkgId: PackageId): string {
  return `${pkgId}-v`;
}

/**
 * Cascade edges: if key changes, each value also needs at least a patch bump.
 * Expressed as direct edges; transitive closure is computed at runtime.
 */
const CASCADE_EDGES: Record<PackageId, PackageId[]> = {
  "auth-ui": ["auth"],
  auth: ["neon-js"],
  "postgrest-js": ["neon-js"],
  "neon-js": [],
};

/**
 * Publish order index. Lower = published first (leaves before dependents).
 */
const PUBLISH_ORDER: Record<PackageId, number> = {
  "auth-ui": 0,
  "postgrest-js": 1,
  auth: 2,
  "neon-js": 3,
};

/**
 * Files/directories that, if changed, count as shared infrastructure affecting
 * all packages (at least a patch bump).
 */
const SHARED_PATHS = [
  "package.json",
  "bun.lock",
  "tsconfig.json",
  "tsconfig.base.json",
  "tools/",
  "scripts/",
];

/** Paths that never trigger a release. */
const IGNORED_PATH_PATTERNS = [
  /^\.github\//,
  /^docs?\//,
  /^examples?\//,
  /^e2e\//,
  /^\..*/, // dotfiles at root (.gitignore, .eslintrc, etc.)
  /README\.md$/i,
  /CLAUDE\.md$/i,
  /CODEOWNERS$/,
  /LICENSE$/,
  /CHANGELOG\.md$/i,
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BumpType = "patch" | "minor" | "major";

interface PackageEntry {
  packageId: PackageId;
  packageName: string;
  packageDir: string;
  currentVersion: string;
  nextVersion: string;
  bumpType: BumpType;
  directChange: boolean;
  cascadeFrom: string | null;
  publishOrder: number;
  tagName: string;
  tarballFilename: string;
  internalDependencyUpdates: {
    dependencyName: string;
    fromVersion: string;
    toVersion: string;
  }[];
}

interface ReleaseManifest {
  schemaVersion: "1";
  sourceRepo: string;
  sourceCommitSha: string;
  sourceBranch: string;
  triggerEvent: string;
  prepareWorkflowName: string;
  prepareRunId: string;
  prepareRunAttempt: string;
  generatedAt: string;
  packages: PackageEntry[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function git(args: string): string {
  return execSync(`git ${args}`, { cwd: ROOT_DIR, encoding: "utf8" }).trim();
}

function readPkgJson(pkgId: PackageId): Record<string, unknown> {
  const p = path.join(ROOT_DIR, "packages", pkgId, "package.json");
  return JSON.parse(readFileSync(p, "utf8"));
}

function writePkgJson(pkgId: PackageId, data: Record<string, unknown>): void {
  const p = path.join(ROOT_DIR, "packages", pkgId, "package.json");
  writeFileSync(p, JSON.stringify(data, null, 2) + "\n");
}

/**
 * Find the latest tag for a package, or null if none exists.
 */
function latestTag(pkgId: PackageId): string | null {
  try {
    const tag = git(
      `describe --tags --match "${tagPrefix(pkgId)}*" --abbrev=0 HEAD`
    );
    return tag || null;
  } catch {
    return null;
  }
}

/**
 * List files changed between a ref and HEAD.
 */
function changedFiles(sinceRef: string | null): string[] {
  if (!sinceRef) {
    // No prior tag -- treat all tracked files as changed.
    return git("ls-files").split("\n").filter(Boolean);
  }
  return git(`diff --name-only ${sinceRef}..HEAD`)
    .split("\n")
    .filter(Boolean);
}

/**
 * Parse conventional commit messages to determine the highest bump level.
 * When paths are provided, only commits touching those paths are considered.
 */
function commitBumpLevel(sinceRef: string | null, paths: string[] = []): BumpType {
  const range = sinceRef ? `${sinceRef}..HEAD` : "HEAD";
  const pathFilter = paths.length > 0 ? ` -- ${paths.join(" ")}` : "";
  let log: string;
  try {
    log = git(`log --format=%B ${range}${pathFilter}`);
  } catch {
    return "patch";
  }

  // Split on double-newline to process each commit's full message
  const commits = log.split("\n\n").filter(Boolean);

  let level: BumpType = "patch";
  for (const commit of commits) {
    const lines = commit.split("\n").filter(Boolean);
    for (const line of lines) {
      if (/^.*!:/.test(line) || /BREAKING[\s-]CHANGE/i.test(line)) {
        return "major";
      }
      if (/^feat(\(.*?\))?:/.test(line) && level !== "major") {
        level = "minor";
      }
    }
  }
  return level;
}

function bumpVersion(current: string, bump: BumpType): string {
  // Handle pre-release versions: strip pre-release suffix and bump the base
  const match = current.match(
    /^(\d+)\.(\d+)\.(\d+)(?:-[a-zA-Z0-9.]+)?$/
  );
  if (!match) {
    throw new Error(`Cannot parse version: ${current}`);
  }
  let [, majorStr, minorStr, patchStr] = match;
  let major = parseInt(majorStr, 10);
  let minor = parseInt(minorStr, 10);
  let patch = parseInt(patchStr, 10);

  // If the current version is a pre-release (e.g. 0.2.0-beta.1), the first
  // "real" release of that version is just dropping the pre-release suffix for
  // a patch bump, or incrementing the appropriate component for minor/major.
  const isPreRelease = current.includes("-");

  switch (bump) {
    case "major":
      major += 1;
      minor = 0;
      patch = 0;
      break;
    case "minor":
      minor += 1;
      patch = 0;
      break;
    case "patch":
      if (isPreRelease) {
        // Pre-release patch: just drop the suffix (0.2.0-beta.1 -> 0.2.0)
      } else {
        patch += 1;
      }
      break;
  }
  return `${major}.${minor}.${patch}`;
}

function maxBump(a: BumpType, b: BumpType): BumpType {
  const order: Record<BumpType, number> = { patch: 0, minor: 1, major: 2 };
  return order[a] >= order[b] ? a : b;
}

/**
 * Compute the transitive closure of cascade edges from a set of directly
 * changed packages.
 */
function cascadeClosure(
  directChanges: Map<PackageId, BumpType>
): Map<PackageId, { bump: BumpType; cascadeFrom: PackageId | null }> {
  const result = new Map<
    PackageId,
    { bump: BumpType; cascadeFrom: PackageId | null }
  >();

  // Seed with direct changes
  for (const [pkgId, bump] of directChanges) {
    result.set(pkgId, { bump, cascadeFrom: null });
  }

  // BFS cascade
  const queue: PackageId[] = [...directChanges.keys()];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentBump = result.get(current)!.bump;

    for (const downstream of CASCADE_EDGES[current]) {
      const existing = result.get(downstream);
      // Cascade propagates at least patch
      const cascadedBump: BumpType = "patch";
      const effectiveBump = maxBump(
        cascadedBump,
        existing?.bump ?? "patch"
      );

      if (!existing) {
        result.set(downstream, {
          bump: effectiveBump,
          cascadeFrom: current,
        });
        queue.push(downstream);
      } else if (effectiveBump !== existing.bump) {
        existing.bump = effectiveBump;
        queue.push(downstream);
      }
    }
  }

  return result;
}

/**
 * Map a changed file to the package it belongs to, or null for shared/ignored.
 */
function fileToPackage(filePath: string): PackageId | "shared" | null {
  // Check ignored patterns first
  for (const pattern of IGNORED_PATH_PATTERNS) {
    if (pattern.test(filePath)) {
      return null;
    }
  }

  // Check package directories
  for (const pkgId of PACKAGES) {
    if (filePath.startsWith(`packages/${pkgId}/`)) {
      return pkgId;
    }
  }

  // Check shared paths
  for (const sharedPath of SHARED_PATHS) {
    if (filePath === sharedPath || filePath.startsWith(sharedPath)) {
      return "shared";
    }
  }

  // Internal package changes affect nobody directly
  if (filePath.startsWith("packages/internal/")) {
    return "shared";
  }

  return null;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function plan(): Promise<void> {
  // 1. For each package, find changes since last tag
  const directChanges = new Map<PackageId, BumpType>();

  for (const pkgId of PACKAGES) {
    const tag = latestTag(pkgId);
    const files = changedFiles(tag);

    let hasDirectChange = false;
    let hasSharedChange = false;

    for (const file of files) {
      const owner = fileToPackage(file);
      if (owner === pkgId) {
        hasDirectChange = true;
      } else if (owner === "shared") {
        hasSharedChange = true;
      }
    }

    if (hasDirectChange) {
      const pkgPaths = [`packages/${pkgId}/`];
      const bump = commitBumpLevel(tag, pkgPaths);
      directChanges.set(pkgId, bump);
    } else if (hasSharedChange) {
      directChanges.set(pkgId, "patch");
    }
  }

  if (directChanges.size === 0) {
    console.log("No releasable changes detected.");
    // Do not write manifest -- the workflow checks for file existence
    return;
  }

  // 2. Compute cascade
  const allChanges = cascadeClosure(directChanges);

  // 3. Build manifest entries
  const packages: PackageEntry[] = [];
  for (const pkgId of PACKAGES) {
    const change = allChanges.get(pkgId);
    if (!change) continue;

    const pkgJson = readPkgJson(pkgId);
    const currentVersion = pkgJson.version as string;
    const nextVersion = bumpVersion(currentVersion, change.bump);
    const tarballFilename = `neondatabase-${pkgId}-${nextVersion}.tgz`;

    packages.push({
      packageId: pkgId,
      packageName: `${SCOPE}/${pkgId}`,
      packageDir: `packages/${pkgId}`,
      currentVersion,
      nextVersion,
      bumpType: change.bump,
      directChange: directChanges.has(pkgId),
      cascadeFrom: change.cascadeFrom,
      publishOrder: PUBLISH_ORDER[pkgId],
      tagName: `${pkgId}-v${nextVersion}`,
      tarballFilename,
      internalDependencyUpdates: [],
    });
  }

  // Sort by publish order
  packages.sort((a, b) => a.publishOrder - b.publishOrder);

  // 4. Compute internal dependency updates
  const versionMap = new Map(packages.map((p) => [p.packageName, p.nextVersion]));
  for (const entry of packages) {
    const pkgJson = readPkgJson(entry.packageId);
    const deps = (pkgJson.dependencies ?? {}) as Record<string, string>;
    for (const [depName, depVersion] of Object.entries(deps)) {
      const newVersion = versionMap.get(depName);
      if (newVersion) {
        entry.internalDependencyUpdates.push({
          dependencyName: depName,
          fromVersion: depVersion,
          toVersion: newVersion,
        });
      }
    }
  }

  // 5. Build full manifest
  const headSha = git("rev-parse HEAD");
  const branch = process.env.GITHUB_REF_NAME ?? git("rev-parse --abbrev-ref HEAD");

  const manifest: ReleaseManifest = {
    schemaVersion: "1",
    sourceRepo: process.env.GITHUB_REPOSITORY ?? "neondatabase/neon-js",
    sourceCommitSha: headSha,
    sourceBranch: branch,
    triggerEvent: process.env.GITHUB_EVENT_NAME ?? "local",
    prepareWorkflowName: "prepare-release.yml",
    prepareRunId: process.env.GITHUB_RUN_ID ?? "local",
    prepareRunAttempt: process.env.GITHUB_RUN_ATTEMPT ?? "1",
    generatedAt: new Date().toISOString(),
    packages,
  };

  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Release manifest written to ${MANIFEST_PATH}`);
  console.log(
    `Packages: ${packages.map((p) => `${p.packageId}@${p.nextVersion}`).join(", ")}`
  );
}

async function apply(): Promise<void> {
  if (!existsSync(MANIFEST_PATH)) {
    console.error("No release-manifest.json found. Run 'plan' first.");
    process.exit(1);
  }

  const manifest: ReleaseManifest = JSON.parse(
    readFileSync(MANIFEST_PATH, "utf8")
  );

  // 1. Rewrite package.json versions
  for (const entry of manifest.packages) {
    const pkgJson = readPkgJson(entry.packageId);
    pkgJson.version = entry.nextVersion;

    // Update internal dependency references
    const deps = (pkgJson.dependencies ?? {}) as Record<string, string>;
    for (const update of entry.internalDependencyUpdates) {
      if (deps[update.dependencyName]) {
        deps[update.dependencyName] = update.toVersion;
      }
    }

    writePkgJson(entry.packageId, pkgJson);
    console.log(
      `${entry.packageId}: ${entry.currentVersion} -> ${entry.nextVersion}`
    );
  }

  // 2. Refresh lockfile
  console.log("Refreshing lockfile...");
  execSync("bun install", { cwd: ROOT_DIR, stdio: "inherit" });

  console.log("Version application complete.");
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

const subcommand = process.argv[2];

switch (subcommand) {
  case "plan":
    await plan();
    break;
  case "apply":
    await apply();
    break;
  default:
    console.error("Usage: bun tools/sync-versions.ts <plan|apply>");
    process.exit(1);
}
