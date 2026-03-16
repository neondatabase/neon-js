import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  // `out` is used by both `drizzle-kit generate` (migrations) and `drizzle-kit pull`.
  // After running `drizzle-kit pull`, copy the neon_auth table definitions you need
  // from drizzle/schema.ts into src/db/schema.ts (the single source of truth).
  out: "./drizzle",
  dialect: "postgresql",
  schemaFilter: ["public", "neon_auth"],
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
