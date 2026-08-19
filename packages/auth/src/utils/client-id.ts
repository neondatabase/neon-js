let fallbackSequence = 0;

export function createClientId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  fallbackSequence += 1;
  // Used for local client and subscription IDs, not authentication tokens.
  return [
    'neon',
    Date.now().toString(36),
    fallbackSequence.toString(36),
    Math.random().toString(36).slice(2)
  ].join('-');
}
