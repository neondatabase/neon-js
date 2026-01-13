import { NextRequest, NextResponse } from "next/server"
import { eq, desc } from "drizzle-orm"
import { db } from "@/lib/db"
import { notes } from "@/lib/schema"
import { neonAuth } from "@neondatabase/auth/next"

// GET - List notes for the current user
export async function GET() {
    const session = await neonAuth()
    
    if (!session.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userNotes = await db
        .select()
        .from(notes)
        .where(eq(notes.userId, session.user.id))
        .orderBy(desc(notes.createdAt))
        .limit(15)

    return NextResponse.json(userNotes)
}

// POST - Create a new note
export async function POST(request: NextRequest) {
    const session = await neonAuth()
    
    if (!session.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { title } = await request.json()

    if (!title || typeof title !== "string" || title.trim() === "") {
        return NextResponse.json({ error: "Title is required" }, { status: 400 })
    }

    const [newNote] = await db
        .insert(notes)
        .values({
            title: title.trim(),
            userId: session.user.id,
        })
        .returning()

    return NextResponse.json(newNote, { status: 201 })
}

