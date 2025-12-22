/**
 * Shared build utilities for tsdown hooks.
 * Centralizes common operations: workspace dep transforms, CSS copying, package.json handling.
 */

import {
  readFileSync,
  writeFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
} from 'node:fs';
import path from 'node:path';

/**
 * Transform workspace:* dependencies to caret versions for publishing.
 * Also removes private internal packages (they get bundled, not published as dependencies).
 * Security: Validates resolved paths stay within packages directory.
 *
 * @param pkg - The package.json object to transform
 * @param packagesDir - The packages directory boundary for security validation
 * @returns The transformed package.json object
 */
export function transformWorkspaceDeps(
  pkg: Record<string, unknown>,
  packagesDir: string
): Record<string, unknown> {
  const deps = pkg.dependencies as Record<string, string> | undefined;
  if (!deps) return pkg;

  const depsToRemove: string[] = [];

  for (const [name, version] of Object.entries(deps)) {
    if (typeof version === 'string' && version.startsWith('workspace:')) {
      const workspaceName = name.split('/').pop();
      if (!workspaceName) {
        console.warn(`⚠️  Invalid workspace dependency: ${name}`);
        continue;
      }

      const workspacePkgPath = path.resolve(
        packagesDir,
        workspaceName,
        'package.json'
      );

      // Security: ensure resolved path stays within packages directory
      if (!workspacePkgPath.startsWith(packagesDir + path.sep)) {
        console.warn(`⚠️  Path traversal blocked for: ${name}`);
        continue;
      }

      try {
        const workspacePkg = JSON.parse(readFileSync(workspacePkgPath, 'utf8'));

        if (workspacePkg.private === true) {
          depsToRemove.push(name);
          console.log(`✅ Removed private dependency: ${name} (bundled)`);
          continue;
        }

        deps[name] = `^${workspacePkg.version}`;
        console.log(`✅ Resolved ${name}: ${version} → ^${workspacePkg.version}`);
      } catch {
        console.warn(`⚠️  Could not resolve workspace dependency: ${name}`);
      }
    }
  }

  for (const dep of depsToRemove) {
    delete deps[dep];
  }

  return pkg;
}

/**
 * Copy package.json to dist/, optionally transforming workspace dependencies.
 *
 * @param packageDir - The package directory containing package.json
 * @param options.transform - Whether to transform workspace:* dependencies
 */
export function copyPackageJsonToDist(
  packageDir: string,
  options: { transform?: boolean } = {}
): void {
  const pkgPath = path.resolve(packageDir, 'package.json');
  let pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

  if (options.transform) {
    const packagesDir = path.resolve(packageDir, '..');
    pkg = transformWorkspaceDeps(pkg, packagesDir);
  }

  const distPkgPath = path.resolve(packageDir, 'dist', 'package.json');
  writeFileSync(distPkgPath, JSON.stringify(pkg, null, 2));
  console.log('✅ Copied package.json to dist/');
}

/**
 * Copy a single file with error handling.
 *
 * @param src - Source file path
 * @param dest - Destination file path
 * @param label - Optional label for logging (defaults to filename)
 * @returns true if successful, false otherwise
 */
export function copyFileSafe(
  src: string,
  dest: string,
  label?: string
): boolean {
  try {
    copyFileSync(src, dest);
    console.log(`✅ Copied ${label || path.basename(src)}`);
    return true;
  } catch (error) {
    console.warn(`⚠️  Could not copy ${label || path.basename(src)}:`, error);
    return false;
  }
}

interface CssFile {
  src: string;
  dest: string;
}

interface CssBundleOptions {
  /** Source directory containing CSS files */
  sourceDir: string;
  /** Target directory to copy CSS files to */
  targetDir: string;
  /** Array of file mappings (supports rename: { src: 'style.css', dest: 'css.css' }) */
  files: CssFile[];
  /** Package name for css.d.ts declaration (e.g., '@neondatabase/auth') */
  packageName: string;
}

/**
 * Copy CSS files from a source package and generate type declaration.
 * Handles build order dependencies gracefully (warns if source not found).
 *
 * @param options - Configuration for CSS bundle copying
 */
export function copyCssBundle(options: CssBundleOptions): void {
  const { sourceDir, targetDir, files, packageName } = options;

  // Check source exists (build order dependency)
  if (!existsSync(sourceDir)) {
    console.warn(`⚠️  Source CSS directory not found: ${sourceDir}`);
    console.warn('    Build the upstream package first.');
    return;
  }

  // Create target directory
  mkdirSync(targetDir, { recursive: true });

  // Copy each file
  for (const { src, dest } of files) {
    copyFileSafe(
      path.join(sourceDir, src),
      path.join(targetDir, dest),
      `${src} → ${dest}`
    );
  }

  // Generate type declaration
  try {
    writeFileSync(
      path.join(targetDir, 'css.d.ts'),
      `declare module '${packageName}/ui/css';\n`
    );
    console.log('✅ Generated css.d.ts');
  } catch (error) {
    console.warn('⚠️  Could not generate css.d.ts:', error);
  }
}
