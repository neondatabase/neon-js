#!/usr/bin/env bun
/**
 * Release script with automatic cascading version bumps.
 *
 * This script is CI-only. Trigger releases from the GitHub Actions "Release"
 * workflow on main instead of running local publish commands.
 *
 * Usage:
 *   bun scripts/release.ts <package-name>
 *
 * Examples:
 *   bun scripts/release.ts auth          # Releases auth and patches neon-js
 *   bun scripts/release.ts postgrest-js # Releases postgrest-js and patches neon-js
 *   bun scripts/release.ts neon-js      # Releases neon-js only (leaf package)
 */

import { $, spawn } from 'bun';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

// Dependency graph: package -> direct dependents (packages that depend on it)
// The release script will automatically resolve transitive dependents.
const DEPENDENCY_GRAPH: Record<string, string[]> = {
  'postgrest-js': ['neon-js'],
  'auth-ui': ['auth'],
  auth: ['neon-js'],
  'neon-js': [],
};

const VALID_PACKAGES = Object.keys(DEPENDENCY_GRAPH);

const ROOT_DIR = path.resolve(import.meta.dirname, '..');

function assertGitHubActionsRelease(): void {
  if (process.env.GITHUB_ACTIONS === 'true') {
    return;
  }

  console.error(
    'Error: Releases must be triggered from the GitHub Actions "Release" workflow on main.'
  );
  console.error(
    'Local release scripts are disabled so version bumps, tags, and publishes stay in CI.'
  );
  process.exit(1);
}

/**
 * Resolves all transitive dependents of a package using BFS.
 *
 * State machine:
 *   States: { queue, visited, result }
 *   Transitions:
 *     1. Dequeue package from queue
 *     2. If visited → skip (prevents cycles & duplicates)
 *     3. Mark visited, add to result
 *     4. Enqueue all direct dependents
 *     5. Repeat until queue empty
 *
 * BFS guarantees correct release order: a package is always
 * processed before its dependents (children in the graph).
 *
 * @example
 *   getTransitiveDependents('auth-ui')
 *   // Returns: ['auth-ui', 'auth', 'neon-js']
 *
 * @example
 *   getTransitiveDependents('neon-js')
 *   // Returns: ['neon-js'] (leaf node, no dependents)
 */
function getTransitiveDependents(packageName: string): string[] {
  const result: string[] = [];
  const visited = new Set<string>();
  const queue: string[] = [packageName];

  while (queue.length > 0) {
    const current = queue.shift()!;

    // State check: skip if already processed (handles cycles & duplicates)
    if (visited.has(current)) {
      continue;
    }

    // State transition: mark as visited and add to result
    visited.add(current);
    result.push(current);

    // Enqueue direct dependents for processing
    const dependents = DEPENDENCY_GRAPH[current] ?? [];
    for (const dep of dependents) {
      if (!visited.has(dep)) {
        queue.push(dep);
      }
    }
  }

  return result;
}

interface PackageJson {
  name: string;
  version: string;
  [key: string]: unknown;
}

function getPackagePath(packageName: string): string {
  return path.join(ROOT_DIR, 'packages', packageName);
}

function getPackageJsonPath(packageName: string): string {
  return path.join(getPackagePath(packageName), 'package.json');
}

function readPackageJson(packageName: string): PackageJson {
  const pkgPath = getPackageJsonPath(packageName);
  return JSON.parse(readFileSync(pkgPath, 'utf8'));
}

/**
 * Updates the CHANGELOG.md for a package with a new entry.
 */
function updateChangelog(
  packageName: string,
  version: string,
  entry: string
): void {
  const changelogPath = path.join(getPackagePath(packageName), 'CHANGELOG.md');

  if (!existsSync(changelogPath)) {
    console.log(`  ⚠️  No CHANGELOG.md found for ${packageName}, skipping`);
    return;
  }

  const changelog = readFileSync(changelogPath, 'utf8');
  const date = new Date().toISOString().split('T')[0];

  // Create new entry
  const newEntry = `## [${version}] - ${date}\n\n### Changed\n\n- ${entry}\n`;

  // Insert after the first heading (# Changelog or similar)
  const lines = changelog.split('\n');
  let insertIndex = 0;

  for (const [i, line] of lines.entries()) {
    // Find the first ## heading or the end of frontmatter
    if (line.startsWith('## ')) {
      insertIndex = i;
      break;
    }
    // Skip past the main title and any intro text
    if (line.startsWith('# ') || line.trim() === '') {
      insertIndex = i + 1;
    }
  }

  lines.splice(insertIndex, 0, '', newEntry);
  writeFileSync(changelogPath, lines.join('\n'));
}

/**
 * Runs bumpp for a package and returns the new version.
 */
async function runBumpp(packageName: string): Promise<string> {
  const pkgPath = getPackagePath(packageName);

  console.log(`\n📦 Running bumpp for ${packageName}...`);

  // Run bumpp interactively - must use spawn with stdio inherit for TTY
  const proc = spawn(
    [
      'bunx',
      'bumpp',
      '--no-tag',
      '--no-push',
      '--c',
      `chore: release ${packageName}@v%s`,
    ],
    {
      cwd: pkgPath,
      stdio: ['inherit', 'inherit', 'inherit'],
    }
  );

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`bumpp exited with code ${exitCode}`);
  }

  // Read the new version from package.json
  const pkg = readPackageJson(packageName);
  return pkg.version;
}

/**
 * Builds all workspace packages before any version changes so internal
 * dependencies are ready before dependent package bumps.
 */
