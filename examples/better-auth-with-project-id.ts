/**
 * Example: Using Better Auth adapter with project identifier
 *
 * This demonstrates how to use the projectIdentifier option for multi-tenant
 * localStorage isolation (e.g., for different Neon branches).
 */

import { BetterAuthAdapter } from '../src/auth/adapters/better-auth';

// Example 1: Without project identifier (default behavior)
const adapterDefault = new BetterAuthAdapter({
  baseURL: 'https://my-auth-server.com',
});
// localStorage keys: neon-auth:v1:session, neon-auth:v1:invalidated

// Example 2: With project identifier (for branch isolation)
const adapterWithProject = new BetterAuthAdapter({
  baseURL: 'https://my-auth-server.com',
  projectIdentifier: 'my-branch-slug',
});
// localStorage keys: neon-auth:my-branch-slug:v1:session, neon-auth:my-branch-slug:v1:invalidated

// Example 3: Using with Neon's endpoint-based identifier
const neonEndpoint = 'https://ep-abc123.us-east-2.aws.neon.tech';
const endpointId = new URL(neonEndpoint).hostname.split('.')[0]; // Extract 'ep-abc123'

const adapterNeon = new BetterAuthAdapter({
  baseURL: 'https://my-auth-server.com',
  projectIdentifier: endpointId, // 'ep-abc123'
});
// localStorage keys: neon-auth:ep-abc123:v1:session, neon-auth:ep-abc123:v1:invalidated

console.log('✅ Examples created successfully');
console.log('Default adapter:', adapterDefault);
console.log('With project ID:', adapterWithProject);
console.log('Neon endpoint-based:', adapterNeon);
