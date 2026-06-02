# Building a Neon Auth framework adapter

This guide shows how to build a `@neondatabase/auth` adapter for a server
framework that doesn't ship with `neon-js`. The bundled `@neondatabase/auth/next`
adapter is the reference implementation; this document walks through the parts
of it that map directly to anything you'd do for Hono, Remix, SolidStart,
Express, Fastify, etc.

> **Stability: beta.** The toolkit lives at the `@neondatabase/auth/server`
> subpath. Minor versions of `@neondatabase/auth` may include breaking changes
> to this surface, with migration notes in the package CHANGELOG. Pin your
> peer dependency to a narrow range.

## The three pieces every adapter ships

1. A **server factory** that returns a typed proxy of Better Auth server
   methods (`createNeonAuth` in the Next.js adapter).
2. An **API route handler** mounted at `/api/auth/*` that proxies upstream
   (`auth.handler()` in the Next.js adapter).
3. A **middleware** that protects routes and finalizes OAuth callbacks
   (`auth.middleware()` in the Next.js adapter).

Everything else — session caching, cookie minting, JWT validation, OAuth
token exchange, network error classification — is implemented inside the
toolkit and reused by every adapter.

## Architecture in one diagram

```text
your-adapter/
├── adapter.ts         RequestContext: framework -> toolkit bridge
├── handler.ts         /api/auth/* route mount (calls handleAuthProxyRequest)
├── middleware.ts      route protection (calls processAuthMiddleware)
└── index.ts           createYourAdapter: wires the above 3 + createAuthServer
```

All four files import only from `@neondatabase/auth/server` and your
framework's request/response APIs.

## Step 1 — Implement `RequestContext`

`RequestContext` is the contract between the toolkit and your framework. It
abstracts away how your framework exposes the in-flight request's cookies,
headers, and origin. Implementations are framework-specific but always
shaped the same way:

```typescript
// adapter.ts
import type { RequestContext } from '@neondatabase/auth/server';
import { extractNeonAuthCookies } from '@neondatabase/auth/server';
import { getContext } from 'hono/context-storage'; // example: Hono

function createHonoRequestContext(): RequestContext {
  const c = getContext();
  return {
    getCookies: () => extractNeonAuthCookies(c.req.header('cookie') ?? ''),
    setCookie: (name, value, options) => {
      // Map toolkit options into your framework's cookie API
      c.header('Set-Cookie', serializeCookie(name, value, options), {
        append: true,
      });
    },
    getHeader: (name) => c.req.header(name) ?? null,
    getOrigin: () => c.req.header('origin') ?? '',
    getFramework: () => 'hono',
  };
}
```

See the [`RequestContext` JSDoc](./src/server/request-context.ts) for the full
contract — every method's input, output, and "MAY throw / MUST NOT throw"
semantics are documented inline.

## Step 2 — Build the server factory

Compose `createAuthServer` with your `RequestContext` factory and the framework
adapter's own surface (handler + middleware):

```typescript
// index.ts
import {
  createAuthServer,
  validateCookieConfig,
  resolveNeonAuthLogging,
  type NeonAuthConfig,
} from '@neondatabase/auth/server';
import { authHandler } from './handler';
import { authMiddleware } from './middleware';

export function createHonoAuth(config: NeonAuthConfig) {
  validateCookieConfig(config.cookies);
  const log = resolveNeonAuthLogging(config);

  const server = createAuthServer({
    baseUrl: config.baseUrl,
    context: createHonoRequestContext,
    cookieSecret: config.cookies.secret,
    sessionDataTtl: config.cookies.sessionDataTtl,
    domain: config.cookies.domain,
    sameSite: config.cookies.sameSite,
    log,
  });

  // Attach the route handler + middleware so apps get one cohesive surface.
  Object.assign(server, {
    handler: () => authHandler({ baseUrl: config.baseUrl, log, ...config.cookies }),
    middleware: (opts: { loginUrl: string }) =>
      authMiddleware({ baseUrl: config.baseUrl, log, ...config.cookies, ...opts }),
  });

  return server as typeof server & {
    handler: typeof authHandler;
    middleware: typeof authMiddleware;
  };
}
```

## Step 3 — Mount the proxy handler

