#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
// eslint-disable-next-line unicorn/import-style
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Resolve the absolute path to better-auth-ui source (for build time scanning)
const betterAuthUiSrc = resolve(
  __dirname,
  '../../node_modules/@daveyplate/better-auth-ui/src'
);

console.log(`🔍 Scanning: ${betterAuthUiSrc}`);

/**
 * Extract all Tailwind classes from better-auth-ui source files
 * This allows us to generate utilities without shipping the @source directive
 */
function extractTailwindClasses(dir) {
  const classSet = new Set();

  // Separate regexes for each quote type to properly handle nested quotes
  // Pattern (?:\\.|[^X\\])* matches: escaped chars (\.) OR non-quote/non-backslash chars
  const classNameDoubleQuoteRegex = /className\s*[:=]\s*"((?:\\.|[^"\\])*)"/g;
  const classNameSingleQuoteRegex = /className\s*[:=]\s*'((?:\\.|[^'\\])*)'/g;
  const classNameBacktickRegex = /className\s*[:=]\s*`((?:\\.|[^`\\])*)`/g;

  const cnDoubleQuoteRegex = /cn\s*\(\s*"((?:\\.|[^"\\])*)"/g;
  const cnSingleQuoteRegex = /cn\s*\(\s*'((?:\\.|[^'\\])*)'/g;
  const cnBacktickRegex = /cn\s*\(\s*`((?:\\.|[^`\\])*)`/g;

  const allRegexes = [
    classNameDoubleQuoteRegex,
    classNameSingleQuoteRegex,
    classNameBacktickRegex,
    cnDoubleQuoteRegex,
    cnSingleQuoteRegex,
    cnBacktickRegex,
  ];

  function scanDirectory(directory) {
    const entries = readdirSync(directory);

    for (const entry of entries) {
      const fullPath = join(directory, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        scanDirectory(fullPath);
      } else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) {
        const content = readFileSync(fullPath, 'utf8');

        // Extract classes using all regex patterns
        for (const regex of allRegexes) {
          regex.lastIndex = 0;
          let match;
          while ((match = regex.exec(content)) !== null) {
            const classes = match[1].split(/\s+/).filter(Boolean);
            for (const cls of classes) classSet.add(cls);
          }
        }
      }
    }
  }

  try {
    scanDirectory(dir);
  } catch (error) {
    console.warn(`⚠️  Could not scan directory: ${error.message}`);
  }

  return [...classSet].sort();
}


/**
 * Extract the @theme inline { ... } block from CSS content
 * This preserves the theme configuration for consumers with their own Tailwind
 */
function extractThemeInline(cssContent) {
  // Match @theme inline { ... } block (handles nested braces)
  const match = cssContent.match(
    /@theme\s+inline\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/
  );
  return match ? match[0] : null;
}

console.log('🔍 Extracting Tailwind classes from better-auth-ui...');
const extractedClasses = extractTailwindClasses(betterAuthUiSrc);
console.log(`✅ Found ${extractedClasses.length} unique Tailwind classes`);

// Build pre-built CSS (for consumers WITHOUT Tailwind)
const indexCssPath = resolve(__dirname, 'src/index.css');
const indexCss = readFileSync(indexCssPath, 'utf8');

// Append @source directive with absolute path (for build time only)
const indexCssWithSource =
  indexCss +
  `\n\n/* Auto-generated: Scan better-auth-ui source files */\n@source "${betterAuthUiSrc}/**/*.{ts,tsx}";\n`;

const tempIndexCssPath = resolve(__dirname, 'src/.index.css.tmp');
writeFileSync(tempIndexCssPath, indexCssWithSource, 'utf-8');

// Temp file for theme.css with @source directive (for build time)
const themeCssPath = resolve(__dirname, 'src/theme.css');
const themeCss = readFileSync(themeCssPath, 'utf8');
const themeCssWithSource =
  themeCss +
  `\n\n/* Auto-generated: Scan better-auth-ui source files */\n@source "${betterAuthUiSrc}/**/*.{ts,tsx}";\n`;
const tempThemeCssPath = resolve(__dirname, 'src/.theme.css.tmp');
writeFileSync(tempThemeCssPath, themeCssWithSource, 'utf-8');

try {
  // Build pre-built CSS with all utilities (style.css)
  execSync(
    `bunx tailwindcss -i ${tempIndexCssPath} -o ./dist/style.css --minify`,
    {
      cwd: __dirname,
      stdio: 'inherit',
    }
  );
  console.log('✅ Pre-built CSS (style.css) built successfully');

  // Build theme.css through Tailwind to resolve @imports and inline external CSS
  // This resolves @import '@daveyplate/better-auth-ui/css' at build time
  execSync(`bunx tailwindcss -i ${tempThemeCssPath} -o ./dist/theme.css`, {
    cwd: __dirname,
    stdio: 'inherit',
  });
  console.log('✅ Theme CSS (theme.css) built successfully');

  // Extract @theme inline block for consumers with their own Tailwind
  const themeInlineBlock = extractThemeInline(themeCss);
  if (themeInlineBlock) {
    const themeInlinePath = resolve(__dirname, 'dist/theme-inline.css');
    writeFileSync(
      themeInlinePath,
      `/* Extracted from src/theme.css */\n${themeInlineBlock}\n`,
      'utf-8'
    );
    console.log('✅ Theme inline block extracted to theme-inline.css');
  } else {
    console.warn('⚠️  No @theme inline block found in theme.css');
  }

  // Create a safelist file with all extracted classes
  // This allows Tailwind to generate utilities without @source directive
  const safelistContent = `<!-- Auto-generated safelist for better-auth-ui classes -->
<!-- This file ensures all necessary utilities are generated -->
<div class="${extractedClasses.join(' ')}"></div>
`;
  const safelistPath = resolve(__dirname, 'dist/.safelist.html');
  writeFileSync(safelistPath, safelistContent, 'utf-8');

  // Write tailwind.css WITH @source pointing to our safelist
  // This avoids referencing the @daveyplate package
  const distTailwindCss = `/* Tailwind-ready CSS for consumers WITH Tailwind */
/* Import this AFTER @import 'tailwindcss' in your CSS */
@import './theme.css';
@import './theme-inline.css';

/* Safelist: All Tailwind classes used by better-auth-ui components */
@source "./.safelist.html";
`;
  writeFileSync(
    resolve(__dirname, 'dist/tailwind.css'),
    distTailwindCss,
    'utf-8'
  );
  console.log('✅ Tailwind-ready CSS (tailwind.css) created successfully');
  console.log(
    `✅ Safelist file created with ${extractedClasses.length} classes`
  );
} catch (error) {
  console.error('❌ Failed to build CSS:', error.message);
  process.exit(1);
} finally {
  // Clean up temporary files
  try {
    const { unlinkSync } = await import('node:fs');
    unlinkSync(tempIndexCssPath);
    unlinkSync(tempThemeCssPath);
  } catch {}
}
