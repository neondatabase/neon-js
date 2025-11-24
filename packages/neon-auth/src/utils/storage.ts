import { isBrowser } from './browser';
import { getJwtExpirationMs } from './jwt';

/**
 * Storage key constants for token persistence
 */
export const STORAGE_PREFIX = 'neon_auth';
export const STORAGE_KEYS = {
  token: `${STORAGE_PREFIX}:bearer_token`,
  metadata: `${STORAGE_PREFIX}:token_metadata`,
} as const;

/**
 * Token metadata stored alongside the token
 */
export interface TokenMetadata {
  expiresAt: number;
  createdAt: number;
}

/**
 * Interface for token storage implementations
 * Provides a consistent API for both browser and Node.js environments
 */
export interface TokenStorage {
  /**
   * Get the stored token if valid and not expired
   * @returns The token string or null if not found/expired
   */
  getToken(): string | null;

  /**
   * Store a token with optional expiration
   * @param token - The JWT token string
   * @param expiresAt - Optional Unix timestamp (ms) when token expires
   */
  setToken(token: string, expiresAt?: number): void;

  /**
   * Clear the stored token and metadata
   */
  clearToken(): void;

  /**
   * Invalidate the token (marks as invalid but doesn't clear immediately)
   * Useful for sign-out scenarios where in-flight requests should not use the token
   */
  invalidateToken(): void;

  /**
   * Get token metadata if available
   * @returns Token metadata or null
   */
  getTokenMetadata(): TokenMetadata | null;
}

/**
 * Browser-based token storage using localStorage
 * Automatically clears expired tokens on retrieval
 */
class BrowserStorage implements TokenStorage {
  private invalidated = false;

  getToken(): string | null {
    if (this.invalidated) {
      return null;
    }

    try {
      const token = localStorage.getItem(STORAGE_KEYS.token);
      if (!token) {
        return null;
      }

      // Check if token is expired
      const metadata = this.getTokenMetadata();
      if (
        metadata &&
        metadata.expiresAt > 0 &&
        Date.now() > metadata.expiresAt
      ) {
        console.log('[BrowserStorage] Token expired, clearing');
        this.clearToken();
        return null;
      }

      return token;
    } catch (error) {
      console.warn('[BrowserStorage] Error reading token:', error);
      return null;
    }
  }

  setToken(token: string, expiresAt?: number): void {
    if (this.invalidated) {
      console.log('[BrowserStorage] Storage invalidated, skipping setToken');
      return;
    }

    try {
      localStorage.setItem(STORAGE_KEYS.token, token);

      const metadata: TokenMetadata = {
        expiresAt: expiresAt ?? getJwtExpirationMs(token) ?? 0,
        createdAt: Date.now(),
      };
      localStorage.setItem(STORAGE_KEYS.metadata, JSON.stringify(metadata));

      console.log('[BrowserStorage] Token stored', {
        expiresAt: metadata.expiresAt
          ? new Date(metadata.expiresAt).toISOString()
          : 'none',
      });
    } catch (error) {
      console.warn('[BrowserStorage] Error storing token:', error);
    }
  }

  clearToken(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.token);
      localStorage.removeItem(STORAGE_KEYS.metadata);
      this.invalidated = false;
      console.log('[BrowserStorage] Token cleared');
    } catch (error) {
      console.warn('[BrowserStorage] Error clearing token:', error);
    }
  }

  invalidateToken(): void {
    this.invalidated = true;
    console.log('[BrowserStorage] Token invalidated');
  }

  getTokenMetadata(): TokenMetadata | null {
    try {
      const metadataStr = localStorage.getItem(STORAGE_KEYS.metadata);
      if (!metadataStr) {
        return null;
      }
      return JSON.parse(metadataStr) as TokenMetadata;
    } catch {
      return null;
    }
  }
}

/**
 * In-memory token storage for Node.js/SSR environments
 * Tokens are not persisted across process restarts
 */
class MemoryStorage implements TokenStorage {
  private token: string | null = null;
  private metadata: TokenMetadata | null = null;
  private invalidated = false;

  getToken(): string | null {
    if (this.invalidated) {
      return null;
    }

    if (!this.token) {
      return null;
    }

    // Check if token is expired
    if (
      this.metadata &&
      this.metadata.expiresAt > 0 &&
      Date.now() > this.metadata.expiresAt
    ) {
      console.log('[MemoryStorage] Token expired, clearing');
      this.clearToken();
      return null;
    }

    return this.token;
  }

  setToken(token: string, expiresAt?: number): void {
    if (this.invalidated) {
      console.log('[MemoryStorage] Storage invalidated, skipping setToken');
      return;
    }

    this.token = token;
    this.metadata = {
      expiresAt: expiresAt ?? getJwtExpirationMs(token) ?? 0,
      createdAt: Date.now(),
    };

    console.log('[MemoryStorage] Token stored', {
      expiresAt: this.metadata.expiresAt
        ? new Date(this.metadata.expiresAt).toISOString()
        : 'none',
    });
  }

  clearToken(): void {
    this.token = null;
    this.metadata = null;
    this.invalidated = false;
    console.log('[MemoryStorage] Token cleared');
  }

  invalidateToken(): void {
    this.invalidated = true;
    console.log('[MemoryStorage] Token invalidated');
  }

  getTokenMetadata(): TokenMetadata | null {
    return this.metadata;
  }
}

/**
 * Factory function to create the appropriate token storage
 * based on the current environment
 * @returns TokenStorage instance (BrowserStorage or MemoryStorage)
 */
export function createTokenStorage(): TokenStorage {
  return isBrowser() ? new BrowserStorage() : new MemoryStorage();
}

/**
 * Singleton token storage instance for use across the auth adapter
 * Auto-detects environment and uses appropriate storage implementation
 */
export const BETTER_AUTH_TOKEN_STORAGE = createTokenStorage();
