#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
// eslint-disable-next-line unicorn/import-style
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Resolve the absolute path to better-auth-ui source
const betterAuthUiSrc = resolve(
  __dirname,
  '../../node_modules/@daveyplate/better-auth-ui/src'
);

// Read the source CSS file and add the @source directive with absolute path
const sourceCssPath = resolve(__dirname, 'src/index.css');
const sourceCss = readFileSync(sourceCssPath, 'utf8');

// Append @source directive with absolute path at the end
const templateCss =
  sourceCss +
  `\n\n/* Auto-generated: Scan better-auth-ui source files */\n@source "${betterAuthUiSrc}/**/*.{ts,tsx}";\n`;

// Write temporary CSS file with absolute path
const tempCssPath = resolve(__dirname, 'src/.index.css.tmp');
writeFileSync(tempCssPath, templateCss, 'utf-8');

console.log(`🔍 Scanning: ${betterAuthUiSrc}`);

try {
  // Run TailwindCSS CLI with the temporary file
  execSync(`bunx tailwindcss -i ${tempCssPath} -o ./dist/style.css --minify`, {
    cwd: __dirname,
    stdio: 'inherit',
  });

  console.log('✅ CSS built successfully');
} catch (error) {
  console.error('❌ Failed to build CSS:', error.message);
  process.exit(1);
} finally {
  // Clean up temporary file
  try {
    const { unlinkSync } = await import('node:fs');
    unlinkSync(tempCssPath);
  } catch {}
}
