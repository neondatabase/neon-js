# Multi-Tenant Todo App with Neon Auth & Organizations

![Example](https://raw.githubusercontent.com/thekauer/neon-auth-orgs-example/main/example.gif)

A multi-tenant todo app using **Neon Auth** for authentication and the **Organizations plugin** for team management. Every todo is scoped to an organization, and members can be invited, have their roles changed, or be removed.

---

## Table of Contents

0. [Setup](#0-setup)
1. [Setting Up Neon Auth](#1-setting-up-neon-auth)
2. [Database & Schema Setup](#2-database--schema-setup)
3. [Accessing the `neon_auth` Schema with Drizzle](#3-accessing-the-neon_auth-schema-with-drizzle)
4. [Organization Management](#4-organization-management)
5. [Org-Scoped Data (the `org_id` Column)](#5-org-scoped-data-the-org_id-column)
6. [Member & Invitation Management](#6-member--invitation-management)
7. [Edge Cases & Error Handling](#7-edge-cases--error-handling)
8. [Admin-Only Server-Side Org Creation (Works Even When "Allow Users to Create Organizations" Is Disabled)](#8-admin-only-server-side-org-creation-works-even-when-allow-users-to-create-organizations-is-disabled)

---

## 0. Setup

### Prerequisites

- Node.js 18+ with pnpm
- A [Neon](https://neon.tech) project with **Neon Auth** and the **Organizations plugin** enabled

### 1. Install dependencies

From the monorepo root:

```bash
pnpm install
```

### 2. Configure environment variables

Create `.env.local` in the project root:

```
NEON_AUTH_BASE_URL=https://<endpoint>.neonauth.c-4.us-east-1.aws.neon.tech/neondb/auth
NEON_AUTH_COOKIE_SECRET=<32-byte-base64-secret>
DATABASE_URL=postgresql://neondb_owner:<password>@<endpoint>-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require
```

- **`NEON_AUTH_BASE_URL`** — found in your Neon project dashboard under the Auth tab
- **`NEON_AUTH_COOKIE_SECRET`** — generate with `openssl rand -base64 32`
- **`DATABASE_URL`** — your Neon connection string (use the pooled endpoint)

### 3. Push the database schema

```bash
pnpm exec drizzle-kit push
```

This creates the `todo` table. The `neon_auth` schema (organizations, members, invitations) is managed automatically by Neon Auth.

> **Note:** The `neon_auth` table definitions used by the admin endpoint are already checked in at `src/db/schema.ts`. If those tables ever change upstream, re-run `pnpm exec drizzle-kit pull` and copy the updated definitions from `drizzle/schema.ts` into `src/db/schema.ts`. See [Section 3](#3-accessing-the-neon_auth-schema-with-drizzle) for details.

### 4. Run the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). You'll be redirected to sign in via email OTP, then land on the dashboard.

### 5. (Optional) Set up an admin user

To use the admin org creation endpoint, set a user's role to `"admin"` in the Neon console under the Auth > Users section. This is a global application-level role, not an org-level role.

This is useful for **programmatic org provisioning** scenarios — for example, onboarding flows that automatically create an organization for each new customer, or admin tools that need to provision orgs on behalf of users. Client-side org creation via `authClient.organization.create()` works without this.

---

## 1. Setting Up Neon Auth

### Dependencies

```bash
pnpm add @neondatabase/auth @neondatabase/serverless
```

The auth package is `@neondatabase/auth` (used as a workspace dependency). The serverless driver (`@neondatabase/serverless`) is used for database access over HTTP.

### Environment Variables

Three environment variables are required in `.env.local`:

```
NEON_AUTH_BASE_URL=https://<endpoint>.neonauth.c-4.us-east-1.aws.neon.tech/neondb/auth
NEON_AUTH_COOKIE_SECRET=<32-byte-base64-secret>
DATABASE_URL=postgresql://neondb_owner:<password>@<endpoint>-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require
```

Generate the cookie secret with:
```bash
openssl rand -base64 32
```

### Server-Side Auth

Create a server auth instance at `src/lib/auth/server.ts`:

```ts
import { createNeonAuth } from "@neondatabase/auth/next/server";

export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: {
    secret: process.env.NEON_AUTH_COOKIE_SECRET!,
  },
});
```

This `auth` object is used in:
- **Middleware** — to protect routes
- **API routes** — to get the session and verify the user

### Client-Side Auth

Create a client auth instance at `src/lib/auth/client.ts`:

```ts
"use client";
import { createAuthClient } from "@neondatabase/auth/next";

export const authClient = createAuthClient();
```

This `authClient` is used in all client components for organization operations, session access, and auth hooks.

### Middleware (Route Protection)

`src/proxy.ts` protects dashboard and account routes:

```ts
import { auth } from "@/lib/auth/server";

export default auth.middleware({
  loginUrl: "/auth/sign-in",
});

export const config = {
  matcher: ["/dashboard/:path*", "/account/:path*"],
};
```

Unauthenticated users hitting `/dashboard/*` or `/account/*` are redirected to the sign-in page.

### Auth UI Provider

In the root layout (`src/app/layout.tsx`), wrap the app with `NeonAuthUIProvider`:

```tsx
import { NeonAuthUIProvider, UserButton } from "@neondatabase/auth/react";
import { authClient } from "@/lib/auth/client";

<NeonAuthUIProvider authClient={authClient} redirectTo="/dashboard" emailOTP>
  {/* header with <UserButton /> */}
  {children}
</NeonAuthUIProvider>
```

- `emailOTP` enables email-based one-time-password authentication
- `redirectTo="/dashboard"` sends users to the dashboard after sign-in
- `<UserButton />` renders a pre-built user avatar/menu component

---

## 2. Database & Schema Setup

### Serverless Driver + Drizzle ORM

`src/db/index.ts`:

```ts
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
```

Uses the Neon HTTP driver (not WebSocket) — ideal for serverless environments like Next.js API routes.

### Drizzle Config

`drizzle.config.ts`:

```ts
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  schemaFilter: ["public", "neon_auth"],
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

Run `pnpm exec drizzle-kit push` to sync the schema to the database.

---

## 3. Accessing the `neon_auth` Schema with Drizzle

The `neon_auth` schema (organizations, members, invitations, users, sessions, etc.) is managed by Neon Auth — you never create those tables yourself. But you **can** get type-safe Drizzle access to them for server-side operations like the [admin org creation endpoint](#8-admin-only-server-side-org-creation-works-even-when-allow-users-to-create-organizations-is-disabled).

The table definitions already live in `src/db/schema.ts` (the single source of truth for this app). Here is how they got there and how to update them if the upstream schema ever changes.

### How it works

1. **`drizzle.config.ts`** includes `schemaFilter: ["public", "neon_auth"]` so Drizzle can introspect the auth tables in addition to the `public` schema.

2. **`drizzle-kit pull`** introspects both schemas and generates a complete `drizzle/schema.ts` — including all `neon_auth` tables (`organization`, `member`, `invitation`, `user`, `session`, `jwks`, `verification`, `project_config`). It also generates `drizzle/relations.ts`.

3. **Copy what you need** from the generated `drizzle/schema.ts` into `src/db/schema.ts`. This example only needs `organization` and `member` for the admin endpoint, so those are the only two `neon_auth` tables in the app schema. You can delete the generated `drizzle/schema.ts` and `drizzle/relations.ts` after copying — the `drizzle/` directory only needs to keep migration files and `meta/`.

The result in `src/db/schema.ts`:

```ts
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
```

Since `src/db/index.ts` imports `* as schema`, these tables are automatically available through the `db` instance — you can use `db.insert(organizationInNeonAuth)` with full type safety, no raw SQL needed.

---

## 4. Organization Management

All organization operations use the Neon Auth client SDK. No custom API routes are needed for standard org CRUD — the SDK talks directly to the Neon Auth backend.

### Creating an Organization

```ts
const result = await authClient.organization.create({
  name: "My Org",
  slug: "my-org", // optional, auto-generated from name if omitted
});
```

### Deleting an Organization

```ts
await authClient.organization.delete({
  organizationId: activeOrg.id,
});
```

Only the **owner** can delete an organization. The delete button is conditionally rendered:

```tsx
{activeMember?.role === "owner" && (
  <Button variant="destructive" onClick={handleDelete}>
    Delete Organization
  </Button>
)}
```

### Updating an Organization

```ts
await authClient.organization.update({
  data: { name: "New Name", slug: "new-slug" },
});
```

### Switching the Active Organization

```ts
authClient.organization.setActive({ organizationId: orgId });
```

The active organization ID is stored in the session and available server-side via:

```ts
// src/lib/auth/session.ts
export function getActiveOrgId(session: {
  session: Record<string, unknown>;
}): string | null {
  const orgId = session.session.activeOrganizationId;
  return typeof orgId === "string" ? orgId : null;
}
```

### Listing Organizations

```ts
const { data: organizations } = authClient.useListOrganizations();
```

### Reading the Active Organization

```ts
const { data: activeOrg } = authClient.useActiveOrganization();
const { data: activeMember } = authClient.useActiveMember(); // current user's membership
```

---

## 5. Org-Scoped Data (the `org_id` Column)

The `todo` table includes an `org_id` column that ties every record to an organization:

```ts
// src/db/schema.ts
export const todo = pgTable("todo", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  completed: boolean("completed").notNull().default(false),
  orgId: text("org_id").notNull(),              // <-- ties todo to an org
  createdBy: text("created_by").notNull(),       // user ID
  createdByName: text("created_by_name").notNull().default(""),
  createdByImage: text("created_by_image").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

### How `org_id` Is Enforced in API Routes

**Every API route** extracts the active org from the session and uses it to filter queries:

**GET** — only returns todos for the active org:
```ts
const activeOrgId = getActiveOrgId(session);
if (!activeOrgId) return NextResponse.json({ todos: [] });

const todos = await db.select().from(todo)
  .where(eq(todo.orgId, activeOrgId))
  .orderBy(desc(todo.createdAt));
```

**POST** — stamps the new todo with the active org:
```ts
const [newTodo] = await db.insert(todo).values({
  title: title.trim(),
  orgId: activeOrgId,
  createdBy: session.user.id,
  createdByName: session.user.name || "",
  createdByImage: session.user.image || "",
}).returning();
```

**PATCH/DELETE** — uses a compound `WHERE` clause to prevent cross-org access:
```ts
// Both the todo ID and the org ID must match
.where(and(eq(todo.id, id), eq(todo.orgId, activeOrgId)))
```

If the todo doesn't belong to the active organization, the query returns nothing and the API returns a `404`. This is the core **multi-tenancy isolation** pattern — there is no way to read, update, or delete a todo from another organization.

---

## 6. Member & Invitation Management

### Changing Member Roles

Roles are: `owner`, `admin`, `member`.

```ts
await authClient.organization.updateMemberRole({
  memberId: member.id,
  role: "admin", // "owner" | "admin" | "member"
});
```

### Removing Members

```ts
await authClient.organization.removeMember({
  memberIdOrEmail: memberId,
});
```

### Inviting Members

```ts
await authClient.organization.inviteMember({
  email: "user@example.com",
  role: "member", // or "admin"
});
```

### Listing Pending Invitations (Org Admin View)

```ts
const { data } = await authClient.organization.listInvitations({
  query: { organizationId: activeOrg.id },
});
// Filter to pending only
const pending = data.filter((i) => i.status === "pending");
```

### Cancelling an Invitation

```ts
await authClient.organization.cancelInvitation({ invitationId: id });
```

### Accepting / Rejecting Invitations (User View)

```ts
// List invitations sent to the current user
const { data } = await authClient.organization.listUserInvitations();

// Accept
await authClient.organization.acceptInvitation({ invitationId: inv.id });

// After accepting, refresh the org list and switch to the new org
(authClient as any).$store.notify("$listOrg");
await authClient.organization.setActive({ organizationId: inv.organizationId });

// Reject
await authClient.organization.rejectInvitation({ invitationId: inv.id });
```

---

## 7. Edge Cases & Error Handling

### The Neon Auth Error Type

Every `authClient.organization.*` call returns `{ data, error }` where `error` has the shape `{ code?: string; message?: string }`. Error codes are defined by better-auth's organization plugin (e.g. `YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_ORGANIZATIONS`).

We define a shared type and type guard in `src/lib/auth/errors.ts`:

```ts
/** Standard error shape returned by Neon Auth SDK methods. */
export interface NeonAuthError {
  code?: string;
  message?: string;
}

/** Type guard – true when the value has a `code` or `message` string. */
export function isNeonAuthError(value: unknown): value is NeonAuthError {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.code === "string" || typeof v.message === "string";
}

/**
 * Extract a NeonAuthError from a caught exception.
 *
 * BetterFetchError (thrown in catch blocks) stores the response body
 * in its `.error` property. This helper normalises both shapes.
 */
export function toNeonAuthError(err: unknown): NeonAuthError | null {
  if (isNeonAuthError(err)) return err;
  if (
    typeof err === "object" &&
    err !== null &&
    "error" in err &&
    isNeonAuthError((err as { error: unknown }).error)
  ) {
    return (err as { error: NeonAuthError }).error;
  }
  return null;
}
```

This gives you two patterns — one for the happy-path `result.error` (already typed by the SDK) and one for `catch` blocks:

```ts
// Pattern 1: SDK result — result.error is already typed
const result = await authClient.organization.create({ name, slug });
if (result?.error) {
  const { code, message } = result.error;
  // code and message are both typed as string | undefined
}

// Pattern 2: catch block — use the type guard
try { ... } catch (err: unknown) {
  const authErr = toNeonAuthError(err);
  authErr?.code   // string | undefined
  authErr?.message // string | undefined
}
```

### Organization Limit Reached

Neon Auth enforces a configurable maximum number of organizations per user. When the limit is hit, the SDK returns a `403` with error code `YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_ORGANIZATIONS`:

```ts
if (result?.error) {
  const { code, message } = result.error;
  const msg = code === "YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_ORGANIZATIONS"
    ? "Organization limit reached. Increase the limit in the Neon console."
    : message || "Failed to create organization";
}
```

In catch blocks:

```ts
const authErr = toNeonAuthError(err);
if (authErr?.code === "YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_ORGANIZATIONS") {
  // handle limit reached
}
```

This is handled in both the `OrgSwitcher` and the `CommandMenu` create-org flows.

### Only Owner Constraint

When removing a member, if they are the **last owner** of the organization, the SDK returns error code `YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER`. The mutation throws the SDK error directly (`throw error` instead of `throw new Error(...)`) to preserve the code, then the `onError` handler extracts it:

```ts
// In the mutationFn — throw the SDK error to preserve the code
const { error } = await authClient.organization.removeMember({ memberIdOrEmail: memberId });
if (error) throw error;

// In onError — use the type guard
const authErr = toNeonAuthError(err);
if (authErr?.code === "YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER") {
  toast.error("You cannot leave the organization as the only owner.");
}
```

### No Active Organization

When no org is selected:
- `GET /api/todos` returns `{ todos: [] }` (empty, not an error)
- `POST /api/todos` returns `400 { error: "No active organization" }`
- `PATCH/DELETE /api/todos/[id]` returns `400 { error: "No active organization" }`

### Cross-Organization Access Prevention

PATCH and DELETE routes use a compound WHERE clause — matching on **both** the todo `id` and `orgId`. If the todo exists but belongs to a different org, the query returns no rows and the API returns `404`.

### Cookie Cache Disabled

All server-side `getSession()` calls pass `disableCookieCache: "true"` to always get the freshest session data:

```ts
const { data: session } = await auth.getSession({
  query: { disableCookieCache: "true" },
} as any);
```

---

## 8. Admin-Only Server-Side Org Creation (Works Even When "Allow Users to Create Organizations" Is Disabled)

The Neon console has an **"Allow Users to Create Organizations"** toggle. When this is **disabled**, the client-side SDK call `authClient.organization.create()` will be blocked for all users. The SDK also enforces per-user org limits when the toggle is enabled.

This admin endpoint bypasses **both** restrictions — the toggle and the org limit — by writing directly to the `neon_auth` database tables using Drizzle instead of going through the SDK. This means admins can always provision organizations server-side, regardless of the console settings.

This endpoint relies on the Drizzle table definitions from [Section 3: Accessing the `neon_auth` Schema with Drizzle](#3-accessing-the-neon_auth-schema-with-drizzle).

### The Endpoint: `POST /api/admin/create-org`

Located at `src/app/api/admin/create-org/route.ts`.

### How It Checks Admin Status via Neon Auth

The endpoint uses Neon Auth's server-side session to verify the user is an admin. The `user.role` field is set in the **Neon console** per-user — it is not a role within an organization, but a **global application-level role**.

```ts
const { data: session } = await auth.getSession({
  query: { disableCookieCache: "true" },
} as any);

if (!session?.user) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const userRole = (session.user as any).role;
if (userRole !== "admin") {
  return NextResponse.json({ error: "Forbidden: admin only" }, { status: 403 });
}
```

Three-step auth check:
1. Is the user logged in? If not -> `401`
2. Is `session.user.role` equal to `"admin"`? If not -> `403`
3. Proceed with org creation

### How It Bypasses the Org Limit

Instead of going through the Neon Auth SDK (which enforces limits), the endpoint **inserts directly into the `neon_auth` schema** using the Drizzle table definitions set up in [Section 3](#3-accessing-the-neon_auth-schema-with-drizzle):

```ts
import { organizationInNeonAuth, memberInNeonAuth } from "@/db/schema";

// Insert organization directly into neon_auth schema using Drizzle
const [org] = await db
  .insert(organizationInNeonAuth)
  .values({
    name,
    slug,
    createdAt: new Date().toISOString(),
  })
  .returning();

// Add current user as owner member
await db.insert(memberInNeonAuth).values({
  organizationId: org.id,
  userId,
  role: "owner",
  createdAt: new Date().toISOString(),
});
```

> **When would you use this pattern?** Server-side org provisioning is useful for automated onboarding flows (e.g., creating an org when a customer signs up), admin tools, or any scenario where you need to create orgs programmatically without being subject to the client-side org limit. Client-side org creation via `authClient.organization.create()` works without any of this for normal user-facing flows.

This writes to `neon_auth.organization` and `neon_auth.member` tables directly — the same tables the Neon Auth SDK manages — but **without going through the SDK's validation layer** that enforces the per-user org limit. And because we're using Drizzle instead of raw SQL, we get full type safety on column names and values.

### Client-Side: Admin Create Button

The `AdminCreateOrgButton` component only renders if `session.user.role === "admin"`:

```ts
const { data: session } = authClient.useSession();
if ((session?.user as any)?.role !== "admin") return null;
```

When submitted, it calls the admin endpoint and then notifies the auth store to refresh the org list:

```ts
const res = await fetch("/api/admin/create-org", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name, slug }),
});

// Refresh the org list in the UI
(authClient as any).$store.notify("$listOrg");
```

### Key Takeaway

The standard `authClient.organization.create()` is subject to the org limit configured in the Neon console. The admin endpoint bypasses this by writing directly to the `neon_auth` schema using Drizzle (see [Section 3](#3-accessing-the-neon_auth-schema-with-drizzle) for how to set this up). The admin check uses Neon Auth's own session — `session.user.role` is a global role set in the Neon console, not an org-level role. This means only users explicitly marked as admins in the Neon dashboard can use this endpoint.
