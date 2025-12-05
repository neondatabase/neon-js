## Why use @neondatabase/auth over better-auth/client?

### API
- The `@neondatabase/auth` package is a wrapper around `better-auth/client` that exposes different APIs for different use cases.
  - Supabase Auth Adapter
  - Better Auth React Adapter
  - Better Auth Vanilla Adapter
- Neon Auth is tightly coupled with Neon Auth API and restricts the options that can be passed to the adapter, so that you can't use unsupported features/plugins.

### Neon Auth Integration
- The `@neondatabase/auth` package was made to match Neon Auth functionalities perfectly, meaning, there will be custom behaviors that are not supported by `better-auth/client` core, that only make sense in the context of Neon Auth.
  - sending a `token_verifier` on the OAuth flow callback
  - pre-configured plugins that works with Neon Auth
  - automatic JWT extraction from the session when the `getSession` method is called

### Built-in Enhancements
- The `@neondatabase/auth` package also offers other small features that we decided to include out-of-the-box in the package, such as:
  - session caching
  - request deduplication
  - event system
  - cross-tab sync
  - token refresh detection
  

## Why use better-auth/client over @neondatabase/auth?

- If you are not using Neon Auth, you can use `better-auth/client` directly, without the need to use the `@neondatabase/auth` package, since that will offer some more flexibility.