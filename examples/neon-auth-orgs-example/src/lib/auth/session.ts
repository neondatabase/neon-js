/**
 * Neon Auth's getSession() returns a session with activeOrganizationId
 * added by the organization plugin, but the TypeScript types are narrow.
 * This helper extracts it safely.
 */
export function getActiveOrgId(session: {
  session: Record<string, unknown>;
}): string | null {
  const orgId = session.session.activeOrganizationId;
  return typeof orgId === "string" ? orgId : null;
}