The toolkit's `handleAuthProxyRequest` is a pure function from
`(Request, paths, config) -> Promise<Response>`. Mount it under the conventional
`/api/auth/*` path, extracting `paths` from your framework's router:

```typescript
// handler.ts
import { handleAuthProxyRequest } from '@neondatabase/auth/server';

export function authHandler(config: ProxyConfig) {
  return async (c: Context) => {
    const path = c.req.path.split('/api/auth/')[1]?.split('/') ?? [];
    return handleAuthProxyRequest(c.req.raw, path, config);
  };
}
```

The toolkit handles upstream URL composition, header forwarding, cookie
sanitization, session-data cookie minting, and network error classification
internally. Your handler is intentionally a one-liner.

## Step 4 — Add middleware

`processAuthMiddleware` returns a discriminated `MiddlewareResult` describing
what should happen to the response. Translate each variant into your
framework's native response/redirect API:

```typescript
// middleware.ts
import { processAuthMiddleware, DEFAULT_AUTH_SKIP_ROUTES } from '@neondatabase/auth/server';

export function authMiddleware(config: MiddlewareConfig) {
  return async (c: Context, next: Next) => {
    const url = new URL(c.req.url);
    const result = await processAuthMiddleware({
      request: c.req.raw,
      pathname: url.pathname,
      skipRoutes: DEFAULT_AUTH_SKIP_ROUTES,
      ...config,
    });

    switch (result.type) {
      case 'allow':
        await next();
        for (const cookie of result.cookiesToSet) c.header('Set-Cookie', cookie, { append: true });
        return;
      case 'redirect':
        return c.redirect(result.url, 302);
    }
  };
}
```

`DEFAULT_AUTH_SKIP_ROUTES` matches what the Next.js adapter uses; you can
compose it with your own public routes (`[...DEFAULT_AUTH_SKIP_ROUTES, '/healthz']`).

## What the toolkit gives you for free

You get these without writing any code:

| Concern | Toolkit primitive |
|---|---|
| Upstream URL composition + header forwarding | `handleAuthProxyRequest` |
| Set-Cookie sanitization (Partitioned, SameSite, domain) | `handleAuthResponse` |
| Session-data cookie minting + signing | internal to `handleAuthProxyRequest` |
| Session validation on protected routes | `processAuthMiddleware` |
| OAuth `?code=` exchange + verifier cookie cleanup | internal to `processAuthMiddleware` |
| Route-skip matcher | `shouldProtectRoute`, `checkSessionRequired` |
| Network error classification (`NETWORK_DNS`, `NETWORK_TIMEOUT`, …) | `classifyFetchFailure`, `NEON_AUTH_NETWORK_ERROR_CODES` |
| Structured logging (`logger` + `logLevel`) | `resolveNeonAuthLogging` |
| Cookie config validation | `validateCookieConfig` |
| Cookie name constants | `NEON_AUTH_SESSION_COOKIE_NAME`, … |

## Testing your adapter

The toolkit is fully unit-tested upstream — your adapter only needs to test
the framework-specific bridge:

1. **`RequestContext` integration**: assert your `getCookies`, `setCookie`,
   `getHeader`, `getOrigin` correctly read from / write to your framework's
   request/response objects.
2. **Handler routing**: assert `/api/auth/sign-in/email` is correctly forwarded
   to `handleAuthProxyRequest` with `['sign-in', 'email']`.
3. **Middleware mapping**: assert each `MiddlewareResult.type` produces the
   right framework response (200 / 302 / Set-Cookie pass-through).

The Next.js adapter's tests in
[`src/next/server/`](./src/next/server/) are a useful template.

## Versioning

The `@neondatabase/auth/server` subpath is **beta**. While it is in beta:

- We will avoid breaking changes whenever possible.
- Any breaking change ships in a minor version (`0.x.0`), with a CHANGELOG
  entry describing the change and a one-step migration.
- When the surface stabilizes we'll move it to stable in a minor release
  with a changelog note.

Please open an issue at <https://github.com/neondatabase/neon-js/issues> if
you hit a friction point — the toolkit shape will be informed by what
adapter authors actually need.

## Reference

- Next.js adapter source: [`src/next/server/`](./src/next/server/)
- Toolkit entry: [`src/server/index.ts`](./src/server/index.ts)
- TanStack Start adapter PR (in progress): <https://github.com/neondatabase/neon-js/pull/73>
