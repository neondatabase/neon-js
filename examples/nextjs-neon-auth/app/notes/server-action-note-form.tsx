"use client"

import { useRef } from "react"
import { useFormStatus } from "react-dom"
import { Plus, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { addNoteAction } from "./actions"

function SubmitButton() {
    const { pending } = useFormStatus()
    return (
        <Button
            type="submit"
            disabled={pending}
            className="bg-primary px-4 text-primary-foreground hover:bg-primary/90"
        >
            {pending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
                <Plus className="h-5 w-5" />
            )}
        </Button>
    )
}

/**
 * Add-note form backed by a Next.js Server Action (not an API route).
 *
 * Submitting this form POSTs to the current `/notes` URL, which is covered by
 * the auth middleware matcher. It exists so adopters (and us) can verify that
 * Server Actions on protected routes are NOT redirected to sign-in for an
 * authenticated user.
 */
export function ServerActionNoteForm() {
    const formRef = useRef<HTMLFormElement>(null)

    return (
        <form
            ref={formRef}
            action={async (formData) => {
                await addNoteAction(formData)
                formRef.current?.reset()
            }}
            className="mb-8"
        >
            <div className="flex gap-2">
                <input
                    type="text"
                    name="title"
                    placeholder="Add a note via Server Action..."
                    className="flex-1 rounded-lg border border-input bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                />
                <SubmitButton />
            </div>
        </form>
    )
}
