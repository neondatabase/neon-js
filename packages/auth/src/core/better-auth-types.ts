import type { BetterFetchError } from '@better-fetch/fetch';
import type { Session, User } from 'better-auth/types';

export type BetterAuthSession = Session & {
  impersonatedBy?: string | null;
  activeOrganizationId?: string | null;
};

export type BetterAuthUser = User & {
  role?: string | null;
  banned?: boolean | null;
  banReason?: string | null;
  banExpires?: Date | null;
};

export type BetterAuthErrorResponse = BetterFetchError;
