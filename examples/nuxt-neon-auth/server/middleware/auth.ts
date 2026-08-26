const protectedRoutes = ['/account', '/organization', '/notes'] as const;

export default defineEventHandler(async (event) => {
  const middleware = createEventAuth(event).middleware({
    loginUrl: '/auth/sign-in',
    protectedRoutes,
  });

  return middleware(event);
});
