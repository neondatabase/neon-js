import pkg from '../../package.json' with { type: 'json' };

/**
 * SDK identification for HTTP requests.
 * Sent as X-Neon-Client-Info header for analytics (Segment).
 */

export interface ClientInfo {
  sdk: string;
  version: string;
  runtime: string;
  runtimeVersion: string;
  platform: string;
  arch: string;
}

declare const Deno: {
  version?: { deno?: string };
  build?: { os?: string; arch?: string };
};

declare const Bun: {
  version?: string;
};

/**
 * Detects runtime environment and returns client info.
 */
function getClientInfo(sdkName: string, sdkVersion: string): ClientInfo {
  const base: ClientInfo = {
    sdk: sdkName,
    version: sdkVersion,
    runtime: 'unknown',
    runtimeVersion: 'unknown',
    platform: 'unknown',
    arch: 'unknown',
  };

  // Node.js detection
  if (typeof process !== 'undefined' && process.versions?.node) {
    return {
      ...base,
      runtime: 'node',
      runtimeVersion: process.versions.node,
      platform: process.platform,
      arch: process.arch,
    };
  }

  // Deno detection
  if (Deno !== undefined) {
    return {
      ...base,
      runtime: 'deno',
      runtimeVersion: Deno.version?.deno ?? 'unknown',
      platform: Deno.build?.os ?? 'unknown',
      arch: Deno.build?.arch ?? 'unknown',
    };
  }

  // Bun detection
  if (Bun !== undefined) {
    return {
      ...base,
      runtime: 'bun',
      runtimeVersion: Bun.version ?? 'unknown',
      platform: process?.platform ?? 'unknown',
      arch: process?.arch ?? 'unknown',
    };
  }

  // Browser detection
  if (globalThis.window !== undefined && typeof document !== 'undefined') {
    return {
      ...base,
      runtime: 'browser',
      runtimeVersion: 'unknown',
      platform: 'web',
      arch: 'unknown',
    };
  }

  // Edge runtime (Cloudflare Workers, Vercel Edge, etc.)
  if (typeof globalThis !== 'undefined' && !('process' in globalThis)) {
    return {
      ...base,
      runtime: 'edge',
    };
  }

  return base;
}

// Package-specific defaults (derived from package.json)
const DEFAULT_SDK_NAME = pkg.name;
const DEFAULT_SDK_VERSION = pkg.version;

export const X_NEON_CLIENT_INFO_HEADER = 'X-Neon-Client-Info';

/**
 * Injects X-Neon-Client-Info header for SDK identification.
 *
 * If headers already contain the header (from parent package like neon-js),
 * they are preserved to avoid double-injection.
 *
 * @param headers - Existing headers to augment
 * @param sdkOverride - Optional SDK name/version override (used by neon-js to identify itself)
 */
export function injectClientInfo(
  headers: HeadersInit | undefined,
  sdkOverride?: { name: string; version: string }
): Headers {
  const result = new Headers(headers);

  // If already has our header, a parent SDK (neon-js) already identified itself
  if (result.has(X_NEON_CLIENT_INFO_HEADER)) {
    return result;
  }

  const sdkName = sdkOverride?.name ?? DEFAULT_SDK_NAME;
  const sdkVersion = sdkOverride?.version ?? DEFAULT_SDK_VERSION;
  const clientInfo = getClientInfo(sdkName, sdkVersion);

  result.set(X_NEON_CLIENT_INFO_HEADER, JSON.stringify(clientInfo));

  return result;
}

// Re-export for packages that need to build custom client info
export { getClientInfo };
