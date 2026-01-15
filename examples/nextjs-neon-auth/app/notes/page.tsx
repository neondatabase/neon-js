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
        <div className="min-h-screen bg-background">
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
                <AddNoteForm />

                {/* Notes List */}
                {userNotes.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
                        <StickyNote className="mx-auto h-12 w-12 text-muted-foreground/30" />
                        <h3 className="mt-4 font-medium text-foreground">
                            No notes yet
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Add your first note using the form above.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {userNotes.map((note) => (
                            <div
                                key={note.id}
                                className="group flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-4 transition-all hover:bg-accent"
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="text-card-foreground">{note.title}</p>
                                    <p className="mt-1 text-xs text-muted-foreground">
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
