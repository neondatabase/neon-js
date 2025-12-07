import type { UserConfig } from 'tsdown';

type PackageConfigOptions = Partial<UserConfig> & {
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
 **/
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
