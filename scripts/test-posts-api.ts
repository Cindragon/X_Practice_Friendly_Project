/**
 * Integration test for Posts / Drafts REST API (Step 7).
 *
 * - Seeds Alice in Postgres + a Session.
 * - Exercises char-count rules, repost idempotency, reply, soft delete,
 *   draft CRUD.
 * - Cleans up at the end (posts + drafts + session + user).
 *
 * Pre-req: `yarn dev` must be running on http://localhost:3000.
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { prisma } from "../src/lib/db";
import { connectMongo } from "../src/lib/mongo";
import { Post } from "../src/models/Post";
import { Draft } from "../src/models/Draft";
import { effectiveLength } from "../src/lib/post-text";

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

  // ── Section 0: char-count pure unit tests (no HTTP) ────────────────────
  console.log("§ effectiveLength (pure)");
  assert("plain text counted as-is", effectiveLength("hello world") === 11);
  assert(
    "a URL counts as 23",
    effectiveLength("see https://example.com/foo/bar/very/long/path?x=1") ===
      "see ".length + 23
  );
  assert(
    "@mention is free",
    effectiveLength("yo @alice how are you") ===
      "yo  how are you".length // exactly mention + leading space removed... compute below
  );
  // More explicit:
  assert(
    "mention math: 'hi @abc'",
    effectiveLength("hi @abc") === "hi ".length
  );
  assert(
    "hashtag math: 'go #cats now'",
    effectiveLength("go #cats now") === "go  now".length
  );
  assert(
    "280 boundary holds",
    effectiveLength("x".repeat(280)) === 280
  );

  // ── Seed Alice + session ───────────────────────────────────────────────
  const tag = `t${Date.now().toString(36)}`;
  const aliceID = `alice_${tag}`;
  const bobID = `bob_${tag}`;
  const alice = await prisma.user.create({
    data: { userID: aliceID, name: "Alice T", email: `${aliceID}@e.com` },
  });
  const bob = await prisma.user.create({
    data: { userID: bobID, name: "Bob T", email: `${bobID}@e.com` },
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

  const createdPostIds: string[] = [];
  const createdDraftIds: string[] = [];
  let topPostId: string | null = null;

  try {
    // ── Section 1: POST /api/posts ─────────────────────────────────────
    console.log("\n§ POST /api/posts");

    {
      const r = await call("POST", "/api/posts", {
        body: { content: "hello world" },
      });
      assert("anonymous post -> 401", r.status === 401);
    }
    {
      const r = await call("POST", "/api/posts", { cookie, body: {} });
      assert("empty body -> 400", r.status === 400, r);
    }
    {
      const r = await call("POST", "/api/posts", {
        cookie,
        body: { content: "   " },
      });
      assert("whitespace-only -> 400", r.status === 400);
    }
    {
      const r = await call("POST", "/api/posts", {
        cookie,
        body: { content: "x".repeat(281) },
      });
      assert("281 plain chars -> 400", r.status === 400, r);
    }
    {
      const r = await call("POST", "/api/posts", {
        cookie,
        body: { content: "x".repeat(280) },
      });
      assert("280 plain chars -> 201", r.status === 201, r);
      const d = r.json.data as Json | undefined;
      if (d?.id) createdPostIds.push(d.id as string);
    }
    {
      // 5 chars + URL (whatever real length) + 5 chars = 5+23+5 = 33
      const body = {
        content: `hello https://example.com/this/is/a/very/long/url world`,
      };
      const r = await call("POST", "/api/posts", { cookie, body });
      assert("link counts as 23 -> 201", r.status === 201, r);
      if (r.json.data) createdPostIds.push((r.json.data as Json).id as string);
    }
    {
      // Top-level for follow-up reply / delete tests
      const r = await call("POST", "/api/posts", {
        cookie,
        body: { content: `parent post #intro @${bobID}` },
      });
      assert("post with mention+tag -> 201", r.status === 201, r);
      const d = r.json.data as Json | undefined;
      topPostId = (d?.id as string) ?? null;
      if (topPostId) createdPostIds.push(topPostId);
    }

    // ── Section 2: reply ───────────────────────────────────────────────
    console.log("\n§ Reply");
    {
      const r = await call("POST", "/api/posts", {
        cookie,
        body: { content: "nice", parentId: topPostId },
      });
      assert("reply -> 201", r.status === 201);
      if (r.json.data) createdPostIds.push((r.json.data as Json).id as string);
    }
    {
      const r = await call("POST", "/api/posts", {
        cookie,
        body: { content: "huh", parentId: "0".repeat(24) },
      });
      assert("reply to nonexistent parent -> 404", r.status === 404);
    }
    {
      const r = await call("POST", "/api/posts", {
        cookie,
        body: { content: "huh", parentId: "nope" },
      });
      assert("invalid parentId -> 400", r.status === 400);
    }

    // ── Section 3: repost (idempotent) ─────────────────────────────────
    console.log("\n§ Repost");
    {
      const r = await call("POST", "/api/posts", {
        cookie,
        body: { repostOfId: topPostId },
      });
      assert("repost -> 201", r.status === 201);
      const d = r.json.data as Json | undefined;
      assert("not alreadyReposted", d?.alreadyReposted === false);
      if (d?.id) createdPostIds.push(d.id as string);
    }
    {
      const r = await call("POST", "/api/posts", {
        cookie,
        body: { repostOfId: topPostId },
      });
      const d = r.json.data as Json | undefined;
      assert(
        "repeat repost is idempotent",
        d?.alreadyReposted === true,
        r
      );
    }
    {
      const r = await call("POST", "/api/posts", {
        cookie,
        body: { content: "hi", parentId: topPostId, repostOfId: topPostId },
      });
      assert("reply+repost combo -> 400", r.status === 400);
    }

    // ── Section 4: GET /api/posts/[id] ─────────────────────────────────
    console.log("\n§ GET /api/posts/[id]");
    {
      const r = await call("GET", `/api/posts/${topPostId}`);
      assert("public read -> 200", r.status === 200);
      const d = r.json.data as Json | undefined;
      const counts = d?.counts as Json | undefined;
      assert("replies count >= 1", (counts?.replies as number) >= 1);
      assert("reposts count >= 1", (counts?.reposts as number) >= 1);
      const author = d?.author as Json | undefined;
      assert("author userID hydrated", author?.userID === aliceID);
    }
    {
      const r = await call("GET", "/api/posts/000000000000000000000000");
      assert("unknown id -> 404", r.status === 404);
    }
    {
      const r = await call("GET", "/api/posts/not-an-id");
      assert("malformed id -> 400", r.status === 400);
    }

    // ── Section 5: DELETE /api/posts/[id] ──────────────────────────────
    console.log("\n§ DELETE /api/posts/[id]");
    {
      const r = await call("DELETE", `/api/posts/${topPostId}`);
      assert("anonymous delete -> 401", r.status === 401);
    }
    {
      // Bob session can't delete Alice's post
      const bobToken = randomBytes(32).toString("hex");
      await prisma.session.create({
        data: {
          sessionToken: bobToken,
          userId: bob.id,
          expires: new Date(Date.now() + 3600_000),
        },
      });
      const r = await call("DELETE", `/api/posts/${topPostId}`, {
        cookie: `authjs.session-token=${bobToken}`,
      });
      assert("other user delete -> 403", r.status === 403);
    }
    {
      const r = await call("DELETE", `/api/posts/${topPostId}`, { cookie });
      assert("own delete -> 200", r.status === 200);
    }
    {
      const r = await call("DELETE", `/api/posts/${topPostId}`, { cookie });
      assert("repeat delete is idempotent", r.status === 200);
    }
    {
      const r = await call("GET", `/api/posts/${topPostId}`);
      const d = r.json.data as Json | undefined;
      assert("deleted post returns deleted=true", d?.deleted === true);
      assert("deleted post hides content", d?.content === "");
    }

    // ── Section 6: Drafts ──────────────────────────────────────────────
    console.log("\n§ Drafts");
    {
      const r = await call("POST", "/api/drafts", {
        body: { content: "x" },
      });
      assert("anonymous draft create -> 401", r.status === 401);
    }
    {
      const r = await call("POST", "/api/drafts", {
        cookie,
        body: { content: "draft 1" },
      });
      assert("create draft -> 201", r.status === 201);
      if (r.json.data) {
        createdDraftIds.push((r.json.data as Json).id as string);
      }
    }
    {
      const r = await call("POST", "/api/drafts", {
        cookie,
        body: { content: "draft 2" },
      });
      if (r.json.data) {
        createdDraftIds.push((r.json.data as Json).id as string);
      }
    }
    {
      const r = await call("GET", "/api/drafts", { cookie });
      assert("list drafts -> 200", r.status === 200);
      const arr = r.json.data as unknown[];
      assert(
        "list has at least our 2 drafts",
        Array.isArray(arr) && arr.length >= 2,
        arr
      );
    }
    {
      const target = createdDraftIds[0];
      const r = await call("DELETE", `/api/drafts/${target}`, { cookie });
      assert("delete draft -> 200", r.status === 200);
    }
    {
      const r = await call("DELETE", "/api/drafts/000000000000000000000000", {
        cookie,
      });
      assert("delete unknown draft -> 404", r.status === 404);
    }
  } finally {
    // ── Cleanup ────────────────────────────────────────────────────────
    if (createdPostIds.length) {
      await Post.deleteMany({ _id: { $in: createdPostIds } });
    }
    if (createdDraftIds.length) {
      await Draft.deleteMany({ _id: { $in: createdDraftIds } });
    }
    // Belt + braces: nuke anything authored by our two test users this run.
    await Post.deleteMany({ authorId: { $in: [alice.id, bob.id] } });
    await Draft.deleteMany({ userId: { $in: [alice.id, bob.id] } });

    await prisma.like.deleteMany({
      where: { userId: { in: [alice.id, bob.id] } },
    });
    await prisma.session.deleteMany({
      where: { userId: { in: [alice.id, bob.id] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [alice.id, bob.id] } },
    });
    await prisma.$disconnect();
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
