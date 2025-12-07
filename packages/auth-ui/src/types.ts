import { type createAuthClient as createVanillaAuthClient } from 'better-auth/client';
import { type createAuthClient as createReactAuthClient } from 'better-auth/react';

export type VanillaBetterAuthClient = ReturnType<
  typeof createVanillaAuthClient
>;
export type ReactBetterAuthClient = ReturnType<typeof createReactAuthClient>;
