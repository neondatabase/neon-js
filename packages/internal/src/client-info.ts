export interface ClientInfo {
  sdk: string;
  version: string;
  runtime: string;
  runtimeVersion: string;
  platform: string;
  arch: string;
  framework?: string;
}

declare const Deno: {
  version?: { deno?: string };
  build?: { os?: string; arch?: string };
};

declare const Bun: {
  version?: string;
};

declare const EdgeRuntime: string | undefined;

/**
 * Detects the JavaScript framework being used at runtime.
 * Detection order matters to avoid false positives (e.g., Next.js includes React).
 */
function detectFramework(): string | undefined {
  const g = globalThis as unknown as Record<string, unknown>;

  // Server-side detections (Node.js) - check first since server-side is more reliable
  // Next.js server
  if (
    typeof process !== 'undefined' &&
    process.env &&
    (process.env.NEXT_RUNTIME || process.env.__NEXT_PRIVATE_ORIGIN)
  ) {
    return 'next';
  }

  // Browser-only detections
  if (g.window !== undefined) {
    // Next.js (client-side) - check before React since Next.js includes React
    if (g.__NEXT_DATA__) return 'next';

    // Remix - check before React since Remix includes React
    if (g.__remixContext) return 'remix';

    // React (generic React apps)
    if (g.__REACT_DEVTOOLS_GLOBAL_HOOK__) return 'react';

    // Vue
    if (g.__VUE__) return 'vue';

    // Angular (zone.js is always bundled with Angular)
    if (g.Zone !== undefined) return 'angular';
  }

  return undefined;
}

export function getClientInfo(sdkName: string, sdkVersion: string): ClientInfo {
  const base: ClientInfo = {
    sdk: sdkName,
    version: sdkVersion,
    runtime: 'unknown',
    runtimeVersion: 'unknown',
    platform: 'unknown',
    arch: 'unknown',
  };

  let result: ClientInfo;

  // Node.js
  if (typeof process !== 'undefined' && process.versions?.node) {
    result = {
      ...base,
      runtime: 'node',
      runtimeVersion: process.versions.node,
      platform: process.platform,
      arch: process.arch,
    };
  }
  // Deno
  else if (typeof Deno !== 'undefined') {
    result = {
      ...base,
      runtime: 'deno',
      runtimeVersion: Deno.version?.deno ?? 'unknown',
      platform: Deno.build?.os ?? 'unknown',
      arch: Deno.build?.arch ?? 'unknown',
    };
  }
  // Bun
  else if (typeof Bun !== 'undefined') {
    result = {
      ...base,
      runtime: 'bun',
      runtimeVersion: Bun.version ?? 'unknown',
      platform: process?.platform ?? 'unknown',
      arch: process?.arch ?? 'unknown',
    };
  }
  // Edge Runtime (Vercel Edge, Cloudflare Workers, etc.)
  // Must check before browser since edge has no window/document
  // Note: Vercel Edge Runtime exposes EdgeRuntime global and provides a process polyfill,
  // so we check for EdgeRuntime explicitly OR detect process polyfill without Node.js
  else if (
    typeof EdgeRuntime !== 'undefined' ||
    (typeof process !== 'undefined' &&
      !process.versions?.node &&
      typeof globalThis.window === 'undefined' &&
      typeof document === 'undefined')
  ) {
    result = {
      ...base,
      runtime: 'edge',
    };
  }
  // Browser
  else if (globalThis.window !== undefined && typeof document !== 'undefined') {
    result = {
      ...base,
      runtime: 'browser',
      runtimeVersion: 'unknown',
      platform: 'web',
      arch: 'unknown',
    };
  } else {
    result = base;
  }

  // Add framework detection
  const framework = detectFramework();
  if (framework) {
    result.framework = framework;
  }

  return result;
}

export const X_NEON_CLIENT_INFO_HEADER = 'X-Neon-Client-Info';

export function createClientInfoInjector(
  defaultSdkName: string,
  defaultSdkVersion: string
) {
  return function injectClientInfo(
    headers: HeadersInit | undefined,
    sdkOverride?: { name: string; version: string }
  ): Headers {
    const result = new Headers(headers);

    if (result.has(X_NEON_CLIENT_INFO_HEADER)) {
      return result;
    }

    const sdkName = sdkOverride?.name ?? defaultSdkName;
    const sdkVersion = sdkOverride?.version ?? defaultSdkVersion;
    const clientInfo = getClientInfo(sdkName, sdkVersion);

    result.set(X_NEON_CLIENT_INFO_HEADER, JSON.stringify(clientInfo));

    return result;
  };
}
