import { neonAuthMiddleware } from '@neondatabase/auth/next/server';

export default neonAuthMiddleware({
  loginUrl: '/auth/sign-in',
});

export const config = {
  matcher: [
    '/dashboard',
    '/account',
    '/notes',
    '/((?!_next/static|_next/image|favicon.ico|).*)',
  ],
};
