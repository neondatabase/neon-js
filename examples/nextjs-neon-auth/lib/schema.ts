import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

export const notes = pgTable("notes", {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    userId: text("user_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export type Note = typeof notes.$inferSelect
export type NewNote = typeof notes.$inferInsert

