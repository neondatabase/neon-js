import { describe, expect, test } from 'vitest';
import { parseSetCookies } from './cookies';

describe('parseSetCookies Max-Age', () => {
  test('parses a numeric Max-Age into a number', () => {
    const [cookie] = parseSetCookies('session=abc; Max-Age=3600; Path=/');
    expect(cookie.maxAge).toBe(3600);
  });

  test('yields undefined for a malformed Max-Age', () => {
    const [cookie] = parseSetCookies('session=abc; Max-Age=soon; Path=/');
    expect(cookie.maxAge).toBeUndefined();
  });

  test('keeps Max-Age=0 for deletion cookies', () => {
    const [cookie] = parseSetCookies('session=; Max-Age=0; Path=/');
    expect(cookie.maxAge).toBe(0);
  });
});
