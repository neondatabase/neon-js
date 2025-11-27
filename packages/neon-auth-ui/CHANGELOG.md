# Changelog

All notable changes to `@neondatabase/neon-auth-ui` will be documented in this file.

## Unreleased

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
