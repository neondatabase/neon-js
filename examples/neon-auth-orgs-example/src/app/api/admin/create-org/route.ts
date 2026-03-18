import { auth } from "@/lib/auth/server";
import { db } from "@/db";
import { organizationInNeonAuth, memberInNeonAuth } from "@/db/schema";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { data: session } = await auth.getSession({
    query: { disableCookieCache: "true" },
  } as any);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userRole = (session.user as any).role;
  if (userRole !== "admin") {
    return NextResponse.json({ error: "Forbidden: admin only" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const name = body.name;
    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    const slug = body.slug || name.toLowerCase().replace(/\s+/g, "-");
    const userId = session.user.id;

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

    return NextResponse.json({ organization: org });
  } catch (err: unknown) {
    console.error("[admin-create-org] error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
