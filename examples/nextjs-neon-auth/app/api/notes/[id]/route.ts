import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { notes } from "@/lib/schema"
import { neonAuth } from "@neondatabase/auth/next"

// DELETE - Delete a note by ID
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await neonAuth()
    
    if (!session.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const [deletedNote] = await db
        .delete(notes)
        .where(
            and(
                eq(notes.id, id),
                eq(notes.userId, session.user.id)
            )
        )
        .returning()

    if (!deletedNote) {
        return NextResponse.json({ error: "Note not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
}

