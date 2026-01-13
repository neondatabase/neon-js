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
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-300 border-t-zinc-950 dark:border-zinc-700 dark:border-t-zinc-50" />
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading...</p>
                </div>
            </div>
        )
    }

    if (!session) {
        return null
    }

    return (
        <div className="min-h-[calc(100vh-3.5rem)] bg-zinc-50 dark:bg-zinc-950">
            <div className="container mx-auto max-w-2xl px-4 py-8 md:px-6 md:py-12">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 dark:bg-amber-500/20">
                            <StickyNote className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                            Notes
                        </h1>
                    </div>
                    <p className="text-zinc-600 dark:text-zinc-400">
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
                            className="flex-1 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-zinc-900 placeholder:text-zinc-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-amber-400"
                            disabled={isAdding}
                        />
                        <Button
                            type="submit"
                            disabled={!newNote.trim() || isAdding}
                            className="bg-amber-500 px-4 text-white hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500"
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
                            <div className="h-6 w-6 animate-spin rounded-full border-3 border-zinc-300 border-t-zinc-950 dark:border-zinc-700 dark:border-t-zinc-50" />
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading notes...</p>
                        </div>
                    </div>
                ) : notes.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
                        <StickyNote className="mx-auto h-12 w-12 text-zinc-300 dark:text-zinc-600" />
                        <h3 className="mt-4 font-medium text-zinc-900 dark:text-zinc-50">
                            No notes yet
                        </h3>
                        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                            Add your first note using the form above.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {notes.map((note) => (
                            <div
                                key={note.id}
                                className="group flex items-start justify-between gap-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition-all hover:border-zinc-300 hover:shadow dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="text-zinc-900 dark:text-zinc-50">{note.title}</p>
                                    <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                                        {formatDate(note.createdAt)}
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleDeleteNote(note.id)}
                                    disabled={deletingId === note.id}
                                    className="shrink-0 rounded-md p-2 text-zinc-400 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 disabled:opacity-50 dark:hover:bg-red-950 dark:hover:text-red-400"
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

