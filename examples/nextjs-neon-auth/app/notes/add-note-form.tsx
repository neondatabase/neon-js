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
                    className="flex-1 rounded-lg border border-input bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                    disabled={isAdding}
                />
                <Button
                    type="submit"
                    disabled={!newNote.trim() || isAdding}
                    className="bg-primary px-4 text-primary-foreground hover:bg-primary/90"
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
