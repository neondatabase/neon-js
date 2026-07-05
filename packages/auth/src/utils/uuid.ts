/**
 * Generates a random UUID v4 in a cross-platform way.
 * Works in browsers, Node.js, and Cloudflare Workers.
 *
 * Cloudflare Workers don't support `crypto.randomUUID()` — only
 * `crypto.getRandomValues()` is available. This function uses the
 * latter with a UUID-v4 template, which is supported everywhere.
 */
export function generateUUID(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  // Set version 4 (0100 in binary, 0x40 mask)
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  // Set variant bits (10xx in binary, 0x80 mask)
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
