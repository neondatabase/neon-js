'use client';

import { useState, useEffect, useCallback } from 'react';

interface WebhookEvent {
  id: string;
  type: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

const EVENT_COLORS: Record<string, string> = {
  'user.created': 'bg-green-500/10 text-green-400 border-green-500/20',
  'user.updated': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'user.deleted': 'bg-red-500/10 text-red-400 border-red-500/20',
  'user.before_create': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  'session.created': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'phone_number.verified': 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  'magic_link.requested': 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
};

const DEFAULT_COLOR = 'bg-muted text-muted-foreground border-border';

function getEventColor(type: string): string {
  return EVENT_COLORS[type] || DEFAULT_COLOR;
}

function timeAgo(timestamp: string): string {
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export default function WebhooksPage() {
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isPolling, setIsPolling] = useState(true);
  const [lastSeenId, setLastSeenId] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/webhooks/events');
      const data = await res.json();
      setEvents(data.events || []);
    } catch (err) {
      console.error('Failed to fetch events:', err);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
    if (!isPolling) return;

    const interval = setInterval(fetchEvents, 2500);
    return () => clearInterval(interval);
  }, [fetchEvents, isPolling]);

  useEffect(() => {
    if (events.length > 0 && lastSeenId !== events[0].id) {
      const timer = setTimeout(() => setLastSeenId(events[0].id), 3000);
      return () => clearTimeout(timer);
    }
  }, [events, lastSeenId]);

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function clearEvents() {
    await fetch('/api/webhooks/events', { method: 'DELETE' });
    setEvents([]);
    setLastSeenId(null);
  }

  const typeCounts = events.reduce<Record<string, number>>((acc, e) => {
    acc[e.type] = (acc[e.type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Webhook Events</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Live viewer for Neon Auth webhook events. Configure your webhook URL to{' '}
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
              {'<your-app-url>'}/api/webhooks/neon-auth
            </code>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsPolling(!isPolling)}
            className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
              isPolling
                ? 'bg-primary/10 text-primary border border-primary/20'
                : 'bg-muted text-muted-foreground border border-border'
            }`}
          >
            {isPolling ? '● Live' : '○ Paused'}
          </button>
          <button
            onClick={clearEvents}
            className="px-3 py-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground text-xs transition-colors border border-border"
          >
            Clear
          </button>
        </div>
      </div>

      {Object.keys(typeCounts).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(typeCounts).map(([type, count]) => (
            <span
              key={type}
              className={`px-2 py-1 rounded-full text-xs border ${getEventColor(type)}`}
            >
              {type} ({count})
            </span>
          ))}
        </div>
      )}

      {events.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p>No webhook events yet.</p>
          <p className="text-sm mt-1">Events will appear here as they arrive.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((event, index) => {
            const isNew = index === 0 && lastSeenId !== event.id;
            const isExpanded = expandedIds.has(event.id);

            return (
              <div
                key={event.id}
                className={`rounded-lg border border-border overflow-hidden transition-all ${
                  isNew ? 'ring-1 ring-primary/30' : ''
                }`}
              >
                <button
                  onClick={() => toggleExpanded(event.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                >
                  <span className={`px-2 py-0.5 rounded text-xs border ${getEventColor(event.type)}`}>
                    {event.type}
                  </span>
                  {isNew && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-primary text-primary-foreground font-bold animate-pulse">
                      NEW
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground ml-auto">{timeAgo(event.timestamp)}</span>
                  <span className="text-muted-foreground text-xs">{isExpanded ? '▼' : '▶'}</span>
                </button>
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-border">
                    <pre className="text-xs text-muted-foreground overflow-x-auto mt-3 p-3 bg-muted rounded-lg">
                      {JSON.stringify(event.payload, null, 2)}
                    </pre>
                    <div className="text-[10px] text-muted-foreground/50 mt-2">
                      {new Date(event.timestamp).toLocaleString()} · Event #{event.id}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
