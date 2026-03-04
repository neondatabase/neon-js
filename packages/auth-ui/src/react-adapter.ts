import type { ReactBetterAuthClient, VanillaBetterAuthClient } from '@/types';
import { useStore as useBetterAuthStore } from '@neondatabase/auth/react';

function isVanillaClient(
  client: VanillaBetterAuthClient | ReactBetterAuthClient
): client is VanillaBetterAuthClient {
  // React clients have useSession as a function
  // Vanilla clients have useSession as an atom (object with .get method)
  return typeof client.useSession !== 'function';
}

/**
 * Automatically adapt a vanilla better-auth client for React
 *
 * This function works with Proxy objects by creating a wrapper proxy that:
 * 1. Intercepts all property access
 * 2. Detects if it's a hook (starts with "use" and is an atom)
 * 3. Wraps atoms with useStore for React compatibility
 * 4. Passes through everything else unchanged
 */
function toReactClient<TClient extends VanillaBetterAuthClient>(
  vanillaClient: TClient
): ReactBetterAuthClient {
  // Cache for converted hooks to avoid recreating them

  const hookCache = new Map<string, () => any>();

  // Create a Proxy wrapper that intercepts property access
  return new Proxy(vanillaClient, {
    get(target, prop, receiver) {
      // Get the original value from the target (which might be a proxy itself)

      const value = Reflect.get(target, prop, receiver) as any;

      // Check if it's a hook property (starts with "use")
      if (
        typeof prop === 'string' &&
        prop.startsWith('use') &&
        value &&
        typeof value === 'object' &&
        'subscribe' in value &&
        'get' in value
      ) {
        // Check cache first
        if (hookCache.has(prop)) {
          return hookCache.get(prop);
        }

        // Create and cache the React hook wrapper
        const reactHook = function useReactHook() {
          // Runtime has all properties, vanilla types are incomplete

          return useBetterAuthStore(value);
        };

        hookCache.set(prop, reactHook);
        return reactHook;
      }

      // Return everything else as-is
      return value;
    },
  }) as ReactBetterAuthClient;
}

export function getReactClient(
  client: VanillaBetterAuthClient | ReactBetterAuthClient
): ReactBetterAuthClient {
  if (isVanillaClient(client)) {
    return toReactClient(client);
  }
  return client;
}
