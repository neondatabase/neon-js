import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
// eslint-disable-next-line unicorn/import-style
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const distDir = resolve(__dirname, 'dist');
const srcDir = resolve(__dirname, 'src');

/**
 * Extract class selectors from CSS using PostCSS.
 * Same logic as the build script.
 */
function extractClassesFromCSS(css: string): string[] {
  const root = postcss.parse(css);
  const classSet = new Set<string>();

  root.walkRules((rule) => {
    // CSS class names can contain:
    // - Simple chars: a-z, A-Z, 0-9, -, _ (unescaped)
    // - Escaped chars: \X where X is any non-whitespace character
    // The regex stops at unescaped combinator/pseudo chars like >, ), space, etc.
    for (const selector of rule.selectors) {
      const classMatches = selector.matchAll(
        /\.((?:[a-zA-Z0-9_-]|\\[^\s])+)/g
      );
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
 * Extract classes from HTML class attribute.
 */
function extractClassesFromHTML(html: string): string[] {
  const classMatch = html.match(/class="([^"]*)"/);
  if (!classMatch) return [];
  return classMatch[1].split(/\s+/).filter(Boolean).toSorted();
}

/**
 * Check if CSS contains any @layer at-rules.
 */
function hasLayerWrappers(css: string): boolean {
  const root = postcss.parse(css);
  let hasLayer = false;

  root.walkAtRules('layer', () => {
    hasLayer = true;
  });

  return hasLayer;
}

describe('CSS Build Output', () => {
  beforeAll(() => {
    // Run build before tests
    execSync('node build-css.mjs', {
      cwd: __dirname,
      stdio: 'inherit',
    });
  }, 60_000); // 60 second timeout for build

  describe('style.css', () => {
    it('is generated and exists', () => {
      const stylePath = resolve(distDir, 'style.css');
      expect(existsSync(stylePath)).toBe(true);
    });

    it('contains CSS rules (not empty)', () => {
      const stylePath = resolve(distDir, 'style.css');
      const css = readFileSync(stylePath, 'utf8');
      expect(css.length).toBeGreaterThan(1000); // Should have substantial CSS
    });

    it('contains expected utility patterns', () => {
      const stylePath = resolve(distDir, 'style.css');
      const css = readFileSync(stylePath, 'utf8');

      // Check for common Tailwind patterns
      expect(css).toContain('.flex');
      expect(css).toMatch(/\.bg-/);
      expect(css).toMatch(/\.text-/);
    });

    it('has no @layer wrappers (stripped for v3 compatibility)', () => {
      const stylePath = resolve(distDir, 'style.css');
      const css = readFileSync(stylePath, 'utf8');
      expect(hasLayerWrappers(css)).toBe(false);
    });

    it('matches snapshot', () => {
      const stylePath = resolve(distDir, 'style.css');
      const css = readFileSync(stylePath, 'utf8');
      expect(css).toMatchSnapshot();
    });

    it('is valid parseable CSS', () => {
      const stylePath = resolve(distDir, 'style.css');
      const css = readFileSync(stylePath, 'utf8');
      // PostCSS will throw if CSS is invalid
      expect(() => postcss.parse(css)).not.toThrow();
    });

    it('is minified (compact output)', () => {
      const stylePath = resolve(distDir, 'style.css');
      const css = readFileSync(stylePath, 'utf8');
      const lines = css.split('\n').filter((l) => l.trim());
      // Minified CSS should have very few lines relative to content
      // Typical: 1-50 lines for thousands of bytes
      expect(lines.length).toBeLessThan(100);
      // Average chars per line should be high for minified CSS
      expect(css.length / lines.length).toBeGreaterThan(50);
    });
  });

  describe('.safelist.html', () => {
    it('exists', () => {
      const safelistPath = resolve(distDir, '.safelist.html');
      expect(existsSync(safelistPath)).toBe(true);
    });

    it('contains all classes from style.css', () => {
      const stylePath = resolve(distDir, 'style.css');
      const safelistPath = resolve(distDir, '.safelist.html');

      const css = readFileSync(stylePath, 'utf8');
      const html = readFileSync(safelistPath, 'utf8');

      const cssClasses = extractClassesFromCSS(css);
      const htmlClasses = extractClassesFromHTML(html);

      // Safelist should contain exactly the same classes as style.css
      expect(htmlClasses).toEqual(cssClasses);
    });

    it('has unescaped class names (no CSS escape sequences)', () => {
      const safelistPath = resolve(distDir, '.safelist.html');
      const html = readFileSync(safelistPath, 'utf8');

      // Should not contain CSS escape sequences in class names
      // These would indicate the unescaping logic failed
      expect(html).not.toMatch(/\\:/); // No escaped colons
      expect(html).not.toMatch(/\\\[/); // No escaped brackets
      expect(html).not.toMatch(/\\\//); // No escaped slashes
    });

    it('contains variant classes with proper format', () => {
      const safelistPath = resolve(distDir, '.safelist.html');
      const html = readFileSync(safelistPath, 'utf8');

      // If hover variants exist, they should use : not \:
      if (html.includes('hover')) {
        expect(html).toMatch(/hover:/);
      }
      // If responsive prefixes exist, they should use : not \:
      if (html.includes('md')) {
        expect(html).toMatch(/md:/);
      }
    });
  });

  describe('theme-inline.css', () => {
    it('exists', () => {
      const themePath = resolve(distDir, 'theme-inline.css');
      expect(existsSync(themePath)).toBe(true);
    });

    it('contains @theme inline block', () => {
      const themePath = resolve(distDir, 'theme-inline.css');
      const css = readFileSync(themePath, 'utf8');
      expect(css).toContain('@theme inline');
    });

    it('matches snapshot', () => {
      const themePath = resolve(distDir, 'theme-inline.css');
      const css = readFileSync(themePath, 'utf8');
      expect(css).toMatchSnapshot();
    });
  });

  describe('theme.css', () => {
    it('exists', () => {
      const themePath = resolve(distDir, 'theme.css');
      expect(existsSync(themePath)).toBe(true);
    });

    it('contains resolved CSS (imports inlined)', () => {
      const themePath = resolve(distDir, 'theme.css');
      const css = readFileSync(themePath, 'utf8');

      // Should have actual CSS content, not just imports
      expect(css.length).toBeGreaterThan(100);
    });

    it('matches snapshot', () => {
      const themePath = resolve(distDir, 'theme.css');
      const css = readFileSync(themePath, 'utf8');
      expect(css).toMatchSnapshot();
    });

    it('is valid parseable CSS', () => {
      const themePath = resolve(distDir, 'theme.css');
      const css = readFileSync(themePath, 'utf8');
      // PostCSS will throw if CSS is invalid
      expect(() => postcss.parse(css)).not.toThrow();
    });

    it('has no unresolved @import statements', () => {
      const themePath = resolve(distDir, 'theme.css');
      const css = readFileSync(themePath, 'utf8');
      // All @import statements should be resolved/inlined by Tailwind
      expect(css).not.toMatch(/@import\s/);
    });
  });

  describe('tailwind.css', () => {
    it('exists', () => {
      const tailwindPath = resolve(distDir, 'tailwind.css');
      expect(existsSync(tailwindPath)).toBe(true);
    });

    it('has correct imports and source directive', () => {
      const tailwindPath = resolve(distDir, 'tailwind.css');
      const css = readFileSync(tailwindPath, 'utf8');

      expect(css).toContain("@import './theme.css'");
      expect(css).toContain("@import './theme-inline.css'");
      expect(css).toContain('@source "./.safelist.html"');
    });

    it('matches snapshot', () => {
      const tailwindPath = resolve(distDir, 'tailwind.css');
      const css = readFileSync(tailwindPath, 'utf8');
      expect(css).toMatchSnapshot();
    });
  });

  describe('consistency', () => {
    it('extracted class count is within expected range', () => {
      const stylePath = resolve(distDir, 'style.css');
      const css = readFileSync(stylePath, 'utf8');
      const classes = extractClassesFromCSS(css);

      // Should have a reasonable number of classes
      // Too few = extraction failed, too many = something went wrong
      expect(classes.length).toBeGreaterThan(100);
      expect(classes.length).toBeLessThan(10_000);
    });

    it('all output files are generated', () => {
      const expectedFiles = [
        'style.css',
        'theme.css',
        'theme-inline.css',
        'tailwind.css',
        '.safelist.html',
      ];

      for (const file of expectedFiles) {
        const filePath = resolve(distDir, file);
        expect(existsSync(filePath), `${file} should exist`).toBe(true);
      }
    });

    it('temp files are cleaned up after build', () => {
      // Build creates temporary files that should be deleted after completion
      expect(
        existsSync(resolve(srcDir, '.index.css.tmp')),
        '.index.css.tmp should be deleted'
      ).toBe(false);
      expect(
        existsSync(resolve(srcDir, '.theme.css.tmp')),
        '.theme.css.tmp should be deleted'
      ).toBe(false);
    });
  });

  describe('backwards compatibility', () => {
    it('has no CSS nesting syntax (flattened for browser compatibility)', () => {
      const stylePath = resolve(distDir, 'style.css');
      const css = readFileSync(stylePath, 'utf8');

      // CSS nesting (& selector) requires modern browser support
      // All selectors should be flattened for maximum compatibility
      // Pattern matches: { & (nested selector start)
      expect(css).not.toMatch(/\{\s*&\s/);
    });

    it('contains flattened SVG sizing utilities', () => {
      const stylePath = resolve(distDir, 'style.css');
      const css = readFileSync(stylePath, 'utf8');

      // These SVG utilities must be properly flattened (not using CSS nesting)
      // The selector pattern should be: .escaped-class-name svg:not(...)
      // Not: .escaped-class-name { & svg:not(...) }
      expect(css).toMatch(/svg:not\(\[class\*=size-\]\)/);
      expect(css).toMatch(/svg\{pointer-events:none\}/);
      expect(css).toMatch(/svg\{flex-shrink:0\}/);
    });

    it('SVG utilities have explicit size declarations', () => {
      const stylePath = resolve(distDir, 'style.css');
      const css = readFileSync(stylePath, 'utf8');

      // SVG sizing should use calc(var(--spacing)*4) for size-4
      // This ensures icons are properly sized (16px with default spacing)
      expect(css).toMatch(
        /svg:not\(\[class\*=size-\]\)\{width:calc\(var\(--spacing\)\*4\)/
      );
    });
  });
});
