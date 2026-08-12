import { Hono } from 'hono';
import { contextStorage } from 'hono/context-storage';
import { serve } from '@hono/node-server';
import { auth } from './auth.js';

const app = new Hono();

// REQUIRED: `contextStorage()` must be registered before anything that
// calls `auth.*` methods, so `auth.getSession()` can resolve the in-flight
// request from downstream handlers.
app.use(contextStorage());

// Auth proxy endpoints — always public.
app.on(['GET', 'POST'], '/api/auth/*', auth.handler());

// Public routes — no `auth.middleware()`, but `auth.getSession()` still
// works here because `contextStorage()` (above) is active on every path.
app.get('/', async (c) => {
  const { data: session } = await auth.getSession();
  const who = session?.user ? session.user.name ?? session.user.email : null;
  return c.html(
    `<!doctype html>
     <html><head><title>Hono + Neon Auth</title></head><body>
       <h1>Hono + Neon Auth</h1>
       ${who ? `<p>Hello, <strong>${who}</strong>.</p>` : '<p>Not signed in.</p>'}
       <p><a href="/dashboard">Dashboard (protected)</a></p>
       <p><a href="/api/auth/sign-out">Sign out</a></p>
     </body></html>`
  );
});

app.get('/sign-in', (c) =>
  c.html(
    `<!doctype html>
     <html><head><title>Sign in</title></head><body>
       <h1>Sign in</h1>
       <p>Public sign-in page. Wire your Neon Auth sign-in form here.</p>
       <p><a href="/">Home</a></p>
     </body></html>`
  )
);

// Protected routes — scope `auth.middleware()` to just the paths that
// require authentication. Requests hitting `/dashboard` without a valid
// session are 302-redirected to `loginUrl`; anything else falls through
// to the route handler with `auth.getSession()` guaranteed to return a
// user. For a subtree (`/dashboard`, `/dashboard/settings`, ...) also
// register `app.use('/dashboard/*', ...)`.
app.use('/dashboard', auth.middleware({ loginUrl: '/sign-in' }));

app.get('/dashboard', async (c) => {
  const { data: session } = await auth.getSession();
  return c.json({
    protected: true,
    user: session?.user ?? null,
    hint:
      'If you can read this you are authenticated. `auth.middleware()` on ' +
      '/dashboard redirected unauthenticated requests to /sign-in before ' +
      'reaching this handler.',
  });
});

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port }, ({ port }) => {
  console.log(`Hono + Neon Auth listening on http://localhost:${port}`);
});
