/**
 * Re-export all types from better-auth for convenience.
 * Users don't need to add better-auth as a direct dependency.
 *
 * This includes types from all plugins supported by NeonAuth.
 * See adapter-core.ts for the list of supported plugins.
 */

// ============================================
// Core types from better-auth/types
// ============================================
export * from 'better-auth/types';

// Error types
export type { BetterFetchError } from '@better-fetch/fetch';

// ============================================
// Plugin types (all supported plugins)
// ============================================

// Organization plugin
export type {
  Organization,
  Member,
  Invitation,
  InvitationStatus,
  OrganizationRole,
  Team,
  TeamMember,
  OrganizationInput,
  MemberInput,
  InvitationInput,
  TeamInput,
  TeamMemberInput,
} from 'better-auth/plugins/organization';

// JWT plugin
export type {
  JwtOptions,
  Jwk,
  JWKOptions,
  JWSAlgorithms,
} from 'better-auth/plugins/jwt';

// Admin plugin
export type {
  AdminOptions,
  UserWithRole,
  SessionWithImpersonatedBy,
  InferAdminRolesFromOption,
} from 'better-auth/plugins/admin';

// Email OTP plugin
export type { EmailOTPOptions } from 'better-auth/plugins/email-otp';

// Anonymous plugin - no additional types to export

// ============================================
// Backwards compatibility aliases
// ============================================
export type {
  BetterAuthSession,
  BetterAuthUser,
  BetterAuthErrorResponse,
} from '../core/better-auth-types';
