# Neon JS SDK Roadmap

> Priorities may shift based on community feedback and internal requirements.

**Contribute:** [Discussions](https://github.com/neondatabase/neon-js/discussions) · [Issues](https://github.com/neondatabase/neon-js/issues)

---

## In Progress

*Nothing currently in active development*

---

## Up Next

### Server Configuration

#### Unified Server Configuration API
Single entrypoint for all Next.js server components.

**Problem:** Users configure `authServer`, `middleware`, `apiHandler` separately, each reading env vars independently → repeated validation, no shared config.

**Proposal:**
```ts
export const { middleware, authServer, apiHandler } = createAuthServerConfig({
  baseUrl: process.env.NEON_AUTH_BASE_URL,  // optional override
  ttl: 60,  // session cache TTL
  loginUrl: '/auth/sign-in',
});
```

**Files:** `packages/auth/src/next/server/index.ts`, `middleware/index.ts`, `handler/index.ts`

---

#### Middleware Auth Context Callback
Dynamic auth behavior per-request.

**Problem:** Hardcoded `SKIP_ROUTES`, no way to customize auth per route, no request context access.

**Proposal:**
```ts
export default neonAuthMiddleware({
  loginUrl: '/auth/sign-in',
  onRequest: async (request, session) => {
    if (request.nextUrl.pathname.startsWith('/api/public')) {
      return { skip: true };
    }
    if (request.nextUrl.pathname.startsWith('/admin') && session?.user?.role !== 'admin') {
      return { redirect: '/unauthorized' };
    }
    return { continue: true };
  },
});
```

**Files:** `packages/auth/src/next/middleware/index.ts`

---

### Framework Support

#### Remix Support
Remix adapter matching Next.js API pattern.

**Better Auth already supports:** Route handlers + React client
**Need to add:** `createAuthServerConfig()` equivalent, session helpers, middleware patterns

---

#### SvelteKit Support
SvelteKit adapter with native hooks integration.

**Better Auth already supports:** Route handlers + Svelte client
**Need to add:** Hooks integration, session load functions, `+layout.server.ts` patterns

---

#### Nuxt Support
Nuxt 3 adapter with server middleware.

**Better Auth already supports:** Route handlers + Vue client
**Need to add:** Server middleware, composables (`useAuth`), Nitro integration

---

### Plugins

#### Magic Link Plugin Integration
Passwordless email authentication.

**Better Auth plugin:** `magicLink`
**Need to add:**
- Configure in Neon Auth backend
- Client method `signIn.magicLink({ email })`
- UI component for magic link flow in auth-ui

---

#### Passkey/WebAuthn Plugin
Passwordless biometric authentication.

**Better Auth plugin:** `@better-auth/passkey`
**Need to add:**
- Configure in Neon Auth backend
- Client methods: `passkey.addPasskey()`, `signIn.passkey()`
- UI component for passkey management

---

#### Two-Factor Authentication (2FA)
TOTP-based second factor.

**Better Auth plugin:** `twoFactor`
**Need to add:**
- Configure in Neon Auth backend
- Client methods: `twoFactor.enable()`, `twoFactor.verifyOtp()`
- UI component for 2FA setup/verification

---

#### Email OTP Plugin
One-time password via email (alternative to magic link).

**Better Auth plugin:** `emailOtp`
**Need to add:**
- Configure in Neon Auth backend
- Client method `signIn.emailOtp({ email, otp })`
- UI component for OTP input

---

### UI Improvements

#### Enhanced Theming System
More flexible theming beyond CSS variables.

**Current:** CSS variables with `--neon-*` prefix, `@layer neon-auth` isolation
**Ideas:**
- Preset themes (light, dark, system)
- Component-level overrides
- Tailwind v4 native integration
- CSS-in-JS alternative for non-Tailwind users

---

#### Component Customization
Allow overriding individual sub-components.

**Proposal:**
```tsx
<SignInForm
  components={{
    SubmitButton: MyCustomButton,
    SocialProviders: MyCustomSocials,
  }}
/>
```

---

#### Additional UI Components
Expand beyond current sign-in/sign-up/user-button.

**Potential additions:**
- `ForgotPasswordForm`
- `ResetPasswordForm`
- `AccountSettingsForm`
- `OrganizationSelector`
- `MemberInviteForm`

---

## Under Consideration

*Items being evaluated — open a Discussion to advocate.*

- **React Native support** — Native auth flow for mobile apps
- **Anonymous sessions** — Guest users with RLS access (plugin: `anonymous`)
- **Organizations/Teams** — Multi-tenant support (plugin: `organization`)
- **SSO/SAML** — Enterprise single sign-on (plugin: `@better-auth/sso`)
- **Generic OAuth** — Connect any OAuth provider (Auth0, Keycloak, Okta)
- **API Keys** — Machine-to-machine auth (plugin: `apiKey`)
- **Phone Number Auth** — SMS-based authentication (plugin: `phoneNumber`)
- **Astro Support** — SSG/SSR framework adapter
- **Hono Support** — Edge-first framework adapter
- **Express Support** — Traditional Node.js server adapter

---

## Recently Shipped

*See [CHANGELOG.md](./CHANGELOG.md) for full release history.*

- OAuth popup flow for iframes
- Cross-tab session sync
- CSS theming isolation (`@layer neon-auth`)
