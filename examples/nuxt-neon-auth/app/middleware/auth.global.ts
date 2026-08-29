const protectedPrefixes = ['/account', '/organization', '/notes'];

export default defineNuxtRouteMiddleware(async (to) => {
  // Nitro middleware is authoritative during SSR. This client guard covers
  // SPA navigation without duplicating cookie/session work on the server.
  if (import.meta.server) return;

  const protectedRoute = protectedPrefixes.some(
    prefix => to.path === prefix || to.path.startsWith(`${prefix}/`),
  );

  if (!protectedRoute) return;

  try {
    const result = await authClient.getSession();

    if (!result.data?.user) {
      return navigateTo({
        path: '/auth/sign-in',
        query: { redirect: to.fullPath },
      });
    }
  } catch {
    return navigateTo({
      path: '/auth/sign-in',
      query: { redirect: to.fullPath },
    });
  }
});
