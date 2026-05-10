import { describe, test, expect, vi } from 'vitest';
import { resolveNeonAuthLogging } from './logger';

describe('resolveNeonAuthLogging', () => {
	test('when logger and logLevel are omitted, logging is silent', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const log = resolveNeonAuthLogging({});

		log.warn('should not reach console');
		expect(warnSpy).not.toHaveBeenCalled();
		warnSpy.mockRestore();
	});

	test('logLevel alone opts in to console-backed sink', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const log = resolveNeonAuthLogging({ logLevel: 'warn' });

		log.warn('hello');
		expect(warnSpy).toHaveBeenCalledWith('hello');
		warnSpy.mockRestore();
	});

	test('default level warn emits error and warn only when logger is set', () => {
		const calls = { error: 0, warn: 0, info: 0, debug: 0 };
		const log = resolveNeonAuthLogging({
			logger: {
				error: () => {
					calls.error++;
				},
				warn: () => {
					calls.warn++;
				},
				info: () => {
					calls.info++;
				},
				debug: () => {
					calls.debug++;
				},
			},
		});

		log.error('e');
		log.warn('w');
		log.info('i');
		log.debug('d');

		expect(calls).toEqual({ error: 1, warn: 1, info: 0, debug: 0 });
	});

	test('debug level emits all', () => {
		const calls = { error: 0, warn: 0, info: 0, debug: 0 };
		const log = resolveNeonAuthLogging({
			logLevel: 'debug',
			logger: {
				error: () => calls.error++,
				warn: () => calls.warn++,
				info: () => calls.info++,
				debug: () => calls.debug++,
			},
		});

		log.error('e');
		log.warn('w');
		log.info('i');
		log.debug('d');

		expect(calls).toEqual({ error: 1, warn: 1, info: 1, debug: 1 });
	});
});
