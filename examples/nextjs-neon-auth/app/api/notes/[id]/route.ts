import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { notes } from "@/lib/schema"
import { authServer } from "@/lib/auth/server"

// DELETE - Delete a note by ID
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { data: session } = await authServer.getSession()
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    await db
        .delete(notes)
        .where(
            and(
                eq(notes.id, id),
                eq(notes.userId, session.user.id)
            )
        )
    return NextResponse.json({ success: true })
}
