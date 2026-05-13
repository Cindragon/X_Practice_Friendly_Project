/**
 * Integration test for the Like REST API (Step 9).
 *
 *  - Seeds Alice + a session; creates one Post authored by Alice.
 *  - Drives like / unlike across auth + idempotency cases.
 *  - Confirms that deleting the post cascade-cleans the Like row
 *    (consistent with src/app/api/posts/[id]/route.ts DELETE).
 *
 * Pre-req: dev server on http://localhost:3000.
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { prisma } from "../src/lib/db";
import { connectMongo } from "../src/lib/mongo";
import { Post } from "../src/models/Post";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";

let pass = 0;
let fail = 0;
function assert(label: string, cond: boolean, extra?: unknown) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}`, extra ?? "");
  }
}

type Json = Record<string, unknown>;
async function call(
  method: string,
  path: string,
  opts: { cookie?: string; body?: unknown } = {}
): Promise<{ status: number; json: Json }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.cookie) headers.Cookie = opts.cookie;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    redirect: "manual",
  });
  let json: Json = {};
  try {
    json = (await res.json()) as Json;
  } catch {
    /* non-JSON */
  }
  return { status: res.status, json };
}

async function main() {
  console.log(`Testing against ${BASE}\n`);
  try {
    await fetch(BASE, { redirect: "manual" });
  } catch {
    console.error(`Cannot reach ${BASE}. Start the dev server first.`);
    process.exit(1);
  }
  await connectMongo();

  const tag = `t${Date.now().toString(36)}`;
  const aliceID = `alice_${tag}`;
  const alice = await prisma.user.create({
    data: { userID: aliceID, name: "Alice", email: `${aliceID}@e.com` },
  });
  const sessionToken = randomBytes(32).toString("hex");
  await prisma.session.create({
    data: {
      sessionToken,
      userId: alice.id,
      expires: new Date(Date.now() + 24 * 3600 * 1000),
    },
  });
  const cookie = `authjs.session-token=${sessionToken}`;

  const post = await Post.create({
    authorId: alice.id,
    content: "hello like test",
  });
  const postId = String(post._id);

  try {
    console.log("§ POST /api/posts/[id]/like");
    {
      const r = await call("POST", `/api/posts/${postId}/like`);
      assert("anon like -> 401", r.status === 401);
    }
    {
      const r = await call("POST", "/api/posts/not-an-id/like", { cookie });
      assert("malformed id -> 400", r.status === 400);
    }
    {
      const r = await call(
        "POST",
        "/api/posts/000000000000000000000000/like",
        { cookie }
      );
      assert("unknown id -> 404", r.status === 404);
    }
    {
      const r = await call("POST", `/api/posts/${postId}/like`, { cookie });
      assert("first like -> 200", r.status === 200, r);
      const d = r.json.data as Json | undefined;
      assert(
        "liked=true, alreadyLiked=false",
        d?.liked === true && d?.alreadyLiked === false,
        d
      );
    }
    {
      const r = await call("POST", `/api/posts/${postId}/like`, { cookie });
      const d = r.json.data as Json | undefined;
      assert("repeat like is idempotent", d?.alreadyLiked === true, d);
    }
    {
      const r = await call("GET", `/api/posts/${postId}`, { cookie });
      const d = r.json.data as Json | undefined;
      const counts = d?.counts as Json | undefined;
      assert("GET reports likes=1", counts?.likes === 1, counts);
      assert("GET reports likedByMe=true", d?.likedByMe === true);
    }

    console.log("\n§ DELETE /api/posts/[id]/like");
    {
      const r = await call("DELETE", `/api/posts/${postId}/like`);
      assert("anon unlike -> 401", r.status === 401);
    }
    {
      const r = await call("DELETE", `/api/posts/${postId}/like`, { cookie });
      assert("unlike -> 200", r.status === 200);
    }
    {
      const r = await call("DELETE", `/api/posts/${postId}/like`, { cookie });
      assert("repeat unlike is idempotent", r.status === 200);
    }
    {
      const r = await call("GET", `/api/posts/${postId}`, { cookie });
      const d = r.json.data as Json | undefined;
      const counts = d?.counts as Json | undefined;
      assert("likes=0 after unlike", counts?.likes === 0);
      assert("likedByMe=false after unlike", d?.likedByMe === false);
    }

    console.log("\n§ Delete post cleans up likes");
    {
      // Re-like, then delete the post, then verify Like row is gone.
      await call("POST", `/api/posts/${postId}/like`, { cookie });
      const beforeCount = await prisma.like.count({ where: { postId } });
      assert("like row exists before delete", beforeCount === 1);

      const del = await call("DELETE", `/api/posts/${postId}`, { cookie });
      assert("delete post -> 200", del.status === 200);

      const afterCount = await prisma.like.count({ where: { postId } });
      assert("like rows cleaned up after delete", afterCount === 0);
    }
  } finally {
    await prisma.like.deleteMany({ where: { userId: alice.id } });
    await prisma.session.deleteMany({ where: { userId: alice.id } });
    await Post.deleteMany({ authorId: alice.id });
    await prisma.user.delete({ where: { id: alice.id } });
    await prisma.$disconnect();
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
