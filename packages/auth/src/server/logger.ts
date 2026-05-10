/**
 * Framework-agnostic logging for Neon Auth server-side proxy and middleware.
 */

export type NeonAuthLogLevel = 'error' | 'warn' | 'info' | 'debug';

const LEVEL_RANK: Record<NeonAuthLogLevel, number> = {
	error: 0,
	warn: 1,
	info: 2,
	debug: 3,
};

/**
 * Optional injectable logger. Omitted methods fall back to `console`.
 */
export type NeonAuthLogger = Partial<{
	error(message: string, meta?: Record<string, unknown>): void;
	warn(message: string, meta?: Record<string, unknown>): void;
	info(message: string, meta?: Record<string, unknown>): void;
	debug(message: string, meta?: Record<string, unknown>): void;
}>;

/**
 * Resolved sink used internally after merging defaults and level filtering.
 */
export type ResolvedNeonAuthLogging = {
	error(message: string, meta?: Record<string, unknown>): void;
	warn(message: string, meta?: Record<string, unknown>): void;
	info(message: string, meta?: Record<string, unknown>): void;
	debug(message: string, meta?: Record<string, unknown>): void;
};

const consoleSink: Required<NeonAuthLogger> = {
	error: (message, meta) => {
		if (meta && Object.keys(meta).length > 0) console.error(message, meta);
		else console.error(message);
	},
	warn: (message, meta) => {
		if (meta && Object.keys(meta).length > 0) console.warn(message, meta);
		else console.warn(message);
	},
	info: (message, meta) => {
		if (meta && Object.keys(meta).length > 0) console.info(message, meta);
		else console.info(message);
	},
	debug: (message, meta) => {
		if (meta && Object.keys(meta).length > 0) console.debug(message, meta);
		else console.debug(message);
	},
};

function wrapWithLevel(
	level: NeonAuthLogLevel,
	logger: Required<NeonAuthLogger>
): ResolvedNeonAuthLogging {
	const minRank = LEVEL_RANK[level];

	const gate = (
		messageLevel: NeonAuthLogLevel,
		fn: (message: string, meta?: Record<string, unknown>) => void
	) => {
		return (message: string, meta?: Record<string, unknown>) => {
			if (LEVEL_RANK[messageLevel] <= minRank) {
				fn(message, meta);
			}
		};
	};

	return {
		error: gate('error', logger.error),
		warn: gate('warn', logger.warn),
		info: gate('info', logger.info),
		debug: gate('debug', logger.debug),
	};
}

export type NeonAuthLoggingInput = {
	logger?: NeonAuthLogger;
	/**
	 * Minimum level when logging is enabled (see {@link resolveNeonAuthLogging}).
	 * @default 'warn' — emits `error` and `warn` only
	 */
	logLevel?: NeonAuthLogLevel;
};

const noopResolved: ResolvedNeonAuthLogging = {
	error: () => {},
	warn: () => {},
	info: () => {},
	debug: () => {},
};

/**
 * Merges user logger with `console`, applies {@link NeonAuthLoggingInput.logLevel}.
 *
 * **Opt-in:** If both `logger` and `logLevel` are omitted, returns a no-op sink (no
 * `console` output from Neon Auth). Set `logLevel` and/or `logger` to enable.
 * When only `logLevel` is set, missing logger methods use `console`.
 */
export function resolveNeonAuthLogging(
	input?: NeonAuthLoggingInput
): ResolvedNeonAuthLogging {
	const optedIn =
		input !== undefined &&
		(input.logger !== undefined || input.logLevel !== undefined);
	if (!optedIn) {
		return noopResolved;
	}

	const level = input.logLevel ?? 'warn';
	const raw = input.logger ?? {};
	const merged: Required<NeonAuthLogger> = {
		error: raw.error ?? consoleSink.error,
		warn: raw.warn ?? consoleSink.warn,
		info: raw.info ?? consoleSink.info,
		debug: raw.debug ?? consoleSink.debug,
	};
	return wrapWithLevel(level, merged);
}
