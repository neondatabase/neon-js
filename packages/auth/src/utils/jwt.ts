/**
 * Extract expiration timestamp from JWT payload
 * @param jwt - The JWT token string
 * @returns Expiration timestamp in seconds (Unix time) or null if invalid
 */
export function getJwtExpiration(jwt: string): number | null {
  try {
    const parts = jwt.split('.');
    if (parts.length !== 3) {
      return null;
    }
    const payload = JSON.parse(atob(parts[1]));
    const exp = payload.exp;
    return typeof exp === 'number' ? exp : null;
  } catch {
    return null;
  }
}

/**
 * Extract expiration timestamp from JWT payload in milliseconds
 * @param jwt - The JWT token string
 * @returns Expiration timestamp in milliseconds or null if invalid
 */
export function getJwtExpirationMs(jwt: string): number | null {
  const exp = getJwtExpiration(jwt);
  return exp === null ? null : exp * 1000;
}

/**
 * Check if JWT is valid (not expired)
 * @param jwt - JWT string
 * @param bufferMs - Clock skew buffer in milliseconds (default: 10 seconds)
 * @returns true if JWT is not expired, false otherwise
 */
export function isJwtValid(jwt: string, bufferMs: number = 10_000): boolean {
  const expMs = getJwtExpirationMs(jwt);
  if (expMs === null) return false;
  return Date.now() < (expMs - bufferMs);
}
