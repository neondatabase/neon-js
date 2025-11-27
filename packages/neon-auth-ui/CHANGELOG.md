# Changelog

All notable changes to `@neondatabase/neon-auth-ui` will be documented in this file.

## [0.1.0-alpha.1] - 2025-11-27

### Added

- **NeonAuthUIProvider**: Custom provider component that integrates with `@neondatabase/neon-auth` adapters
- **Multi-adapter support**: Works with all neon-auth adapters (SupabaseAuthAdapter, BetterAuthVanillaAdapter, BetterAuthReactAdapter)
- **Dual CSS distribution**:
  - `@neondatabase/neon-auth-ui/css` - Pre-built styles for non-Tailwind projects
  - `@neondatabase/neon-auth-ui/tailwind` - Tailwind CSS source for projects using Tailwind
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

### Architecture

- Built on top of `@daveyplate/better-auth-ui` v3.2.13
- Uses Radix UI primitives for accessible components
- Integrates with `next-themes` for theme management
- Form handling via `react-hook-form` with `zod` validation
- CAPTCHA support via multiple providers (hCaptcha, Turnstile, reCAPTCHA)

### Peer Dependencies

- `@neondatabase/neon-auth` >= 0.1.0-alpha.1
- `react` >= 18.0.0
- `react-dom` >= 18.0.0

## Development History

### 2025-11-27
- Fixed adapter compatibility to work with all neon-auth adapters
- Added support for using with and without Tailwind CSS
- Made BetterAuthVanillaAdapter the default adapter

### 2025-11-26
- Added Better Auth adapter support
- Fixed TypeScript type checking issues
- Fixed Tailwind class specificity with `!important`

### 2025-11-25
- Introduced new architecture with custom NeonAuthUIProvider
- Added build script for CSS compilation
- Removed local storage dependency
- Removed Supabase-specific naming

### 2025-11-24
- Fixed CSS file generation
- Achieved working UI state

### 2025-11-23
- Integrated with neon-js client

### 2025-11-19-20
- Adapted to Supabase-compatible AuthClient interface
- Used Better Auth internals
- Removed server components
- Initial package creation