async function buildWorkspacePackages(): Promise<void> {
  console.log(`  🔨 Building workspace packages...`);
  await $`bun run build`.cwd(ROOT_DIR).quiet();
}

async function hasLockfileChanges(): Promise<boolean> {
  const proc = spawn(['git', 'diff', '--quiet', '--', 'bun.lock'], {
    cwd: ROOT_DIR,
    stdio: ['ignore', 'ignore', 'ignore'],
  });

  const exitCode = await proc.exited;
  if (exitCode === 0) {
    return false;
  }
  if (exitCode === 1) {
    return true;
  }

  throw new Error(`git diff exited with code ${exitCode}`);
}

async function createVersionTags(packageNames: string[]): Promise<void> {
  for (const packageName of packageNames) {
    const version = readPackageJson(packageName).version;
    const tag = `${packageName}-v${version}`;

    console.log(`  🏷️  Creating tag ${tag}...`);
    await $`git tag ${tag}`.cwd(ROOT_DIR).quiet();
  }
}

/**
 * Publishes a package to npm.
 */
async function publishPackage(packageName: string): Promise<void> {
  const pkgPath = getPackagePath(packageName);
  console.log(`  🚀 Publishing @neondatabase/${packageName}...`);

  // Use spawn with stdio inherit so npm can prompt for OTP interactively
  const cmd = ['bun', 'publish', '--tag', 'latest'];

  const proc = spawn(cmd, {
    cwd: pkgPath,
    stdio: ['inherit', 'inherit', 'inherit'],
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`publish failed for ${packageName} with code ${exitCode}`);
  }
}

/**
 * Main release function.
 *
 * Flow:
 * 1. Build all workspace packages
 * 2. Version bumping phase - bump all packages (creates commits, tags deferred)
 * 3. Lock file update - run `bun install` and commit the final lockfile state
 * 4. Create version tags from the final commit state
 * 5. Push commits and tags
 * 6. Publish packages to npm
 */
async function release(packageName: string): Promise<void> {
  console.log(`\n🎯 Starting release for: ${packageName}`);
  console.log('─'.repeat(50));

  // Resolve all transitive dependents (includes the starting package)
  const allPackages = getTransitiveDependents(packageName);
  const dependents = allPackages.slice(1); // Everything except the starting package

  console.log(`\n📋 Release plan (${allPackages.length} packages):`);
  for (const [i, pkg] of allPackages.entries()) {
    const marker = i === 0 ? '→' : '  →';
    console.log(`  ${marker} ${pkg}`);
  }

  // ============================================
  // Phase 1: Build workspace packages
  // ============================================
  console.log(`\n🏗️  Phase 1: Build workspace packages`);
  console.log('─'.repeat(30));

  await buildWorkspacePackages();

  // ============================================
  // Phase 2: Version bumping
  // ============================================
  console.log(`\n📦 Phase 2: Version bumping`);
  console.log('─'.repeat(30));

  const newVersion = await runBumpp(packageName);
  console.log(`✅ ${packageName} version: ${newVersion}`);

  // Bump dependents after the primary package so the cascade order is preserved
  for (const dep of dependents) {
    await runBumpp(dep);
  }

  // ============================================
  // Phase 3: Lock file update
  // ============================================
  console.log(`\n🔄 Phase 3: Updating lock file`);
  console.log('─'.repeat(30));

  console.log(`  📦 Running bun install...`);
  await $`bun install`.cwd(ROOT_DIR).quiet();

  if (await hasLockfileChanges()) {
    console.log(`  📝 Committing lock file changes...`);
    await $`git add bun.lock`.cwd(ROOT_DIR).quiet();
    await $`git commit -m "chore: update lock file"`.cwd(ROOT_DIR).quiet();
  } else {
    console.log(`  ℹ️  No bun.lock changes detected.`);
  }

  // ============================================
  // Phase 4: Tagging
  // ============================================
  console.log(`\n🏷️  Phase 4: Creating tags`);
  console.log('─'.repeat(30));

  await createVersionTags(allPackages);

  // ============================================
  // Phase 5: Push to remote
  // ============================================
  console.log(`\n📤 Phase 5: Pushing to remote`);
  console.log('─'.repeat(30));

  await $`git push --follow-tags`.cwd(ROOT_DIR).quiet();

  // ============================================
  // Phase 6: Publishing
  // ============================================
  console.log(`\n🚀 Phase 6: Publishing packages`);
  console.log('─'.repeat(30));

  for (const pkg of allPackages) {
    await publishPackage(pkg);
  }

  // ============================================
  // Summary
  // ============================================
  console.log(`\n✨ Release complete!`);
  console.log('─'.repeat(50));
  console.log(`Released packages:`);
  console.log(`  • @neondatabase/${packageName}@${newVersion}`);
  for (const dep of dependents) {
    const depPkg = readPackageJson(dep);
    console.log(`  • @neondatabase/${dep}@${depPkg.version}`);
  }
}

// CLI entry point
assertGitHubActionsRelease();

const packageName = process.argv[2];

if (!packageName) {
  console.error('Usage: bun scripts/release.ts <package-name>');
  console.error(`\nValid packages: ${VALID_PACKAGES.join(', ')}`);
  process.exit(1);
}

if (!VALID_PACKAGES.includes(packageName)) {
  console.error(`Error: Unknown package "${packageName}"`);
  console.error(`\nValid packages: ${VALID_PACKAGES.join(', ')}`);
  process.exit(1);
}

try {
  // Run the release
  await release(packageName);
} catch (error) {
  console.error('\n❌ Release failed:', error);
  process.exit(1);
}
