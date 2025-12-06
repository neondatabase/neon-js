import type { UserConfig } from 'tsdown';

/**
 * Package configuration options that extend tsdown UserConfig.
 * Entry is required, all other options are optional.
 */
export type PackageConfigOptions = Partial<UserConfig> & {
  entry: UserConfig['entry'];
};

/**
 * Creates a tsdown configuration with shared defaults for all packages.
 *
 * Shared defaults:
 * - format: ['esm'] (ESM-only, modern standard)
 * - dts: { build: true } (TypeScript declarations)
 * - clean: true (can be overridden, e.g., auth-ui sets false for CSS)
 *
 * @example
 * ```ts
 * // Simple package
 * export default defineConfig(createPackageConfig({
 *   entry: ['src/index.ts'],
 * }));
 *
 * // Complex package with overrides
 * export default defineConfig(createPackageConfig({
 *   entry: ['src/index.ts', 'src/react/index.ts'],
 *   external: ['@neondatabase/auth'],
 *   plugins: [preserveDirectives()],
 *   clean: false,
 * }));
 * ```
 */
export function createPackageConfig(options: PackageConfigOptions): UserConfig {
  const { entry, ...rest } = options;

  return {
    entry,
    format: ['esm'],
    dts: { build: true },
    clean: true,
    ...rest,
  };
}
