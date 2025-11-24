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
