"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Trash2, Plus, StickyNote, Loader2 } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import type { Note } from "@/lib/schema"

export default function NotesPage() {
    const { data: session, isPending: sessionPending } = authClient.useSession()
    const router = useRouter()
    const [notes, setNotes] = useState<Note[]>([])
    const [newNote, setNewNote] = useState("")
    const [isLoading, setIsLoading] = useState(true)
    const [isAdding, setIsAdding] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const fetchNotes = useCallback(async () => {
        try {
            const response = await fetch("/api/notes")
            if (response.ok) {
                const data = await response.json()
                setNotes(data)
            }
        } catch (error) {
            console.error("Failed to fetch notes:", error)
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        if (!sessionPending && !session) {
            router.push("/auth/sign-in")
        }
    }, [session, sessionPending, router])

    useEffect(() => {
        if (session) {
            fetchNotes()
        }
    }, [session, fetchNotes])

    const handleAddNote = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newNote.trim() || isAdding) return

        setIsAdding(true)
        try {
            const response = await fetch("/api/notes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: newNote.trim() }),
            })

            if (response.ok) {
                const createdNote = await response.json()
                setNotes((prev) => [createdNote, ...prev.slice(0, 14)])
                setNewNote("")
            }
        } catch (error) {
            console.error("Failed to add note:", error)
        } finally {
            setIsAdding(false)
        }
    }

    const handleDeleteNote = async (id: string) => {
        setDeletingId(id)
        try {
            const response = await fetch(`/api/notes/${id}`, {
                method: "DELETE",
            })

            if (response.ok) {
                setNotes((prev) => prev.filter((note) => note.id !== id))
            }
        } catch (error) {
            console.error("Failed to delete note:", error)
        } finally {
            setDeletingId(null)
        }
    }

    const formatDate = (date: Date | string) => {
        return new Date(date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        })
    }

    if (sessionPending) {
        return (
            <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-foreground" />
                    <p className="text-sm text-muted-foreground">Loading...</p>
                </div>
            </div>
        )
    }

    if (!session) {
        return null
    }

    return (
        <div className="min-h-[calc(100vh-3.5rem)] bg-muted">
            <div className="container mx-auto max-w-2xl px-4 py-8 md:px-6 md:py-12">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                            <StickyNote className="h-5 w-5 text-primary" />
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">
                            Notes
                        </h1>
                    </div>
                    <p className="text-muted-foreground">
                        Quick notes for your thoughts. Last 15 notes are displayed.
                    </p>
                </div>

                {/* Quick Add Form */}
                <form onSubmit={handleAddNote} className="mb-8">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                            placeholder="Add a quick note..."
                            className="flex-1 rounded-lg border bg-card px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                            disabled={isAdding}
                        />
                        <Button
                            type="submit"
                            disabled={!newNote.trim() || isAdding}
                        >
                            {isAdding ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <Plus className="h-5 w-5" />
                            )}
                        </Button>
                    </div>
                </form>

                {/* Notes List */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="flex flex-col items-center gap-2">
                            <div className="h-6 w-6 animate-spin rounded-full border-3 border-muted border-t-foreground" />
                            <p className="text-sm text-muted-foreground">Loading notes...</p>
                        </div>
                    </div>
                ) : notes.length === 0 ? (
                    <div className="rounded-lg border border-dashed bg-card p-12 text-center">
                        <StickyNote className="mx-auto h-12 w-12 text-muted-foreground/50" />
                        <h3 className="mt-4 font-medium text-foreground">
                            No notes yet
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Add your first note using the form above.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {notes.map((note) => (
                            <div
                                key={note.id}
                                className="group flex items-start justify-between gap-4 rounded-lg border bg-card p-4 shadow-sm transition-all hover:shadow"
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="text-foreground">{note.title}</p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        {formatDate(note.createdAt)}
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleDeleteNote(note.id)}
                                    disabled={deletingId === note.id}
                                    className="shrink-0 rounded-md p-2 text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 disabled:opacity-50"
                                    title="Delete note"
                                >
                                    {deletingId === note.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Trash2 className="h-4 w-4" />
                                    )}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
