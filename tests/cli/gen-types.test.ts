import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import { parseDuration } from '@/cli/utils/parse-duration';

describe('gen-types CLI', () => {
  const CLI_PATH = './dist/cli/index.js';

  beforeAll(() => {
    execSync('bun run build', { stdio: 'inherit' });
  });

  it('should show help with --help flag', () => {
    const output = execSync(`node ${CLI_PATH} gen-types --help`, {
      encoding: 'utf-8',
    });
    expect(output).toContain('Usage');
    expect(output).toContain('--db-url');
    expect(output).toContain('--output');
  });

  it('should show help with --help flag even without required flags', () => {
    // This tests the exact scenario reported:
    // "neon-js gen-types --help" should show help, not error about missing --db-url
    const output = execSync(`node ${CLI_PATH} gen-types --help`, {
      encoding: 'utf-8',
    });
    expect(output).toContain('Usage');
    expect(output).toContain('Required Options');
    expect(output).toContain('--db-url');
    // Should NOT contain the error message
    expect(output).not.toContain('Error: --db-url is required');
  });

  it('should show error when --db-url is missing', () => {
    try {
      execSync(`node ${CLI_PATH} gen-types`, {
        encoding: 'utf-8',
        stdio: 'pipe',
      });
    } catch (error: any) {
      const output = error.stderr?.toString() || error.stdout?.toString() || '';
      expect(output).toContain('--db-url');
    }
  });

  it('should parse duration strings correctly', () => {
    expect(parseDuration('30s')).toBe(30000);
    expect(parseDuration('1m')).toBe(60000);
    expect(parseDuration('90s')).toBe(90000);
    expect(parseDuration('2h')).toBe(7200000);
  });

  it('should throw error for invalid duration format', () => {
    expect(() => parseDuration('invalid')).toThrow('Invalid duration format');
    expect(() => parseDuration('30x')).toThrow('Invalid duration format');
  });
});
