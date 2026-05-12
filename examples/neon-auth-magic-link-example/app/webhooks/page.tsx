"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"

interface WebhookEvent {
  id: string
  type: string
  timestamp: string
  payload: Record<string, unknown>
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  "magic-link": "bg-primary/15 text-primary",
  "magic-link.sent": "bg-primary/15 text-primary",
  "send.magic_link": "bg-primary/15 text-primary",
  "otp": "bg-primary/15 text-primary",
  "otp.sent": "bg-primary/15 text-primary",
  "email-otp": "bg-primary/15 text-primary",
  "user.created": "bg-emerald-900/40 text-emerald-400",
  "user.before_create": "bg-emerald-900/40 text-emerald-400",
  "user.updated": "bg-yellow-900/40 text-yellow-400",
  "user.deleted": "bg-red-900/40 text-red-400",
  "session.created": "bg-purple-900/40 text-purple-400",
}

function getEventColor(type: string): string {
  if (EVENT_TYPE_COLORS[type]) return EVENT_TYPE_COLORS[type]
  const prefix = Object.keys(EVENT_TYPE_COLORS).find(k => type.startsWith(k))
  if (prefix) return EVENT_TYPE_COLORS[prefix]
  return "bg-secondary text-secondary-foreground"
}

export default function WebhooksPage() {
  const [events, setEvents] = useState<WebhookEvent[]>([])
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [newEventIds, setNewEventIds] = useState<Set<string>>(new Set())
  const [lastFetchCount, setLastFetchCount] = useState(0)
  const [origin, setOrigin] = useState("")

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/webhooks/events")
      const data = await res.json()
      const fetched = data.events as WebhookEvent[]

      if (fetched.length > lastFetchCount) {
        const newIds = new Set(fetched.slice(0, fetched.length - lastFetchCount).map(e => e.id))
        setNewEventIds(prev => new Set([...prev, ...newIds]))
        setTimeout(() => {
          setNewEventIds(prev => {
            const next = new Set(prev)
            for (const id of newIds) next.delete(id)
            return next
          })
        }, 5000)
      }
      setLastFetchCount(fetched.length)
      setEvents(fetched)
    } catch {
      // ignore fetch errors
    }
  }, [lastFetchCount])

  useEffect(() => {
    fetchEvents()
    const interval = setInterval(fetchEvents, 2500)
    return () => clearInterval(interval)
  }, [fetchEvents])

  const clearAll = async () => {
    await fetch("/api/webhooks/events", { method: "DELETE" })
    setEvents([])
    setLastFetchCount(0)
    setNewEventIds(new Set())
  }

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const grouped = events.reduce<Record<string, WebhookEvent[]>>((acc, event) => {
    const key = event.type
    if (!acc[key]) acc[key] = []
    acc[key].push(event)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-12">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Webhook Event Log
            </h1>
            <p className="mt-1 text-muted-foreground">
              Received {events.length} event{events.length !== 1 ? "s" : ""}. Polling every 2.5 seconds.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/dashboard"
              className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-accent"
            >
              Dashboard
            </Link>
            <button
              onClick={clearAll}
              disabled={events.length === 0}
              className="rounded-md bg-destructive px-3 py-1.5 text-sm text-foreground hover:bg-destructive/80 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Clear Events
            </button>
          </div>
        </div>

        {/* Summary by type */}
        {Object.keys(grouped).length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {Object.entries(grouped).map(([type, evts]) => (
              <span key={type} className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${getEventColor(type)}`}>
                {type} ({evts.length})
              </span>
            ))}
          </div>
        )}

        {events.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-foreground">No webhook events yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Configure your neon-auth instance to send webhooks to{" "}
              <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs">
                POST /api/webhooks/neon-auth
              </code>
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Then try sending a magic link to see events appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <div
                key={event.id}
                className={`rounded-lg border border-border bg-card transition-all ${
                  newEventIds.has(event.id)
                    ? "ring-2 ring-primary/50 border-primary/30"
                    : ""
                }`}
              >
                <button
                  onClick={() => toggleExpand(event.id)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-accent/50 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getEventColor(event.type)}`}>
                      {event.type}
                    </span>
                    {newEventIds.has(event.id) && (
                      <span className="inline-flex items-center rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                        NEW
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      #{event.id}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                    <svg
                      className={`h-4 w-4 text-muted-foreground transition-transform ${
                        expandedIds.has(event.id) ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>
                {expandedIds.has(event.id) && (
                  <div className="border-t border-border px-4 py-3">
                    <pre className="overflow-x-auto rounded-md bg-background p-3 text-xs font-mono text-foreground">
                      {JSON.stringify(event.payload, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Setup instructions */}
        <div className="mt-8 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <h3 className="text-sm font-semibold text-primary">Webhook Setup</h3>
          <p className="mt-1 text-sm text-primary/70">
            Configure your neon-auth project to send webhooks to:
          </p>
          <code className="mt-2 block rounded bg-primary/10 px-3 py-2 text-xs font-mono text-primary">
            POST {origin || "http://localhost:3000"}/api/webhooks/neon-auth
          </code>
          <p className="mt-2 text-sm text-primary/70">
            Events triggered by magic link, user creation, and more will appear here.
          </p>
        </div>
      </div>
    </div>
  )
}
