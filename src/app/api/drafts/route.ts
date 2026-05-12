import { auth } from "@/auth";
import { connectMongo } from "@/lib/mongo";
import { Draft } from "@/models/Draft";
import {
  created,
  fromZodError,
  ok,
  parseJson,
  unauthorized,
} from "@/lib/api";
import { createDraftSchema } from "@/lib/schemas";

/**
 * GET /api/drafts — list the current user's drafts, newest first.
 *
 * Drafts are intentionally simple: just userId + content + timestamps.
 * No length / shape validation beyond a 10k char ceiling, since the
 * whole point of a draft is to capture half-finished work.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) return unauthorized();

  await connectMongo();
  const drafts = await Draft.find({ userId: session.user.id })
    .sort({ updatedAt: -1 })
    .lean();

  return ok(
    drafts.map((d) => ({
      id: String(d._id),
      content: d.content,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }))
  );
}

/** POST /api/drafts — create a new draft (no merge/upsert). */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return unauthorized();

  const parsed = await parseJson(req);
  if (!parsed.ok) return parsed.response;

  const result = createDraftSchema.safeParse(parsed.body);
  if (!result.success) return fromZodError(result.error);

  await connectMongo();
  const doc = await Draft.create({
    userId: session.user.id,
    content: result.data.content,
  });

  return created({ id: String(doc._id) });
}
