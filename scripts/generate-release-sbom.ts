#!/usr/bin/env bun

import { $ } from 'bun';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import path from 'node:path';

interface PackageJson {
  name: string;
  main?: string;
  module?: string;
  bin?: string | Record<string, string>;
  exports?: unknown;
}

interface BuildLog {
  message: string;
  position?: {
    file: string;
    line: number;
    column: number;
  };
}

const ROOT_DIR = path.resolve(import.meta.dirname, '..');
const DIST_JS_EXTENSIONS = new Set(['.js', '.mjs', '.cjs']);
const CYCLONEDX_CLI_PATH = path.join(
  ROOT_DIR,
  'node_modules',
  '.bin',
  'cyclonedx-esbuild'
);

function usage(): never {
  console.error(
    'Usage: bun scripts/generate-release-sbom.ts <package-name> <output-path>'
  );
  process.exit(1);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function normalizeDistEntrypoint(value: string): string | null {
  const normalized = value.startsWith('./') ? value.slice(2) : value;
  if (!normalized.startsWith('dist/')) {
    return null;
  }
  if (!DIST_JS_EXTENSIONS.has(path.extname(normalized))) {
    return null;
  }
  return normalized;
}

function addEntrypoint(entrypoints: Set<string>, value: string | undefined): void {
  if (!value) {
    return;
  }
  const normalized = normalizeDistEntrypoint(value);
  if (normalized) {
    entrypoints.add(normalized);
  }
}

function collectExportEntrypoints(
  exportsField: unknown,
  entrypoints: Set<string>
): void {
  if (typeof exportsField === 'string') {
    addEntrypoint(entrypoints, exportsField);
    return;
  }

  if (Array.isArray(exportsField)) {
    for (const value of exportsField) {
      collectExportEntrypoints(value, entrypoints);
    }
    return;
  }

  if (!isRecord(exportsField)) {
    return;
  }

  for (const value of Object.values(exportsField)) {
    collectExportEntrypoints(value, entrypoints);
  }
}

function collectPackageEntrypoints(pkg: PackageJson): string[] {
  const entrypoints = new Set<string>();

  addEntrypoint(entrypoints, pkg.main);
  addEntrypoint(entrypoints, pkg.module);

  if (typeof pkg.bin === 'string') {
    addEntrypoint(entrypoints, pkg.bin);
  } else if (isRecord(pkg.bin)) {
    for (const value of Object.values(pkg.bin)) {
      if (typeof value === 'string') {
        addEntrypoint(entrypoints, value);
      }
    }
  }

  collectExportEntrypoints(pkg.exports, entrypoints);

  return [...entrypoints].toSorted();
}

function formatBuildLogs(logs: BuildLog[]): string {
  return logs
    .map((log) => {
      const location = log.position
        ? `${log.position.file}:${log.position.line}:${log.position.column}`
        : '';
      return [location, log.message].filter(Boolean).join(' ');
    })
    .join('\n');
}

const packageName = process.argv[2];
const outputPathArg = process.argv[3];

if (!packageName || !outputPathArg) {
  usage();
}

if (!existsSync(CYCLONEDX_CLI_PATH)) {
  console.error(
    `Missing cyclonedx-esbuild CLI at ${CYCLONEDX_CLI_PATH}. Run bun install first.`
  );
  process.exit(1);
}

const packageDir = path.join(ROOT_DIR, 'packages', packageName);
const packageJsonPath = path.join(packageDir, 'package.json');

if (!existsSync(packageJsonPath)) {
  console.error(`Unknown package: ${packageName}`);
  process.exit(1);
}

const packageJson = JSON.parse(
  readFileSync(packageJsonPath, 'utf8')
) as PackageJson;
const entrypoints = collectPackageEntrypoints(packageJson);

if (entrypoints.length === 0) {
  console.error(`No JavaScript dist entrypoints found for ${packageJson.name}`);
  process.exit(1);
}

for (const entrypoint of entrypoints) {
  const entrypointPath = path.join(packageDir, entrypoint);
  if (!existsSync(entrypointPath)) {
    console.error(`Missing built entrypoint for ${packageJson.name}: ${entrypoint}`);
    process.exit(1);
  }
}

const outputPath = path.resolve(outputPathArg);
mkdirSync(path.dirname(outputPath), { recursive: true });

const tempDir = mkdtempSync(path.join(packageDir, '.release-sbom-'));
const bundleOutdir = path.join(tempDir, 'bundle');
const metafilePath = path.join(tempDir, 'metafile.json');
const buildEntrypoints = entrypoints.map((entrypoint) =>
  path.join(packageDir, entrypoint)
);

const previousCwd = process.cwd();

try {
  process.chdir(ROOT_DIR);

  const result = await Bun.build({
    entrypoints: buildEntrypoints,
    outdir: bundleOutdir,
    format: 'esm',
    target: 'bun',
    metafile: true,
    packages: 'bundle',
    root: ROOT_DIR,
  });

  if (!result.success) {
    throw new Error(
      `SBOM build failed for ${packageJson.name}\n${formatBuildLogs(result.logs)}`
    );
  }

  if (!result.metafile) {
    throw new Error(`No build metafile was produced for ${packageJson.name}`);
  }

  await Bun.write(metafilePath, JSON.stringify(result.metafile, null, 2));

  await $`${CYCLONEDX_CLI_PATH} --build-working-dir ${ROOT_DIR} --mc-type library --output-reproducible --output-file ${outputPath} ${metafilePath}`;
} finally {
  process.chdir(previousCwd);
  rmSync(tempDir, { recursive: true, force: true });
}

console.log(`Generated SBOM for ${packageJson.name}: ${outputPath}`);
