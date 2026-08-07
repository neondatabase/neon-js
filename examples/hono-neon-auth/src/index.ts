import { Hono } from 'hono';
import { contextStorage } from 'hono/context-storage';
import { serve } from '@hono/node-server';
import { auth } from './auth.js';

const app = new Hono();

// REQUIRED: `contextStorage()` must be registered so `auth.getSession()`
// (and every other server method) can resolve the in-flight request from
// within downstream handlers.
app.use(contextStorage());

// Mount the auth proxy at /api/auth/*.
app.on(['GET', 'POST'], '/api/auth/*', auth.handler());

// Protect everything else. `/sign-in` (loginUrl) and paths listed in
// DEFAULT_AUTH_SKIP_ROUTES are automatically excluded from protection.
app.use('*', auth.middleware({ loginUrl: '/sign-in' }));

app.get('/sign-in', (c) =>
  c.html(
    `<!doctype html>
     <html><head><title>Sign in</title></head><body>
       <h1>Sign in</h1>
       <p>Public sign-in page (skipped by <code>auth.middleware</code>).</p>
       <p>Wire your Neon Auth sign-in form here.</p>
       <p><a href="/">Home</a></p>
     </body></html>`
  )
);

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

app.get('/dashboard', async (c) => {
  const { data: session } = await auth.getSession();
  return c.json({
    protected: true,
    user: session?.user ?? null,
    hint:
      'If you can read this you are authenticated. The `auth.middleware()` ' +
      'redirects unauthenticated requests to /sign-in before they get here.',
  });
});

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port }, ({ port }) => {
  console.log(`Hono + Neon Auth listening on http://localhost:${port}`);
});
