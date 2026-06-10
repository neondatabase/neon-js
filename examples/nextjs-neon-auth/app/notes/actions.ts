"use server"

import { revalidatePath } from "next/cache"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { notes } from "@/lib/schema"
import { auth } from "@/lib/auth/server"

/**
 * Server Action that creates a note for the current user.
 *
 * This intentionally lives on the protected `/notes` route (see `proxy.ts`
 * matcher). A Server Action is dispatched as a POST to the current page URL,
 * so this is the canonical way to exercise the auth middleware against a
 * non-GET request. If the middleware ever regresses to forwarding the request
 * method into its internal session lookup, this action will be redirected to
 * the sign-in page even for an authenticated user. Keep this wired up so that
 * breakage is caught manually (and is a candidate for an E2E test).
 */
export async function addNoteAction(formData: FormData) {
  const { data: session } = await auth.getSession()
  if (!session?.user) {
    throw new Error("Unauthorized")
  }

  const title = (formData.get("title") as string | null)?.trim()
  if (!title) {
    return
  }

  await db.insert(notes).values({
    title,
    userId: session.user.id,
  })

  revalidatePath("/notes")
}

/**
 * Server Action that deletes one of the current user's notes.
 * Same protected-route / non-GET considerations as {@link addNoteAction}.
 */
export async function deleteNoteAction(formData: FormData) {
  const { data: session } = await auth.getSession()
  if (!session?.user) {
    throw new Error("Unauthorized")
  }

  const id = formData.get("id") as string | null
  if (!id) {
    return
  }

  await db
    .delete(notes)
    .where(and(eq(notes.id, id), eq(notes.userId, session.user.id)))

  revalidatePath("/notes")
}
