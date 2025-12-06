import type { Plugin, RenderedChunk } from 'rolldown';

/**
 * Options for the preserveDirectives plugin
 */
export type PreserveDirectivesOptions = {
  /**
   * List of packages that are known to be client-only.
   * If a chunk imports from any of these packages, 'use client' will be added.
   */
  clientPackages?: string[];
};

/**
 * A Rolldown plugin that preserves 'use client' and 'use server' directives.
 *
 * Unlike rollup-plugin-preserve-directives, this works with tsdown because:
 * 1. It runs in the `transform` hook AFTER TypeScript is transpiled
 * 2. It tracks which modules have directives
 * 3. It prepends directives to chunks in `renderChunk`
 * 4. It can also detect imports from known client packages
 */
export function preserveDirectives(
  options: PreserveDirectivesOptions = {}
): Plugin {
  const { clientPackages = [] } = options;

  // Track which modules have which directives
  const moduleDirectives = new Map<string, Set<string>>();
  const DIRECTIVES = ['use client', 'use server'];

  return {
    name: 'preserve-directives',

    // Run after TypeScript transpilation to detect directives
    transform: {
      // Run late so we see transpiled JS, not TS
      order: 'post',
      handler(code: string, id: string) {
        // Skip node_modules - we'll handle external deps separately
        if (id.includes('node_modules')) {
          return null;
        }

        const directives = new Set<string>();

        // Check first few lines for directives (they must be at the top)
        const lines = code.split('\n').slice(0, 10);
        for (const line of lines) {
          const trimmed = line.trim();
          // Match 'use client'; or "use client"; with optional semicolon
          for (const directive of DIRECTIVES) {
            if (
              trimmed === `'${directive}';` ||
              trimmed === `"${directive}";` ||
              trimmed === `'${directive}'` ||
              trimmed === `"${directive}"`
            ) {
              directives.add(directive);
            }
          }
        }

        // Also check if this module imports from any known client packages
        if (clientPackages.length > 0) {
          for (const pkg of clientPackages) {
            const importPattern = new RegExp(
              String.raw`from\s+["']${pkg.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)}["']`
            );
            if (importPattern.test(code)) {
              directives.add('use client');
              break;
            }
          }
        }

        if (directives.size > 0) {
          moduleDirectives.set(id, directives);
        }

        return null; // Don't modify the code in transform
      },
    },

    // Prepend directives to output chunks
    renderChunk(code: string, chunk: RenderedChunk) {
      const chunkDirectives = new Set<string>();

      // Check if any module in this chunk has directives
      for (const moduleId of Object.keys(chunk.modules)) {
        const directives = moduleDirectives.get(moduleId);
        if (directives) {
          for (const d of directives) {
            chunkDirectives.add(d);
          }
        }
      }

      // Also check facadeModuleId (entry point)
      if (chunk.facadeModuleId) {
        const directives = moduleDirectives.get(chunk.facadeModuleId);
        if (directives) {
          for (const d of directives) {
            chunkDirectives.add(d);
          }
        }
      }

      // Check if chunk imports from any known client packages
      if (clientPackages.length > 0 && chunkDirectives.size === 0) {
        for (const pkg of clientPackages) {
          // Check for import statements from the client package
          const importPattern = new RegExp(
            String.raw`from\s+["']${pkg.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)}["']`
          );
          if (importPattern.test(code)) {
            chunkDirectives.add('use client');
            break;
          }
        }
      }

      if (chunkDirectives.size === 0) {
        return null;
      }

      // Prepend directives to the chunk
      const directiveStatements = [...chunkDirectives]
        .map((d) => `'${d}';`)
        .join('\n');

      return {
        code: `${directiveStatements}\n${code}`,
        map: null,
      };
    },
  };
}
