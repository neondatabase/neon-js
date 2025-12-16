/**
 * API endpoint configuration for server-side auth methods.
 * This is the single source of truth for mapping method names to REST endpoints.
 *
 * To add a new API:
 * 1. Add the endpoint configuration here
 * 2. The types will automatically flow from VanillaBetterAuthClient
 */

export interface EndpointConfig {
  path: string;
  method: 'GET';
}

export type EndpointTree = {
  [key: string]: EndpointConfig | EndpointTree;
};

export const API_ENDPOINTS = {
  // Session
  getSession: { path: 'get-session', method: 'GET' },

  // User
  listAccounts: { path: 'list-accounts', method: 'GET' },

  // JWT
  token: { path: 'token', method: 'GET' },
} as const satisfies EndpointTree;

export type ApiEndpoints = typeof API_ENDPOINTS;
