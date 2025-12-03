#!/usr/bin/env bun
/**
 * Release script with automatic cascading version bumps.
 *
 * Usage:
 *   bun scripts/release.ts <package-name>
 *
 * Examples:
 *   bun scripts/release.ts neon-auth    # Releases neon-auth and patches neon-js
 *   bun scripts/release.ts postgrest-js # Releases postgrest-js and patches neon-js
 *   bun scripts/release.ts neon-js      # Releases neon-js only (leaf package)
 */

import { $, spawn } from 'bun';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

// Dependency graph: package -> packages that depend on it
const DEPENDENCY_GRAPH: Record<string, string[]> = {
  'postgrest-js': ['neon-js'],
  'neon-auth': ['neon-js', 'neon-auth-next'],
  'neon-js': [],
  'neon-auth-next': [],
};

const VALID_PACKAGES = Object.keys(DEPENDENCY_GRAPH);

const ROOT_DIR = path.resolve(import.meta.dirname, '..');

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
  const tag = `${packageName}-v%s`;

  console.log(`\n📦 Running bumpp for ${packageName}...`);

  // Run bumpp interactively - must use spawn with stdio inherit for TTY
  const proc = spawn(
    [
      'bunx',
      'bumpp',
      '--tag',
      tag,
      '--c',
      `chore: release ${packageName}@-v%s`,
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
 * Builds a package.
 */
async function buildPackage(packageName: string): Promise<void> {
  console.log(`  🔨 Building ${packageName}...`);
  await $`bun install --filter @neondatabase/${packageName}`.quiet();
  await $`bun run --filter @neondatabase/${packageName} build`.quiet();
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
 * 1. Version bumping phase - build & bumpp all packages (creates commits + tags)
 * 2. Lock file update - run `bun update` and amend last commit
 * 3. Publishing phase - publish all packages to npm
 * 4. Push commits and tags
 */
async function release(packageName: string): Promise<void> {
  console.log(`\n🎯 Starting release for: ${packageName}`);
  console.log('─'.repeat(50));

  const dependents = DEPENDENCY_GRAPH[packageName];
  const allPackages = [packageName, ...dependents];

  // ============================================
  // Phase 1: Version bumping (build + bumpp)
  // ============================================
  console.log(`\n📦 Phase 1: Version bumping`);
  console.log('─'.repeat(30));

  // Build and bumpp main package
  await buildPackage(packageName);
  const newVersion = await runBumpp(packageName);
  console.log(`✅ ${packageName} version: ${newVersion}`);

  // Build and bumpp dependents
  for (const dep of dependents) {
    await buildPackage(dep);
    await runBumpp(dep);
  }

  // ============================================
  // Phase 2: Lock file update
  // ============================================
  console.log(`\n🔄 Phase 2: Updating lock file`);
  console.log('─'.repeat(30));

  console.log(`  📦 Running bun update...`);
  await $`bun update`.cwd(ROOT_DIR).quiet();

  // Amend the last commit to include lock file changes
  console.log(`  📝 Adding lock file to last commit...`);
  await $`git add bun.lockb`.cwd(ROOT_DIR).quiet();
  await $`git commit --amend --no-edit`.cwd(ROOT_DIR).quiet();

  // ============================================
  // Phase 3: Publishing
  // ============================================
  console.log(`\n🚀 Phase 3: Publishing packages`);
  console.log('─'.repeat(30));

  for (const pkg of allPackages) {
    await publishPackage(pkg);
  }

  // ============================================
  // Phase 4: Push to remote
  // ============================================
  console.log(`\n📤 Phase 4: Pushing to remote`);
  console.log('─'.repeat(30));

  await $`git push --follow-tags`;

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
