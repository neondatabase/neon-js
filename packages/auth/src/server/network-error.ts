/**
 * Classifies failed upstream `fetch` calls for clearer client responses and logs.
 */

export type NeonAuthNetworkErrorCode =
	| 'NETWORK_ERROR'
	| 'NETWORK_DNS'
	| 'NETWORK_REFUSED'
	| 'NETWORK_TIMEOUT'
	| 'NETWORK_TLS'
	| 'NETWORK_RESET'
	| 'NETWORK_ABORT';

export type ClassifiedFetchFailure =
	| {
			kind: 'transport';
			code: NeonAuthNetworkErrorCode;
			/** Safe short detail for logs (no secrets) */
			detail?: string;
			clientMessage: string;
	  }
	| {
			kind: 'internal';
			detail?: string;
			clientMessage: string;
	  };

function readErrnoCode(node: unknown): string | undefined {
	if (!node || typeof node !== 'object') return undefined;
	const code = (node as NodeJS.ErrnoException).code;
	return typeof code === 'string' ? code : undefined;
}

function isAbortError(node: unknown): boolean {
	return node instanceof Error && node.name === 'AbortError';
}

function isTlsRelated(code: string | undefined, message: string): boolean {
	if (!code && !message) return false;
	const c = code ?? '';
	if (
		c.startsWith('ERR_TLS') ||
		c.startsWith('CERT_') ||
		c === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'
	) {
		return true;
	}
	const m = message.toLowerCase();
	return (
		m.includes('certificate') ||
		m.includes('ssl') ||
		m.includes('tls') ||
		m.includes('wrong version number')
	);
}

function isLegacyFetchTypeError(node: unknown): boolean {
	return (
		node instanceof TypeError &&
		typeof node.message === 'string' &&
		node.message.includes('fetch')
	);
}

function collectRelatedErrors(error: unknown): unknown[] {
	const seen = new Set<unknown>();
	const list: unknown[] = [];

	function add(e: unknown): void {
		if (e === undefined || e === null) return;
		if (typeof e === 'object') {
			if (seen.has(e)) return;
			seen.add(e);
		}
		list.push(e);

		if (e instanceof Error && e.cause !== undefined) {
			add(e.cause);
		}
		if (e instanceof AggregateError && Array.isArray(e.errors)) {
			for (const sub of e.errors) {
				add(sub);
			}
		}
	}

	add(error);
	return list;
}

function clientMessageFor(code: NeonAuthNetworkErrorCode): string {
	switch (code) {
		case 'NETWORK_DNS':
			return 'Could not resolve authentication server hostname';
		case 'NETWORK_REFUSED':
			return 'Connection refused by authentication server';
		case 'NETWORK_TIMEOUT':
			return 'Authentication server connection timed out';
		case 'NETWORK_TLS':
			return 'TLS error connecting to authentication server';
		case 'NETWORK_RESET':
			return 'Connection to authentication server was reset';
		case 'NETWORK_ABORT':
			return 'Authentication request was aborted';
		default:
			return 'Unable to connect to authentication server';
	}
}

/**
 * Inspects an error from `fetch` (including `cause` and aggregate errors) and
 * returns a stable code for responses and observability.
 */
export function classifyFetchFailure(error: unknown): ClassifiedFetchFailure {
	const nodes = collectRelatedErrors(error);

	for (const node of nodes) {
		if (isAbortError(node)) {
			return {
				kind: 'transport',
				code: 'NETWORK_ABORT',
				detail: 'AbortError',
				clientMessage: clientMessageFor('NETWORK_ABORT'),
			};
		}
	}

	for (const node of nodes) {
		const code = readErrnoCode(node);
		const message = node instanceof Error ? node.message : '';

		if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
			return {
				kind: 'transport',
				code: 'NETWORK_DNS',
				detail: code,
				clientMessage: clientMessageFor('NETWORK_DNS'),
			};
		}
		if (code === 'ECONNREFUSED') {
			return {
				kind: 'transport',
				code: 'NETWORK_REFUSED',
				detail: code,
				clientMessage: clientMessageFor('NETWORK_REFUSED'),
			};
		}
		if (
			code === 'ETIMEDOUT' ||
			code === 'UND_ERR_CONNECT_TIMEOUT' ||
			code === 'UND_ERR_HEADERS_TIMEOUT' ||
			code === 'UND_ERR_BODY_TIMEOUT'
		) {
			return {
				kind: 'transport',
				code: 'NETWORK_TIMEOUT',
				detail: code ?? 'timeout',
				clientMessage: clientMessageFor('NETWORK_TIMEOUT'),
			};
		}
		if (code === 'ECONNRESET' || code === 'EPIPE' || code === 'ECONNABORTED') {
			return {
				kind: 'transport',
				code: 'NETWORK_RESET',
				detail: code,
				clientMessage: clientMessageFor('NETWORK_RESET'),
			};
		}
		if (isTlsRelated(code, message)) {
			return {
				kind: 'transport',
				code: 'NETWORK_TLS',
				detail: code ?? 'tls',
				clientMessage: clientMessageFor('NETWORK_TLS'),
			};
		}
	}

	for (const node of nodes) {
		if (isLegacyFetchTypeError(node)) {
			return {
				kind: 'transport',
				code: 'NETWORK_ERROR',
				detail: 'fetch TypeError',
				clientMessage: clientMessageFor('NETWORK_ERROR'),
			};
		}
	}

	const head = nodes[0];
	const message =
		head instanceof Error ? head.message : 'Internal Server Error';

	return {
		kind: 'internal',
		detail: message.slice(0, 200),
		clientMessage: message,
	};
}
