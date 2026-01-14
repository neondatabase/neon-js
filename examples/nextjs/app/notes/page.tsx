import { redirect } from "next/navigation"
import { StickyNote } from "lucide-react"
import { authServer } from "@/lib/auth/server"
import { db } from "@/lib/db"
import { notes } from "@/lib/schema"
import { eq, desc } from "drizzle-orm"
import { AddNoteForm } from "./add-note-form"
import { DeleteNoteButton } from "./delete-note-button"

function formatDate(date: Date | string) {
    return new Date(date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })
}

export default async function NotesPage() {
    const { data: session } = await authServer.getSession()

    if (!session?.user) {
        redirect("/auth/sign-in")
    }

    const userNotes = await db
        .select()
        .from(notes)
        .where(eq(notes.userId, session.user.id))
        .orderBy(desc(notes.createdAt))
        .limit(15)

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
                <AddNoteForm />

                {/* Notes List */}
                {userNotes.length === 0 ? (
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
                        {userNotes.map((note) => (
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
                                <DeleteNoteButton noteId={note.id} />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
