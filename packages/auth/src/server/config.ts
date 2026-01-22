/**
 * Framework-agnostic configuration types for Neon Auth
 *
 * These configuration types are used across all server frameworks
 * (Next.js, Remix, SvelteKit, TanStack Start, etc.)
 */

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
	cookieSecret: string;
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
 * Validates cookie secret meets security requirements
 * @param secret - The cookie secret to validate
 * @throws Error if secret is too short (< 32 characters)
 */
export function validateCookieSecret(secret: string): void {
	if (secret.length < 32) {
		throw new Error(
			'cookieSecret must be at least 32 characters long for security. ' +
				'Generate a secure secret with: openssl rand -base64 32'
		);
	}
}
