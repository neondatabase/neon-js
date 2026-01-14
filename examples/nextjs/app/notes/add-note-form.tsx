"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export function AddNoteForm() {
    const router = useRouter()
    const [newNote, setNewNote] = useState("")
    const [isAdding, setIsAdding] = useState(false)

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
                setNewNote("")
                router.refresh()
            }
        } catch (error) {
            console.error("Failed to add note:", error)
        } finally {
            setIsAdding(false)
        }
    }

    return (
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
    )
}
