/**
 * In-memory webhook event store.
 * Events are stored in a global array and exposed via API routes.
 * This is for demo purposes only — in production, persist to a database.
 *
 * We attach the store to `globalThis` so that it survives module
 * re-instantiation across Next.js route handlers (App Router can
 * create separate module instances for each route, which means a
 * plain module-level variable would be duplicated and events added
 * by one route would be invisible to another).
 */

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

// Symbol key avoids collisions with other globals
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
  store.events.unshift(event); // newest first
  // Keep max 200 events
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
