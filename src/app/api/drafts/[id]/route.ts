import { auth } from "@/auth";
import { connectMongo } from "@/lib/mongo";
import { Draft } from "@/models/Draft";
import {
  badRequest,
  forbidden,
  notFound,
  ok,
  unauthorized,
} from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };
const OBJECT_ID_RE = /^[a-fA-F0-9]{24}$/;

/**
 * DELETE /api/drafts/[id]
 *
 * Hard-delete the draft (no soft delete — drafts have no inbound refs).
 * Idempotent: 404 if it never existed; 403 if it belongs to someone else.
 */
export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!OBJECT_ID_RE.test(id)) return badRequest("Invalid draft id");

  const session = await auth();
  if (!session?.user) return unauthorized();

  await connectMongo();
  const draft = await Draft.findById(id);
  if (!draft) return notFound("Draft not found");
  if (draft.userId !== session.user.id) return forbidden();

  await draft.deleteOne();
  return ok({ deleted: true });
}
