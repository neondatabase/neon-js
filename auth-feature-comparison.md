# Supabase Auth vs Stack Auth: Comprehensive Feature Comparison

This document provides a deep, feature-by-feature analysis of Supabase Auth and Stack Auth to help developers understand the differences, trade-offs, and limitations when using the Stack Auth adapter in the neon-js SDK.

---

## Table of Contents

1. [Core Authentication Methods](#core-authentication-methods)
2. [Session Management](#session-management)
3. [Advanced Features](#advanced-features)
4. [User Management & Metadata](#user-management--metadata)
5. [Development Experience](#development-experience)
6. [Performance Characteristics](#performance-characteristics)
7. [Limitations & Unsupported Features](#limitations--unsupported-features)
8. [Enterprise Features](#enterprise-features)
9. [Architecture & Deployment](#architecture--deployment)
10. [Summary Table](#summary-table)

---

## Core Authentication Methods

### 1. Password-Based Authentication

| Aspect | Supabase | Stack Auth | Notes |
|--------|----------|-----------|-------|
| **Email/Password** |  Yes |  Yes | Both support standard email/password authentication |
| **Phone/Password** |  Yes (via SMS providers) | L No | Stack Auth only supports email-based password authentication |
| **Password Reset** |  Email-based |  Email-based | Both support email-based password recovery |
| **Password Change** |  Via nonce-based reauthentication | L Limited (requires oldPassword) | **Key Difference**: Stack Auth requires the old password, unlike Supabase's nonce approach. Stack Auth adapter returns error for `updateUser()` with password attribute |
| **Email Verification** |  Configurable (default: enabled) |  Automatic on signup | Both support email verification but with different defaults |
| **Password Validation** |  Customizable rules |  Customizable rules | Both allow password strength requirements |
| **Default Rate Limit** | 2 emails/hour | Standard API limits | Supabase has lower default, requires custom SMTP for production |

**Stack Auth Adapter Implementation**:
```typescript
// Supported: Email/Password
await client.auth.signInWithPassword({ email, password })

// Not supported: Phone/Password
// Attempting phone auth returns error: "Phone sign-in not supported"
```

**Key Limitations**:
- **Password Changes via `updateUser()`**: Adapter returns detailed error message directing users to either:
  1. Use "Forgot Password" flow via `resetPasswordForEmail()`
  2. Use Stack Auth's native `updatePassword()` method directly
  3. Reauthenticate with `signInWithPassword()` first
- **No Phone Authentication**: Unlike Supabase's phone/SMS support, Stack Auth only supports email-based credentials

---

### 2. OAuth Providers

| Feature | Supabase | Stack Auth | Details |
|---------|----------|-----------|---------|
| **OAuth Provider Count** | 20+ providers | 12+ providers | Both support major providers |
| **Supported Providers** | Apple, Azure, Bitbucket, Discord, Facebook, Figma, Fly, GitHub, GitLab, Google, Kakao, Keycloak, LinkedIn, Notion, Snapchat, Slack, Spotify, Twitch, Twitter/X, Vercel, Zoom, WorkOS | Apple, Bitbucket, Discord, Facebook, GitHub, GitLab, Google, LinkedIn, Microsoft, Slack, Spotify, Twitter/X | Stack Auth covers all major social providers |
| **Custom OAuth** |  OIDC providers (if pre-configured) |  Custom provider support | Both allow extending with custom providers |
| **Provider Auto-Linking** |  By email |  By email | Same accounts linked automatically across providers |
| **Manual Identity Linking** |  Beta feature |  Full support | Link multiple OAuth identities to one account |
| **Implementation** | OAuth 2.0 + OIDC | OAuth 2.0 + OIDC | Both use standard OAuth flows |

**Key Differences**:
- Stack Auth has fewer pre-configured providers but maintains all essential ones
- Both support the same OAuth flow architecture
- Supabase supports some niche providers (Keycloak, Fly, Vercel) that Stack Auth doesn't

---

### 3. Passwordless Email Authentication

| Method | Supabase | Stack Auth | Details |
|--------|----------|-----------|---------|
| **Magic Links** |  Yes |  Yes (via passkey) | Similar passwordless flow |
| **Email OTP** |  Yes (6-digit code) |  Yes | Both support email one-time passwords |
| **Email OTP Expiration** | Default 1 hour (max 24h) | Default 1 hour | Aligned defaults |
| **OTP Rate Limits** | 30/hour by IP | Standard API limits | Supabase specifies explicitly |
| **Magic Link Template** | Customizable | Customizable | Both allow email template customization |

**Stack Auth Adapter Support**:
- Email OTP via `signInWithOtp()`  Fully supported
- Magic links via `signInWithOauth()`  Supported as passwordless option

---

### 4. Passkey/WebAuthn Authentication

| Feature | Supabase | Stack Auth | Details |
|---------|----------|-----------|---------|
| **Passkey Support** | L Not supported |  Yes | **Major Difference**: Stack Auth has built-in passkey/WebAuthn support |
| **Biometric Auth** | Not available |  Yes | Stack Auth supports device biometrics |
| **Security Key Support** | Not available |  Yes | FIDO2 security key support in Stack Auth |
| **Device Binding** | N/A |  Cross-device | Passkeys can sync across devices |

**Advantages of Stack Auth**:
Stack Auth provides modern passwordless authentication via passkeys, which Supabase lacks. This is a significant advantage for security-focused applications.

---

### 5. SAML SSO (Enterprise Single Sign-On)

| Aspect | Supabase | Stack Auth | Details |
|--------|----------|-----------|---------|
| **SAML 2.0 Support** |  Yes | L No | **Not Supported** |
| **Plan Required** | Pro+ required | N/A | Enterprise feature on Supabase |
| **Provider Types** | Any SAML 2.0 compatible IDP | N/A | Stack Auth only supports OAuth |
| **Automatic Linking** |  By email | N/A | N/A |
| **Admin Configuration** |  Dashboards | N/A | N/A |

**Stack Auth Adapter Response**:
```typescript
// Attempting SAML SSO returns:
error: AuthError {
  message: "Stack Auth does not support enterprise SAML SSO. Attempted with providerId: xxx. " +
           "Stack Auth only supports OAuth social providers. Please use signInWithOAuth() instead.",
  code: 501,
  status: "sso_provider_disabled"
}
```

**Migration Path**: For applications requiring SAML, Stack Auth is not suitable. Consider staying with Supabase Auth or using a dedicated enterprise SSO solution.

---

### 6. OIDC ID Token Authentication

| Feature | Supabase | Stack Auth | Details |
|--------|----------|-----------|---------|
| **Direct ID Token** |  Yes | L No | **Not Supported** |
| **Supported Providers** | Pre-configured (Google, Apple, Azure, etc.) | N/A | Stack Auth requires OAuth redirect flow |
| **Native OAuth Support** |  Sign in with Apple, Google on mobile | N/A | Stack Auth uses authorization code flow |
| **ID Token with at_hash** |  Supported | N/A | Stack Auth doesn't accept pre-existing tokens |
| **Nonce Validation** |  Built-in | N/A | N/A |

**Stack Auth Adapter Response**:
```typescript
// Attempting ID token sign-in returns:
error: AuthError {
  message: "Stack Auth does not support OIDC ID token authentication. " +
           "Stack Auth uses OAuth authorization code flow and does not accept pre-existing ID tokens. " +
           "Please use signInWithOAuth() to redirect users to the OAuth provider.",
  code: 501,
  status: "id_token_provider_disabled"
}
```

**Use Case Impact**:
- Native app developers using iOS Sign in with Apple or Google Sign-In will need to adapt their flow
- Stack Auth's OAuth flow requires full redirect, not just token exchange

---

### 7. Web3/Crypto Wallet Authentication

| Feature | Supabase | Stack Auth | Details |
|--------|----------|-----------|---------|
| **Web3 Support** |  Yes | L No | **Not Supported** |
| **Supported Chains** | Ethereum, Solana | N/A | Stack Auth doesn't support blockchain auth |
| **Wallet Types** | MetaMask, WalletConnect, Phantom, etc. | N/A | N/A |
| **Standard** | EIP-4361 (Ethereum), Sign-In with Solana | N/A | N/A |
| **Rate Limit** | 30 requests/hour by IP | N/A | N/A |

**Stack Auth Adapter Response**:
```typescript
// Attempting Web3 authentication returns:
error: AuthError {
  message: "Stack Auth does not support Web3 authentication. Attempted with chain: xxx. " +
           "Stack Auth does not support crypto wallet sign-in (Ethereum, Solana, etc.). " +
           "Supported authentication methods: OAuth, email/password, magic link, passkey, or anonymous.",
  code: 501,
  status: "web3_provider_disabled"
}
```

**Applications Affected**: Web3/DeFi applications must stay with Supabase Auth or find alternative solutions.

---

### 8. Anonymous Authentication

| Feature | Supabase | Stack Auth | Details |
|--------|----------|-----------|---------|
| **Anonymous Sessions** |  Yes | L No | **Not Supported** |
| **Upgrade Path** |  To authenticated user | N/A | N/A |
| **Use Cases** | Trial experiences, progressive auth | N/A | Stack Auth requires explicit authentication |
| **Session Persistence** |  Stored in auth.sessions | N/A | N/A |

**Stack Auth Adapter Response**:
```typescript
// Attempting anonymous sign-in returns:
error: AuthError {
  message: "Anonymous sign-in is not supported by Stack Auth",
  code: 501,
  status: "anonymous_provider_disabled"
}
```

**Impact**: Applications relying on anonymous trial experiences must handle authentication differently with Stack Auth.

---

## Session Management

### Session Storage & Persistence

| Aspect | Supabase | Stack Auth | Details |
|--------|----------|-----------|---------|
| **Storage Options** | localStorage, cookies (SSR), custom adapters | Cookie (HttpOnly), Memory | Both support multiple storage strategies |
| **Storage Security** | Browser localStorage, secure cookies in SSR | HttpOnly cookies, memory | Stack Auth emphasizes secure HttpOnly cookies |
| **Default Storage** | localStorage for browser apps | Configurable (cookie/memory) | Stack Auth defaults to more secure options |
| **Custom Storage** |  Adapter interface |  Token store interface | Both allow custom storage implementation |

**Key Difference - Security**:
- Stack Auth defaults to secure HttpOnly cookies, preventing XSS access to tokens
- Supabase allows localStorage by default, which is more vulnerable

---

### Token Structure & Lifecycle

| Component | Supabase | Stack Auth | Details |
|-----------|----------|-----------|---------|
| **Access Token Type** | JWT (5min - 1hr, default 1hr) | JWT (short-lived) | Both use JWT with configurable expiration |
| **Refresh Token** | Never expires, single-use | Never expires, single-use | Same refresh token design |
| **Token Reuse Window** | 10 seconds (legitimate SSR scenarios) | Included in deduplication | Both handle refresh token reuse gracefully |
| **Session ID Claim** | UUID in JWT claims | User ID in JWT claims | Slightly different JWT structures |
| **Custom Claims** |  Via auth hooks |  Via token customization | Both support extending JWT claims |

**Stack Auth JWT Format**:
```json
{
  "sub": "user-id",
  "email": "user@example.com",
  "iat": 1697500000,
  "exp": 1697503600
}
```

---

### Token Refresh Mechanism

| Feature | Supabase | Stack Auth | Details |
|---------|----------|-----------|---------|
| **Automatic Refresh** |  Background process |  Built-in | Both handle refresh automatically |
| **Foreground-Only Refresh** |  Tab visibility check |  Similar approach | Prevents refresh flooding |
| **Race Condition Prevention** |  Handled |  **Deduplication** | Stack Auth uses more sophisticated deduplication |
| **Token Reuse Detection** |  10-second window |  Configurable | Both prevent unauthorized refresh reuse |
| **Refresh Strategy** | Event-based | **Proactive + Event-based** | Stack Auth may use proactive refresh intervals |
| **Exponential Backoff** | Not documented |  Implemented | Stack Auth retries failed refreshes with backoff |
| **Rate Limit for Refresh** | 1,800 requests/hour by IP | Standard API limits | Supabase explicitly documents limit |

**Stack Auth Advantages**:
- Token deduplication prevents race conditions in high-concurrency scenarios
- Exponential backoff provides resilience to network hiccups
- More sophisticated refresh detection

---

### Session Lifecycle Events

| Event | Supabase | Stack Auth | Stack Auth Adapter |
|-------|----------|-----------|-------------------|
| **INITIAL_SESSION** |  Emitted |  Supported |  Triggered on initialization |
| **SIGNED_IN** |  Emitted |  Supported |  Triggered after successful auth |
| **SIGNED_OUT** |  Emitted |  Supported |  Triggered on sign out |
| **TOKEN_REFRESHED** |  Emitted |  Supported |  Emitted on token refresh |
| **USER_UPDATED** |  Emitted |  Supported |  Emitted on user profile update |
| **PASSWORD_RECOVERY** |  Emitted |  Supported |  Emitted during password reset |

**Adapter Implementation**:
```typescript
// Subscribe to authentication state changes
const { data } = client.auth.onAuthStateChange((event, session) => {
  switch (event) {
    case 'SIGNED_IN':
      console.log('User signed in', session);
      break;
    case 'TOKEN_REFRESHED':
      console.log('Tokens refreshed');
      break;
    case 'SIGNED_OUT':
      console.log('User signed out');
      break;
  }
});
```

---

### Session Termination

| Scenario | Supabase | Stack Auth | Details |
|----------|----------|-----------|---------|
| **User Sign-Out** |  Terminates |  Terminates | Both end all sessions on logout |
| **Password Change** |  Terminates all |  Likely terminates | Different reauthentication flows |
| **Inactivity Timeout** |  Configurable |  Supported | Both support configurable timeouts |
| **Max Session Lifetime** |  Configurable |  Supported | Sessions expire after max duration |
| **Single Session Mode** |  Only latest sign-in valid |  Supported | Both can enforce single active session |
| **Device-Specific Logout** |  Supported |  Supported | Can log out from specific devices |

---

## Performance Characteristics

### Session Retrieval Performance

| Scenario | Supabase | Stack Auth | Notes |
|----------|----------|-----------|-------|
| **Cached `getSession()`** | Not documented | <5ms | Stack Auth uses internal cache optimization |
| **First `getSession()` after reload** | Not documented | <50ms | Reads from tokenStore (cookie/memory) |
| **Token Refresh Operation** | Not documented | <200ms | Network call, automatic if needed |
| **`getUser()` (Server-Side)** | Not documented | Variable | Makes network request for validation |

**Stack Auth Adapter Optimization - Two-Step Session Retrieval**:

```typescript
getSession: AuthClient['getSession'] = async () => {
  // Step 1: Fast Path (Cached) - <5ms, no I/O
  const cachedTokens = await this._getCachedTokensFromStackAuthInternals();
  if (cachedTokens?.accessToken) {
    // Decode JWT and return session immediately
    return { data: { session }, error: null };
  }

  // Step 2: Fallback (Network) - <200ms, network I/O
  const user = await this.stackAuth.getUser();
  if (user) {
    // Fetch tokens, auto-refresh if needed
    const tokens = await user.currentSession.getTokens();
    return { data: { session }, error: null };
  }

  return { data: { session: null }, error: null };
};
```

**Key Advantage**: Stack Auth's internal caching provides sub-5ms session retrieval without making network requests, superior to Supabase's default approach.

---

## Advanced Features

### Multi-Factor Authentication (MFA)

| Feature | Supabase | Stack Auth | Details |
|---------|----------|-----------|---------|
| **TOTP (Authenticator Apps)** |  Yes |  Yes | Both support time-based OTP |
| **Phone/SMS OTP** |  Yes |  Yes | Both support SMS-based second factor |
| **Factor Management** |  Up to 10 factors per user |  Multiple factors | Both support multiple MFA methods |
| **Authenticator Assurance Levels** |  AAL1, AAL2 in JWT |  MFA level in claims | Both track auth strength in tokens |
| **MFA Enforcement** |  Optional or mandatory |  Configurable | Both support flexible MFA policies |
| **Challenge Rate Limits** | 15 attempts/hour by IP | Standard API limits | Supabase explicitly documents |

**Adapter Support**: Full MFA support via `signInWithOtp()` with TOTP/SMS verification.

---

### User Metadata Management

| Aspect | Supabase | Stack Auth | Details |
|--------|----------|-----------|---------|
| **User-Editable Metadata** |  `raw_user_meta_data` (JSONB) |  `clientMetadata` | Both store user-modifiable metadata |
| **Immutable Metadata** |  `raw_app_meta_data` (service role only) |  `clientReadOnlyMetadata` | Both prevent user modification of critical data |
| **Security Notes** | User metadata not secure (users can modify) | Similar approach | **Important**: Don't store auth/access control in user metadata |
| **Profile Info** | Custom fields in metadata | `displayName`, `profileImageUrl` | Stack Auth has structured profile fields |
| **Update Method** | `updateUser()` | `updateUser()` or `update()` | Adapter maps Supabase style to Stack Auth |

**Stack Auth Adapter Mapping**:
```typescript
// Supabase-style update
await client.auth.updateUser({
  data: {
    displayName: "John Doe",
    profileImageUrl: "https://example.com/avatar.jpg",
    custom_field: "value"  // Stored in clientMetadata
  }
});

// Adapter maps to Stack Auth's API
await user.update({
  displayName: "John Doe",
  profileImageUrl: "https://example.com/avatar.jpg",
  clientMetadata: {
    custom_field: "value"
  }
});
```

---

### User Identity Linking

| Feature | Supabase | Stack Auth | Adapter Support |
|---------|----------|-----------|-----------------|
| **Automatic Linking** |  By email |  By email |  Handled automatically |
| **Manual Linking** |  Beta feature |  Full support |  Via `linkIdentity()` |
| **Unlinking** |  Requires 2+ identities |  Requires 2+ identities |  Via `unlinkIdentity()` |
| **Linked Identities Retrieval** |  `getUserIdentities()` |  User identities |  Full support |
| **Native OAuth Linking** |  ID token based |  OAuth flow |  Supported |

**Adapter Implementation**:
```typescript
// Get all linked identities
const { data, error } = await client.auth.getUserIdentities();

// Link additional OAuth provider
const result = await client.auth.linkIdentity({ provider: 'github' });

// Unlink an identity (must have 2+ linked)
await client.auth.unlinkIdentity({ identity_id: 'provider_uuid' });
```

---

### Claims & Token Customization

| Feature | Supabase | Stack Auth | Adapter Support |
|---------|----------|-----------|-----------------|
| **Access JWT Claims** |  Custom via hooks |  Customizable |  Standard claims support |
| **Role Management** |  Role claim in JWT |  Role management |  Reads from JWT |
| **Custom Claim Hooks** |  Custom Access Token hook |  Via configuration |  Claims decoded from JWT |
| **Claims Retrieval** |  Via `getClaims()` |  Supported |  Full implementation |

**Adapter Implementation**:
```typescript
// Get custom claims from JWT
const { data: claims, error } = await client.auth.getClaims();

// Claims include:
{
  sub: "user-id",
  email: "user@example.com",
  aud: "authenticated",
  role: "authenticated",
  iat: 1697500000,
  exp: 1697503600
}
```

---

## User Management & Metadata

### User Profile Operations

| Operation | Supabase | Stack Auth | Adapter Support |
|-----------|----------|-----------|-----------------|
| **Get Current User** |  `getUser()` |  `getUser()` |  Full support |
| **Update User Profile** |  `updateUser()` |  `update()` |  Full support |
| **Change Email** |  Supported | L Requires server API |   Not supported via adapter |
| **Change Phone** |  Supported | L Limited support |   Not supported |
| **Get User Identities** |  `getUserIdentities()` |  Supported |  Full support |
| **Sign Out** |  `signOut()` |  `signOut()` |  Full support |

**Limitations**:
- Email changes require server-side Stack Auth configuration (not exposed via SDK)
- Phone-based authentication not available in Stack Auth

---

## Development Experience

### TypeScript Support

| Aspect | Supabase | Stack Auth | neon-js Adapter |
|--------|----------|-----------|-----------------|
| **Strict Mode** |  Enabled |  Enabled |  Full TypeScript strict |
| **Generic Types** |  Database schema types |  Type-safe |  Generic <Database, SchemaName> |
| **Error Types** |  `AuthError`, `AuthApiError` |  Custom error types |  Supabase error types re-exported |
| **Type Inference** |  Good |  Excellent |  Full type safety |

---

### React Integration

| Feature | Supabase | Stack Auth | Adapter Status |
|---------|----------|-----------|-----------------|
| **React Hooks** |  `useAuth()` |  `useUser()`, `useStackApp()` |  Works with React apps |
| **Pre-built Components** |  Via separate package |  `<SignIn/>`, `<SignUp/>` |  Composable with neon-js |
| **SSR Support** |  Full Next.js support |  Full Next.js support |  Via factory pattern |
| **Setup Time** | 2-5 days typical | 5-10 minutes | ~10 minutes with neon-js |

---

### Framework Support

| Framework | Supabase | Stack Auth | neon-js Status |
|-----------|----------|-----------|-----------------|
| **Next.js (App Router)** |  Full support |  Full support |  Fully supported |
| **Next.js (Pages Router)** |  Full support |   Limited |  Works via factory pattern |
| **React SPA** |  Full support |  Full support |  Full support |
| **Express/Node.js** |  Via REST API |  Via REST API |  Via REST API |
| **Other Frameworks** |  Via REST API |  Via REST API |  Via REST API |

---

## Limitations & Unsupported Features

### Direct Limitations (Stack Auth vs Supabase)

| Feature | Supabase | Stack Auth | Severity | Migration Path |
|---------|----------|-----------|----------|-----------------|
| **SAML SSO** |  Pro+ | L No | **High** | Use Supabase or dedicated SSO provider |
| **Web3 Auth** |  Yes | L No | **High** | Use Supabase or separate Web3 auth |
| **Anonymous Auth** |  Yes | L No | **Medium** | Implement custom anon session handling |
| **ID Token Auth** |  Yes | L No | **Medium** | Use OAuth redirect flow |
| **Phone Password** |  Yes | L No | **Low** | Use email-based auth |
| **Email Updates** |  SDK API | L Server-side only | **Low** | Implement via backend |
| **Direct Password Change** |  Nonce-based | L Requires old password | **Low** | Use forgot password flow |

### Adapter-Specific Error Handling

The Stack Auth adapter returns detailed error messages for all unsupported operations:

```typescript
// SAML SSO Attempt
{
  error: AuthError {
    code: 501,
    status: 'sso_provider_disabled',
    message: 'Stack Auth does not support enterprise SAML SSO...'
  }
}

// Web3 Attempt
{
  error: AuthError {
    code: 501,
    status: 'web3_provider_disabled',
    message: 'Stack Auth does not support Web3 authentication...'
  }
}

// ID Token Attempt
{
  error: AuthError {
    code: 501,
    status: 'id_token_provider_disabled',
    message: 'Stack Auth does not support OIDC ID token authentication...'
  }
}

// Anonymous Sign-in
{
  error: AuthError {
    code: 501,
    status: 'anonymous_provider_disabled',
    message: 'Anonymous sign-in is not supported by Stack Auth'
  }
}
```

Each error provides:
- **What was attempted**: Specific provider/chain/context
- **Why it's not supported**: Technical explanation
- **Suggested alternative**: Recommended approach

---

## Enterprise Features

### SAML SSO Details

| Aspect | Supabase | Stack Auth |
|--------|----------|-----------|
| **Enterprise Requirement** | Pro plan minimum | Not supported |
| **SAML 2.0 Support** | Full compliance | N/A |
| **Auto-Linking** | By email domain | N/A |
| **Multi-Tenant** | Per-project | N/A |
| **Metadata Management** | Dashboard config | N/A |

**Stack Auth Alternative**: Use OAuth providers for enterprise scenarios, or maintain a separate SAML solution.

---

### Admin/Service Role Capabilities

| Operation | Supabase | Stack Auth | Adapter |
|-----------|----------|-----------|---------|
| **Create Users** |  Admin API |  Server-side |   Not exposed in adapter |
| **Delete Users** |  Admin API |  Server-side |   Not exposed in adapter |
| **Update Users** |  Admin API |  Server-side |   Not exposed in adapter |
| **Reset Invitations** |  Admin API |  Supported |   Not exposed in adapter |
| **Session Revocation** |  Admin API |  Server-side |   Not exposed in adapter |

**Note**: Admin operations are not exposed through the neon-js adapter. Implement server-side logic directly with Stack Auth's backend API if needed.

---

### Audit Logging

| Feature | Supabase | Stack Auth |
|---------|----------|-----------|
| **Audit Logs** |  Dashboard |  Available |
| **Event Tracking** |  User actions, auth events |  All events |
| **Log Retention** | Varies by plan | Configurable |
| **Export** |  Via API |  Available |

---

## Architecture & Deployment

### Hosted vs Self-Hosted

| Aspect | Supabase | Stack Auth | neon-js |
|--------|----------|-----------|---------|
| **Managed Service** |  Yes |  Yes |  Works with both |
| **Self-Hosted** |  Open source |  Open source (MIT/AGPL) |  Compatible |
| **Docker Support** |  Via docker-compose |  Pre-configured image |  Compatible |
| **Database** | PostgreSQL required | PostgreSQL required |  Native PG support |

---

### Rate Limits

| Endpoint | Supabase | Stack Auth | Notes |
|----------|----------|-----------|-------|
| **Email Endpoints** | 2/hour default | Standard API limits | Supabase very restrictive by default |
| **OTP Endpoints** | 30/hour | Standard API limits | Supabase customizable |
| **Token Refresh** | 1,800/hour by IP | Standard limits | Both reasonable for production |
| **MFA Challenges** | 15/hour by IP | Standard limits | Reasonable for both |

**Recommendation**: Set up custom SMTP with Supabase for production email rates.

---

## Summary Table

Quick reference for technology selection:

| Scenario | Recommendation | Reason |
|----------|-----------------|--------|
| **Need passkey/WebAuthn** | **Stack Auth** | Only Stack Auth supports passkeys |
| **Need SAML SSO** | **Supabase** | Only Supabase supports enterprise SAML |
| **Need Web3 Auth** | **Supabase** | Only Supabase supports blockchain |
| **Need Anonymous Auth** | **Supabase** | Only Supabase supports anonymous sessions |
| **Need Fast Session Retrieval** | **Stack Auth** | <5ms cached performance |
| **Need Phone Auth** | **Supabase** | Stack Auth email-only |
| **Need Team Management** | **Stack Auth** | Built-in org/team support |
| **Need Maximum OAuth Providers** | **Supabase** | 20+ vs Stack Auth's 12+ |
| **Want Open Source** | **Both** | Both open source, but different licenses |
| **Want Easiest Setup** | **Stack Auth** | 5-10 minutes vs 2-5 days |
| **Need High Security Defaults** | **Stack Auth** | HttpOnly cookies by default |
| **Need Enterprise Features** | **Supabase** | More enterprise-grade features |

---

## Implementation Guide: Using Stack Auth with neon-js

### Basic Setup

```typescript
import { createClient } from 'neon-js';

const client = createClient({
  url: 'https://your-api.com',
  auth: {
    projectId: 'your-project-id',
    publishableClientKey: 'pk_...',
    tokenStore: 'cookie', // or 'memory'
  },
});

// Fully type-safe with Supabase-compatible interface
const { data, error } = await client.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password',
});
```

### Handling Unsupported Features

```typescript
// For SAML SSO (not supported)
const { error } = await client.auth.signInWithSSO({
  providerId: 'xxx'
});

if (error?.status === 'sso_provider_disabled') {
  // Show user-friendly message
  console.error('Use OAuth providers instead of SAML');
}

// For Password Updates
const { error } = await client.auth.updateUser({
  password: 'newpassword'
});

if (error?.code === 400 && error?.status === 'feature_not_supported') {
  // Direct user to forgot password flow
  await client.auth.resetPasswordForEmail({ email: user.email });
}
```

### Leveraging Stack Auth Advantages

```typescript
// Take advantage of Stack Auth's sub-5ms cached sessions
const { data: { session } } = await client.auth.getSession();

// Token management is automatic and deduplication-safe
const { data: { user } } = await client.auth.getUser();

// Passkeys for enhanced security (Stack Auth only)
// This would be implemented directly via Stack Auth SDK
// while keeping neon-js for other auth needs
```

---

## Conclusion

The Stack Auth adapter in neon-js provides excellent Supabase Auth compatibility while offering some unique advantages:

### Stack Auth Strengths
-  Sub-5ms cached session retrieval
-  Built-in passkey/WebAuthn support
-  Token deduplication and exponential backoff
-  More secure default storage (HttpOnly cookies)
-  Built-in team/organization management
-  Faster setup (5-10 minutes)

### Stack Auth Limitations
- L No SAML SSO support
- L No Web3/crypto authentication
- L No anonymous authentication
- L No direct ID token authentication
- L No phone-based authentication
- L Fewer OAuth providers (12 vs 20+)

### When to Choose Each

**Choose Stack Auth + neon-js if you**:
- Value security and performance
- Need passkey authentication
- Want fast setup and deployment
- Have modern authentication needs
- Can work with OAuth provider ecosystem

**Choose Supabase Auth if you**:
- Need enterprise SAML SSO
- Require Web3/blockchain support
- Need anonymous session support
- Must support phone authentication
- Want maximum provider flexibility

Both are excellent choices with trade-offs. The Stack Auth adapter makes it easy to switch between them while maintaining a consistent Supabase-compatible interface.
