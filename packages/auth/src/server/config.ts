/**
 * Framework-agnostic configuration types for Neon Auth
 */

import { ERRORS } from "./errors";

/**
 * Session cookie configuration
 */
export interface SessionCookieConfig {
	/**
	 * Secret for signing session data cookies (enables session caching)
	 * Must be at least 32 characters for security.
	 *
	 * Generate a secure secret:
	 * ```bash
	 * openssl rand -base64 32
	 * ```
	 *
	 * @example process.env.NEON_AUTH_COOKIE_SECRET
	 */
	secret: string;

	/**
	 * Time-to-live for cached session data in seconds
	 *
	 * Controls how long session data is cached in a signed cookie before
	 * requiring re-validation with the upstream auth server. 
	 * Note: this does not affect the session token cookie TTL.
	 *
	 * @default 300 (5 minutes)
	 * @example 60 // Cache for 1 minute
	 * @example 600 // Cache for 10 minutes
	 */
	sessionDataTtl?: number;

	/**
	 * Cookie domain for all Neon Auth cookies
	 *
	 * @default undefined (browser default - current domain only)
	 * @example '.example.com' // Share across subdomains
	 */
	domain?: string;
}

/**
 * Base configuration for Neon Auth server utilities
 */
export interface NeonAuthConfig {
	/**
	 * Base URL for the Neon Auth server
	 * @example 'https://ep-xxxx.neonauth.us-east-1.aws.neon.tech'
	 */
	baseUrl: string;

	/**
	 * Cookie configuration
	 */
	cookies: SessionCookieConfig;
}

/**
 * Configuration for Neon Auth middleware
 * Extends base config with middleware-specific options
 */
export interface NeonAuthMiddlewareConfig extends NeonAuthConfig {
	/**
	 * URL to redirect to when user is not authenticated
	 * @default '/auth/sign-in'
	 */
	loginUrl?: string;
}

/**
 * Validates cookie configuration meets security requirements
 * @param cookies - The cookie configuration to validate
 * @throws Error if secret is too short (< 32 characters)
 */
export function validateCookieConfig(cookies: SessionCookieConfig): void {
	if (!cookies.secret) {
		throw new Error(ERRORS.MISSING_COOKIE_SECRET);
	}

	if (cookies.secret.length < 32) {
		throw new Error(ERRORS.COOKIE_SECRET_TOO_SHORT);
	}

	if (cookies.sessionDataTtl !== undefined && cookies.sessionDataTtl <= 0) {
		throw new Error(ERRORS.INVALID_SESSION_DATA_TTL);
	}
}
