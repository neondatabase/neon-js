export { createAuthServerInternal } from './client-factory';
export { type RequestContext } from './request-context';

export { parseSessionData, validateSessionData } from './session';

export {
	type NeonAuthConfig,
	type NeonAuthMiddlewareConfig,
	type SessionCookieSameSite,
} from './config';
export {
	resolveNeonAuthLogging,
	type NeonAuthLogger,
	type NeonAuthLogLevel,
	type NeonAuthLoggingInput,
	type ResolvedNeonAuthLogging,
} from './logger';
export {
	NEON_AUTH_NETWORK_ERROR_CODES,
	classifyFetchFailure,
	type NeonAuthNetworkErrorCode,
	type ClassifiedFetchFailure,
} from './network-error';
export type { NeonAuthServerApiError } from './types';
