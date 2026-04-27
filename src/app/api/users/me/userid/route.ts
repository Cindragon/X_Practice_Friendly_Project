import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { userIdSchema } from "@/lib/userid";

/**
 * POST /api/users/me/userid
 *
 * Body: { userID: string }
 * Sets the userID for the currently signed-in user. Used by the first-time
 * /setup-username step. Once set, it cannot be changed (returns 409).
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = userIdSchema.safeParse(
    (body as { userID?: unknown })?.userID
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid userID" },
      { status: 400 }
    );
  }
  const userID = parsed.data;

  // Refuse to change once it's set — userIDs are forever, per spec.
  const existing = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { userID: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (existing.userID) {
    return NextResponse.json(
      { error: "userID is already set" },
      { status: 409 }
    );
  }

  try {
    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: { userID },
      select: { id: true, userID: true },
    });
    return NextResponse.json({ data: updated }, { status: 200 });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "This userID is already taken" },
        { status: 409 }
      );
    }
    throw err;
  }
}
