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

function writePackageJson(packageName: string, pkg: PackageJson): void {
  const pkgPath = getPackageJsonPath(packageName);
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}

/**
 * Increments the patch version, handling pre-release versions.
 * Examples:
 *   0.1.0 -> 0.1.1
 *   0.1.0-alpha.4 -> 0.1.0-alpha.5
 */
function incrementPatchVersion(version: string): string {
  // Check if it's a pre-release version (e.g., 0.1.0-alpha.4)
  const preReleaseMatch = version.match(/^(.+)-([a-zA-Z]+)\.(\d+)$/);
  if (preReleaseMatch) {
    const [, base, tag, num] = preReleaseMatch;
    return `${base}-${tag}.${Number.parseInt(num, 10) + 1}`;
  }

  // Regular version (e.g., 0.1.0)
  const parts = version.split('.');
  const patch = Number.parseInt(parts[2], 10) + 1;
  return `${parts[0]}.${parts[1]}.${patch}`;
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
  const proc = spawn(['bunx', 'bumpp', '--tag', tag], {
    cwd: pkgPath,
    stdio: ['inherit', 'inherit', 'inherit'],
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`bumpp exited with code ${exitCode}`);
  }

  // Read the new version from package.json
  const pkg = readPackageJson(packageName);
  return pkg.version;
}

/**
 * Patches a dependent package's version.
 */
async function patchDependent(
  packageName: string,
  reason: string
): Promise<string> {
  const pkg = readPackageJson(packageName);
  const oldVersion = pkg.version;
  const newVersion = incrementPatchVersion(oldVersion);

  console.log(`  📝 ${packageName}: ${oldVersion} → ${newVersion}`);

  // Update package.json
  pkg.version = newVersion;
  writePackageJson(packageName, pkg);

  // Update CHANGELOG
  updateChangelog(packageName, newVersion, reason);

  // Create git tag
  const tag = `${packageName}-v${newVersion}`;
  await $`git tag ${tag}`.quiet();
  console.log(`  🏷️  Created tag: ${tag}`);

  return newVersion;
}

/**
 * Builds a package.
 */
async function buildPackage(packageName: string): Promise<void> {
  console.log(`  🔨 Building ${packageName}...`);
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
 */
async function release(packageName: string): Promise<void> {
  console.log(`\n🎯 Starting release for: ${packageName}`);
  console.log('─'.repeat(50));

  // 1. Build the package first
  await buildPackage(packageName);

  // 2. Run bumpp (interactive version selection)
  const newVersion = await runBumpp(packageName);
  console.log(`\n✅ ${packageName} version: ${newVersion}`);

  // 3. Get dependents and patch them
  const dependents = DEPENDENCY_GRAPH[packageName];

  if (dependents.length > 0) {
    console.log(`\n📦 Patching dependent packages...`);
    for (const dep of dependents) {
      await patchDependent(dep, `Bump @neondatabase/${packageName} to ${newVersion}`);
    }

    // 4. Build dependents
    console.log(`\n🔨 Building dependent packages...`);
    for (const dep of dependents) {
      await buildPackage(dep);
    }
  }

  // 5. Commit all changes
  console.log(`\n📝 Committing changes...`);
  await $`git add -A`.quiet();

  const commitMessage =
    dependents.length > 0
      ? `chore: release ${packageName}@${newVersion} (+ ${dependents.join(', ')})`
      : `chore: release ${packageName}@${newVersion}`;

  await $`git commit -m ${commitMessage}`.quiet();

  // 6. Publish packages
  console.log(`\n🚀 Publishing packages...`);
  await publishPackage(packageName);
  for (const dep of dependents) {
    await publishPackage(dep);
  }

  // 7. Push commits and tags
  console.log(`\n📤 Pushing to remote...`);
  await $`git push --follow-tags`;

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

// Run the release
release(packageName).catch((error) => {
  console.error('\n❌ Release failed:', error.message);
  process.exit(1);
});
