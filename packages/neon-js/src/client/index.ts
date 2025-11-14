export { NeonClient } from './neon-client';
export { createClient } from './client-factory';

// Re-export utilities from postgrest-js for convenience
export { fetchWithToken, AuthRequiredError } from '@neondatabase/postgrest-js';
