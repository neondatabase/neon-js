import {
  pgTable,
  pgSchema,
  text,
  boolean,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// App tables (public schema) — managed by `drizzle-kit push`
// ---------------------------------------------------------------------------

export const todo = pgTable("todo", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  completed: boolean("completed").notNull().default(false),
  orgId: text("org_id").notNull(),
  createdBy: text("created_by").notNull(),
  createdByName: text("created_by_name").notNull().default(""),
  createdByImage: text("created_by_image").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Todo = typeof todo.$inferSelect;
export type NewTodo = typeof todo.$inferInsert;

// ---------------------------------------------------------------------------
// neon_auth schema — these tables are managed by Neon Auth, NOT by drizzle-kit push.
//
// The definitions below were obtained by running `drizzle-kit pull` with
// schemaFilter: ["public", "neon_auth"] in drizzle.config.ts, then copying
// only the tables needed for server-side operations (e.g. the admin org
// creation endpoint) into this file.
//
// This file is the single source of truth for Drizzle schema in this app.
// ---------------------------------------------------------------------------
const neonAuth = pgSchema("neon_auth");

export const organizationInNeonAuth = neonAuth.table("organization", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  name: text().notNull(),
  slug: text().notNull(),
  logo: text(),
  createdAt: timestamp({ withTimezone: true, mode: "string" }).notNull(),
  metadata: text(),
});

export const memberInNeonAuth = neonAuth.table("member", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  organizationId: uuid().notNull(),
  userId: uuid().notNull(),
  role: text().notNull(),
  createdAt: timestamp({ withTimezone: true, mode: "string" }).notNull(),
});
