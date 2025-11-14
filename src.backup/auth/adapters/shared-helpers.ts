/**
 * Shared utility functions for authentication adapters
 * Based on Supabase's auth-js implementation patterns
 */

/**
 * Checks if the code is running in a browser environment
 * @returns true if in browser, false otherwise (e.g., Node.js)
 */
export const isBrowser = (): boolean => {
  return globalThis.window !== undefined && typeof document !== 'undefined';
};

/**
 * Checks if BroadcastChannel API is available
 * Used for cross-tab authentication state synchronization
 * @returns true if BroadcastChannel is available (browser only)
 */
export const supportsBroadcastChannel = (): boolean => {
  return isBrowser() && globalThis.BroadcastChannel !== undefined;
};

/**
 * Helper to convert date to ISO string
 * Handles string, Date, number, undefined, and null inputs
 * @param date - The date value to convert (string, Date, number, undefined, or null)
 * @returns ISO string representation of the date
 */
export function toISOString(
  date: string | Date | number | undefined | null
): string {
  if (!date) {
    return new Date().toISOString(); // Fallback to current time
  }
  if (typeof date === 'string') {
    return date; // Already ISO string
  }
  if (typeof date === 'number') {
    return new Date(date).toISOString(); // Convert timestamp to ISO string
  }
  // Date object
  return date.toISOString();
}
