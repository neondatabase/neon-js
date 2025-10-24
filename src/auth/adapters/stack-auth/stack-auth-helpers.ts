/**
 * Environment detection helpers for Stack Auth adapter
 * Based on Supabase's auth-js implementation patterns
 */

/**
 * Checks if the code is running in a browser environment
 * @returns true if in browser, false otherwise (e.g., Node.js)
 */
export const isBrowser = (): boolean => {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
};

/**
 * Checks if BroadcastChannel API is available
 * Used for cross-tab authentication state synchronization
 * @returns true if BroadcastChannel is available (browser only)
 */
export const supportsBroadcastChannel = (): boolean => {
  return isBrowser() && typeof globalThis.BroadcastChannel !== 'undefined';
};
