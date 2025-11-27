#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
// eslint-disable-next-line unicorn/import-style
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Resolve the absolute path to better-auth-ui source (for build time)
const betterAuthUiSrc = resolve(
  __dirname,
  '../../node_modules/@daveyplate/better-auth-ui/src'
);

// Relative path from dist/ to better-auth-ui (for consumers)
const betterAuthUiRelative = '../../@daveyplate/better-auth-ui/src';

console.log(`🔍 Scanning: ${betterAuthUiSrc}`);

// Build pre-built CSS (for consumers WITHOUT Tailwind)
const indexCssPath = resolve(__dirname, 'src/index.css');
const indexCss = readFileSync(indexCssPath, 'utf8');

// Append @source directive with absolute path (for build time only)
const indexCssWithSource =
  indexCss +
  `\n\n/* Auto-generated: Scan better-auth-ui source files */\n@source "${betterAuthUiSrc}/**/*.{ts,tsx}";\n`;

const tempIndexCssPath = resolve(__dirname, 'src/.index.css.tmp');
writeFileSync(tempIndexCssPath, indexCssWithSource, 'utf-8');

try {
  // Build pre-built CSS with all utilities
  execSync(
    `bunx tailwindcss -i ${tempIndexCssPath} -o ./dist/style.css --minify`,
    {
      cwd: __dirname,
      stdio: 'inherit',
    }
  );
  console.log('✅ Pre-built CSS (style.css) built successfully');

  // Copy theme.css for Tailwind users
  copyFileSync(
    resolve(__dirname, 'src/theme.css'),
    resolve(__dirname, 'dist/theme.css')
  );

  // Write tailwind.css with relative @source directive (for consumers)
  const distTailwindCss = `/* Tailwind-ready CSS for consumers WITH Tailwind */
/* Import this AFTER @import 'tailwindcss' in your CSS */
@import './theme.css';

/* Scan better-auth-ui source files for utility classes */
@source "${betterAuthUiRelative}/**/*.{ts,tsx}";
`;
  writeFileSync(
    resolve(__dirname, 'dist/tailwind.css'),
    distTailwindCss,
    'utf-8'
  );
  console.log('✅ Tailwind-ready CSS (tailwind.css) created successfully');
} catch (error) {
  console.error('❌ Failed to build CSS:', error.message);
  process.exit(1);
} finally {
  // Clean up temporary file
  try {
    const { unlinkSync } = await import('node:fs');
    unlinkSync(tempIndexCssPath);
  } catch {}
}
