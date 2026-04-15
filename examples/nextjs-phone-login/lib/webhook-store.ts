export interface WebhookEvent {
  id: string;
  type: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

interface WebhookStore {
  events: WebhookEvent[];
  nextId: number;
}

const STORE_KEY = Symbol.for('__neon_auth_webhook_store__');

function getStore(): WebhookStore {
  const g = globalThis as unknown as Record<symbol, WebhookStore | undefined>;
  if (!g[STORE_KEY]) {
    g[STORE_KEY] = { events: [], nextId: 1 };
  }
  return g[STORE_KEY]!;
}

export function addEvent(type: string, payload: Record<string, unknown>): WebhookEvent {
  const store = getStore();
  const event: WebhookEvent = {
    id: String(store.nextId++),
    type,
    timestamp: new Date().toISOString(),
    payload,
  };
  store.events.unshift(event);
  if (store.events.length > 200) {
    store.events.length = 200;
  }
  return event;
}

export function getEvents(): WebhookEvent[] {
  return getStore().events;
}

export function clearEvents(): void {
  const store = getStore();
  store.events.length = 0;
}
