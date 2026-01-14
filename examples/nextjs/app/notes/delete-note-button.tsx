"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Trash2, Loader2 } from "lucide-react"

interface DeleteNoteButtonProps {
    noteId: string
}

export function DeleteNoteButton({ noteId }: DeleteNoteButtonProps) {
    const router = useRouter()
    const [isDeleting, setIsDeleting] = useState(false)

    const handleDelete = async () => {
        setIsDeleting(true)
        try {
            const response = await fetch(`/api/notes/${noteId}`, {
                method: "DELETE",
            })

            if (response.ok) {
                router.refresh()
            }
        } catch (error) {
            console.error("Failed to delete note:", error)
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="shrink-0 rounded-md p-2 text-zinc-400 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 disabled:opacity-50 dark:hover:bg-red-950 dark:hover:text-red-400"
            title="Delete note"
        >
            {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
                <Trash2 className="h-4 w-4" />
            )}
        </button>
    )
}
