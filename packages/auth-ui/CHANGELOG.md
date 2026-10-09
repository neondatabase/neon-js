# Changelog

All notable changes to `@neondatabase/auth-ui` will be documented in this file.

## Unreleased

### Changed

- **Better Auth `1.6.23` → `1.7.6`**, plus `@better-auth/passkey` `1.7.6` and `better-call` `1.4.0`. `@better-auth/utils` is pinned to `0.4.2` here so the Better Auth packages resolve the version they peer-require, while `better-call@1.4.0` uses its own `^0.5.0`. `zod` moves to `4.5.4`.
- **Better Auth `1.4.18` → `1.6.23`** and **`@daveyplate/better-auth-ui` `3.3.9` → `3.4.0`** (required for `apiKeyClient` extraction onto `@better-auth/api-key`). Also bumps `@better-auth/passkey` to `1.6.23`.

### Known issues

- **The Providers settings card cannot unlink an account, and shows no provider email.** `@daveyplate/better-auth-ui@3.4.0` calls `unlinkAccount({ accountId, providerId })` and `useAccountInfo({ query: { accountId } })` with the **provider-side** account id. Better Auth 1.7 selects identities by the local `account.id`, so unlink fails with `ACCOUNT_NOT_FOUND` and the account-info lookup returns nothing. Until this is fixed, `NeonAuthUIProvider` consumers can work around it by supplying their own `mutators.unlinkAccount` / `hooks.useAccountInfo` that translate the provider id to the local `account.id` via `listAccounts`. Linking, sign-in, sign-up and session handling are unaffected.

## [0.1.0-alpha.11] - 2026-01-14

### Fixed

- **CSS Theme Isolation**: CSS variables now use `--neon-*` prefix on `:root` to prevent overriding user's custom Tailwind themes
  - All variables use `--neon-*` prefix internally with fallback pattern: `var(--user-var, default)`
  - Styles wrapped in `@layer neon-auth` for lower specificity than user's unlayered CSS
  - See `dev-notes/solutions/ui-bugs/css-variables-theme-conflict.md` for details

### Added

- `className` prop on `NeonAuthUIProvider` for custom wrapper styling
- `defaultTheme` prop on `NeonAuthUIProvider` to configure next-themes default ('light' | 'dark' | 'system')
- `cn()` utility function for className merging (clsx + tailwind-merge)

## [0.1.0-alpha.1] - 2025-11-27

### Added

- **NeonAuthUIProvider**: Custom provider component that integrates with `@neondatabase/auth` adapters
- **Multi-adapter support**: Works with all neon-auth adapters (SupabaseAuthAdapter, BetterAuthVanillaAdapter, BetterAuthReactAdapter)
- **Dual CSS distribution**:
  - `@neondatabase/auth-ui/css` - Pre-built styles for non-Tailwind projects
  - `@neondatabase/auth-ui/tailwind` - Tailwind CSS source for projects using Tailwind
- **Auth Forms**: SignInForm, SignUpForm, ForgotPasswordForm, MagicLinkForm, RecoverAccountForm, ResetPasswordForm, TwoFactorForm
- **Auth Views**: AuthView, AccountView, AuthCallback, SignOut
- **User Components**: UserButton, UserAvatar, UserView
- **Organization Components**: OrganizationSwitcher, OrganizationView, OrganizationLogo, and settings cards
- **Settings Cards**: AccountSettingsCards, SecuritySettingsCards, SessionsCard, PasskeysCard, TwoFactorCard, and more
- **Team Components**: TeamsCard, TeamCell, CreateTeamDialog
- **Conditional Rendering**: SignedIn, SignedOut, AuthLoading, RedirectToSignIn, RedirectToSignUp
- **Hooks**: useAuthData, useAuthenticate, useCurrentOrganization, useTheme
- **Social Provider Icons**: Apple, Discord, Facebook, GitHub, Google, LinkedIn, Microsoft, and more
- **Localization**: Full localization support via authLocalization
