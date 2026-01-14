# Changelog

All notable changes to `@neondatabase/auth-ui` will be documented in this file.

## Unreleased

## [0.1.0-alpha.11] - 2026-01-14

### Fixed

- **CSS Theme Isolation**: CSS variables now use `--neon-*` prefix on `:root` to prevent overriding user's custom Tailwind themes
  - All variables use `--neon-*` prefix internally with fallback pattern: `var(--user-var, default)`
  - Styles wrapped in `@layer neon-auth` for lower specificity than user's unlayered CSS
  - See `docs/solutions/ui-bugs/css-variables-theme-conflict.md` for details

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
