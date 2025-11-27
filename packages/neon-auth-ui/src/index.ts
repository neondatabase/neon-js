// Custom Neon Auth UI Provider with react-adapter logic
export { NeonAuthUIProvider } from './neon-auth-ui-provider';
export type { NeonAuthUIProviderProps } from './neon-auth-ui-provider';

// Export theme hook for consumers
export { useTheme } from 'next-themes';

// =============================================================================
// RE-EXPORT ALL FROM better-auth-ui (EXPLICIT = TREE-SHAKEABLE)
// =============================================================================

// Provider & Context
export {
  AuthUIProvider,
  AuthUIContext,
  AppleIcon,
  DiscordIcon,
  DropboxIcon,
  FacebookIcon,
  GitHubIcon,
  GitLabIcon,
  GoogleIcon,
  HuggingFaceIcon,
  KickIcon,
  LinearIcon,
  LinkedInIcon,
  MicrosoftIcon,
  NotionIcon,
  RedditIcon,
  RobloxIcon,
  SlackIcon,
  SpotifyIcon,
  TikTokIcon,
  TwitchIcon,
  VKIcon,
  XIcon,
  ZoomIcon,
  socialProviders,
} from '@daveyplate/better-auth-ui';

// Auth Forms
export {
  AuthForm,
  SignInForm,
  SignUpForm,
  ForgotPasswordForm,
  MagicLinkForm,
  RecoverAccountForm,
  ResetPasswordForm,
  TwoFactorForm,
  PasswordInput,
} from '@daveyplate/better-auth-ui';

// Views
export {
  AuthView,
  AccountView,
  AuthCallback,
  SignOut,
} from '@daveyplate/better-auth-ui';

// User Components
export { UserButton, UserAvatar, UserView } from '@daveyplate/better-auth-ui';

// Organization Components
export {
  OrganizationSwitcher,
  OrganizationView,
  OrganizationLogo,
  OrganizationCellView,
  OrganizationSettingsCards,
  OrganizationNameCard,
  OrganizationSlugCard,
  OrganizationLogoCard,
  OrganizationMembersCard,
  OrganizationInvitationsCard,
  DeleteOrganizationCard,
  OrganizationsCard,
  CreateOrganizationDialog,
  AcceptInvitationCard,
  UserInvitationsCard,
} from '@daveyplate/better-auth-ui';

// Settings Cards
export {
  SettingsCard,
  AccountSettingsCards,
  SecuritySettingsCards,
  AccountsCard,
  DeleteAccountCard,
  UpdateAvatarCard,
  UpdateFieldCard,
  UpdateNameCard,
  UpdateUsernameCard,
  ChangeEmailCard,
  ChangePasswordCard,
  SessionsCard,
  PasskeysCard,
  ProvidersCard,
  ApiKeysCard,
  TwoFactorCard,
  InputFieldSkeleton,
  SettingsCellSkeleton,
} from '@daveyplate/better-auth-ui';

// Team Components
export {
  TeamsCard,
  TeamCell,
  CreateTeamDialog,
} from '@daveyplate/better-auth-ui';

// Conditional Rendering
export {
  SignedIn,
  SignedOut,
  AuthLoading,
  RedirectToSignIn,
  RedirectToSignUp,
} from '@daveyplate/better-auth-ui';

// Hooks
export {
  useAuthData,
  useAuthenticate,
  useCurrentOrganization,
} from '@daveyplate/better-auth-ui';

// Localization & Utilities
export {
  authLocalization,
  authViewPaths,
  accountViewPaths,
  organizationViewPaths,
  getViewByPath,
} from '@daveyplate/better-auth-ui';

// =============================================================================
// TYPE EXPORTS (all types from better-auth-ui)
// =============================================================================
export type {
  // Provider types
  AuthUIProviderProps,
  AuthUIContextType,
  Provider,
  TeamOptions,
  TeamOptionsContext,
  // Form types
  AuthFormProps,
  AuthFormClassNames,
  SignInFormProps,
  SignUpFormProps,
  ForgotPasswordFormProps,
  MagicLinkFormProps,
  RecoverAccountFormProps,
  ResetPasswordFormProps,
  TwoFactorFormProps,
  // View types
  AuthViewProps,
  AuthViewClassNames,
  AccountViewProps,
  AuthViewPath,
  AuthViewPaths,
  AccountViewPath,
  // User types
  UserButtonProps,
  UserButtonClassNames,
  UserAvatarProps,
  UserAvatarClassNames,
  UserViewProps,
  UserViewClassNames,
  // Organization types
  OrganizationSwitcherProps,
  OrganizationSwitcherClassNames,
  OrganizationViewPageProps,
  OrganizationViewPath,
  OrganizationLogoProps,
  OrganizationLogoClassNames,
  OrganizationViewProps,
  OrganizationViewClassNames,
  OrganizationNameCardProps,
  OrganizationSlugCardProps,
  OrganizationLogoCardProps,
  OrganizationSettingsCardsProps,
  CreateOrganizationDialogProps,
  AcceptInvitationCardProps,
  // Settings types
  SettingsCardProps,
  SettingsCardClassNames,
  AccountsCardProps,
  DeleteAccountCardProps,
  UpdateAvatarCardProps,
  UpdateFieldCardProps,
  ChangePasswordCardProps,
  SessionsCardProps,
  PasskeysCardProps,
  ProvidersCardProps,
  ApiKeysCardProps,
  TwoFactorCardProps,
  // Team types
  TeamCellProps,
  CreateTeamDialogProps,
  Team,
  // Other types
  AuthHooks,
  AuthMutators,
  AuthLocalization,
  AccountViewPaths,
  OrganizationViewPaths,
} from '@daveyplate/better-auth-ui';
