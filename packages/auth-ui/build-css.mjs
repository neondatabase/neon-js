#!/usr/bin/env node
/* eslint-disable no-undef */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
// eslint-disable-next-line unicorn/import-style
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Resolve the absolute path to better-auth-ui source (for build time scanning)
const betterAuthUiSrc = resolve(
  __dirname,
  '../../node_modules/@daveyplate/better-auth-ui/src'
);

console.log(`📦 Building CSS with source: ${betterAuthUiSrc}`);

/**
 * Extract class selectors from generated CSS using PostCSS.
 * This leverages Tailwind's own class extraction by parsing its output.
 */
function extractClassesFromCSS(cssPath) {
  const css = readFileSync(cssPath, 'utf8');
  const root = postcss.parse(css, { from: cssPath });
  const classSet = new Set();

  root.walkRules((rule) => {
    // Parse selector to extract class names
    // CSS class names can contain:
    // - Simple chars: a-z, A-Z, 0-9, -, _ (unescaped)
    // - Escaped chars: \X where X is any non-whitespace character
    // The regex stops at unescaped combinator/pseudo chars like >, ), space, etc.
    for (const selector of rule.selectors) {
      const classMatches = selector.matchAll(/\.((?:[a-zA-Z0-9_-]|\\[^\s])+)/g);
      for (const match of classMatches) {
        // Unescape CSS escapes (e.g., \: → :, \[ → [)
        const className = match[1].replaceAll(/\\(.)/g, '$1');
        classSet.add(className);
      }
    }
  });

  return [...classSet].toSorted();
}

/**
 * Extract the @theme inline { ... } block from CSS content using PostCSS.
 * Uses proper CSS AST parsing for robustness (handles nested braces, comments, etc.)
 * This preserves the theme configuration for consumers with their own Tailwind.
 */
function extractThemeInline(cssContent, fromPath) {
  const root = postcss.parse(cssContent, { from: fromPath });
  let themeInlineBlock = null;

  root.walkAtRules('theme', (rule) => {
    if (rule.params === 'inline') {
      themeInlineBlock = rule.toString();
    }
  });

  return themeInlineBlock;
}

/**
 * Strip @layer wrappers from CSS for Tailwind v3 compatibility.
 * Uses PostCSS for proper CSS parsing (handles all edge cases).
 * - @layer X { content } -> content (unwrapped)
 * - @layer X; -> removed entirely
 */
async function stripLayerWrappers(cssPath) {
  const css = readFileSync(cssPath, 'utf8');

  const result = await postcss([
    {
      postcssPlugin: 'strip-layer-wrappers',
      AtRule: {
        layer(atRule) {
          if (atRule.nodes && atRule.nodes.length > 0) {
            atRule.replaceWith(atRule.nodes);
          } else {
            atRule.remove();
          }
        },
      },
    },
  ]).process(css, { from: cssPath });

  writeFileSync(cssPath, result.css, 'utf8');
}

// Build pre-built CSS (for consumers WITHOUT Tailwind)
const indexCssPath = resolve(__dirname, 'src/index.css');
const indexCss = readFileSync(indexCssPath, 'utf8');

// Append @source directive with absolute path (for build time only)
const indexCssWithSource =
  indexCss +
  `\n\n/* Auto-generated: Scan better-auth-ui source files */\n@source "${betterAuthUiSrc}/**/*.{ts,tsx}";\n`;

const tempIndexCssPath = resolve(__dirname, 'src/.index.css.tmp');
writeFileSync(tempIndexCssPath, indexCssWithSource, 'utf8');

// Temp file for theme.css with @source directive (for build time)
const themeCssPath = resolve(__dirname, 'src/theme.css');
const themeCss = readFileSync(themeCssPath, 'utf8');
const themeCssWithSource =
  themeCss +
  `\n\n/* Auto-generated: Scan better-auth-ui source files */\n@source "${betterAuthUiSrc}/**/*.{ts,tsx}";\n`;
const tempThemeCssPath = resolve(__dirname, 'src/.theme.css.tmp');
writeFileSync(tempThemeCssPath, themeCssWithSource, 'utf8');

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

  // Extract class selectors from generated CSS using PostCSS
  // This leverages Tailwind's own class extraction via its output
  const extractedClasses = extractClassesFromCSS(
    resolve(__dirname, 'dist/style.css')
  );
  console.log(
    `✅ Extracted ${extractedClasses.length} classes from generated CSS`
  );

  // Strip @layer wrappers for Tailwind v3 compatibility
  // This includes both @layer base and @layer neon-auth
  await stripLayerWrappers(resolve(__dirname, 'dist/style.css'));
  console.log(
    '✅ Stripped @layer wrappers from style.css for v3 compatibility'
  );

  // Build theme.css through Tailwind to resolve @imports and inline external CSS
  // This resolves @import '@daveyplate/better-auth-ui/css' at build time
  execSync(`bunx tailwindcss -i ${tempThemeCssPath} -o ./dist/theme.css`, {
    cwd: __dirname,
    stdio: 'inherit',
  });
  console.log('✅ Theme CSS (theme.css) built successfully');

  // Extract @theme inline block for consumers with their own Tailwind
  const themeInlineBlock = extractThemeInline(themeCss, themeCssPath);
  let themeInlineImport = '';

  if (themeInlineBlock) {
    const themeInlinePath = resolve(__dirname, 'dist/theme-inline.css');
    writeFileSync(
      themeInlinePath,
      `/* Extracted from src/theme.css */\n${themeInlineBlock}\n`,
      'utf8'
    );
    console.log('✅ Theme inline block extracted to theme-inline.css');
    themeInlineImport = "@import './theme-inline.css';\n";
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
  writeFileSync(safelistPath, safelistContent, 'utf8');

  // Write tailwind.css WITH @source pointing to our safelist
  // This avoids referencing the @daveyplate package
  const distTailwindCss = `/* Tailwind-ready CSS for consumers WITH Tailwind v4 */
/* Import this AFTER @import 'tailwindcss' in your CSS */
@import './theme.css';
${themeInlineImport}
/* Safelist: All Tailwind classes used by better-auth-ui components */
@source "./.safelist.html";
`;
  writeFileSync(
    resolve(__dirname, 'dist/tailwind.css'),
    distTailwindCss,
    'utf8'
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
  } catch (error) {
    console.error('❌ Failed to clean up temporary files:', error.message);
    process.exit(1);
  }
}
