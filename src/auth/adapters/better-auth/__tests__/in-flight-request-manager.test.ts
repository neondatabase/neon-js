import { describe, it, expect, vi } from 'vitest';
import { InFlightRequestManager } from '../in-flight-request-manager';

describe('InFlightRequestManager', () => {
  it('should deduplicate concurrent calls to same key', async () => {
    const manager = new InFlightRequestManager();
    const mockFn = vi.fn(async () => 'result');

    // Make 10 concurrent calls with same key
    const calls = Array.from({ length: 10 }, () =>
      manager.deduplicate('test-key', mockFn)
    );

    const results = await Promise.all(calls);

    // Assert: Only 1 function execution
    expect(mockFn).toHaveBeenCalledTimes(1);

    // Assert: All results are identical
    results.forEach((result) => {
      expect(result).toBe('result');
    });
  });

  it('should track different keys independently', async () => {
    const manager = new InFlightRequestManager();
    const mockFn1 = vi.fn(async () => 'result1');
    const mockFn2 = vi.fn(async () => 'result2');

    // Make concurrent calls with different keys
    const [result1, result2] = await Promise.all([
      manager.deduplicate('key1', mockFn1),
      manager.deduplicate('key2', mockFn2),
    ]);

    // Assert: Both functions executed (different keys)
    expect(mockFn1).toHaveBeenCalledTimes(1);
    expect(mockFn2).toHaveBeenCalledTimes(1);

    // Assert: Results are different
    expect(result1).toBe('result1');
    expect(result2).toBe('result2');
  });

  it('should allow retry after successful completion', async () => {
    const manager = new InFlightRequestManager();
    let callCount = 0;
    const mockFn = vi.fn(async () => `result-${++callCount}`);

    // First call
    const result1 = await manager.deduplicate('test-key', mockFn);
    expect(result1).toBe('result-1');
    expect(mockFn).toHaveBeenCalledTimes(1);

    // Second call (after first completed)
    const result2 = await manager.deduplicate('test-key', mockFn);
    expect(result2).toBe('result-2');
    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  it('should share errors across all waiting callers', async () => {
    const manager = new InFlightRequestManager();
    const error = new Error('Test error');
    const mockFn = vi.fn(async () => {
      throw error;
    });

    // Make 5 concurrent calls
    const calls = Array.from({ length: 5 }, () =>
      manager.deduplicate('test-key', mockFn)
    );

    // Assert: All promises reject with same error
    await expect(Promise.all(calls)).rejects.toThrow('Test error');

    // Assert: Only 1 function execution
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should allow retry after failed request', async () => {
    const manager = new InFlightRequestManager();
    let shouldFail = true;
    const mockFn = vi.fn(async () => {
      if (shouldFail) {
        throw new Error('First call fails');
      }
      return 'success';
    });

    // First call - fails
    await expect(manager.deduplicate('test-key', mockFn)).rejects.toThrow(
      'First call fails'
    );
    expect(mockFn).toHaveBeenCalledTimes(1);

    // Second call - succeeds (Promise was cleared after error)
    shouldFail = false;
    const result = await manager.deduplicate('test-key', mockFn);
    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  it('should support manual clearing of specific key', async () => {
    const manager = new InFlightRequestManager();
    let callCount = 0;
    const mockFn = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return `result-${++callCount}`;
    });

    // Start request (don't await)
    const promise1 = manager.deduplicate('test-key', mockFn);

    // Clear before resolution
    manager.clear('test-key');

    // New request should execute (old Promise was cleared)
    const promise2 = manager.deduplicate('test-key', mockFn);

    // Both promises should resolve independently
    const [result1, result2] = await Promise.all([promise1, promise2]);

    expect(mockFn).toHaveBeenCalledTimes(2);
    expect(result1).toBe('result-1');
    expect(result2).toBe('result-2');
  });

  it('should support clearing all keys', async () => {
    const manager = new InFlightRequestManager();
    const mockFn = vi.fn(async () => 'result');

    // Start multiple requests (don't await)
    manager.deduplicate('key1', mockFn);
    manager.deduplicate('key2', mockFn);

    expect(manager.size()).toBe(2);

    // Clear all
    manager.clearAll();

    expect(manager.size()).toBe(0);
  });

  it('should correctly report in-flight status', async () => {
    const manager = new InFlightRequestManager();
    const mockFn = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return 'result';
    });

    // Before request
    expect(manager.has('test-key')).toBe(false);

    // Start request (don't await)
    const promise = manager.deduplicate('test-key', mockFn);

    // During request
    expect(manager.has('test-key')).toBe(true);

    // After completion
    await promise;
    expect(manager.has('test-key')).toBe(false);
  });

  it('should preserve type information with generics', async () => {
    const manager = new InFlightRequestManager();

    // Test with different return types
    const stringResult = await manager.deduplicate('string', async () => 'text');
    const numberResult = await manager.deduplicate('number', async () => 42);
    const objectResult = await manager.deduplicate('object', async () => ({
      id: 1,
      name: 'Test',
    }));

    // TypeScript should infer correct types
    const _stringCheck: string = stringResult;
    const _numberCheck: number = numberResult;
    const _objectCheck: { id: number; name: string } = objectResult;

    expect(typeof stringResult).toBe('string');
    expect(typeof numberResult).toBe('number');
    expect(typeof objectResult).toBe('object');
  });
});
