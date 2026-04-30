/**
 * Integration test for the Users / Follow REST API (Step 5).
 *
 * - Seeds two Users (alice, bob) and a Session for alice in Postgres.
 * - Hits each endpoint with the session cookie, asserting status & shape.
 * - Cleans up at the end.
 *
 * Pre-req: `yarn dev` must be running on http://localhost:3000.
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { prisma } from "../src/lib/db";

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
    /* non-JSON body: leave as {} */
  }
  return { status: res.status, json };
}

async function main() {
  console.log(`Testing against ${BASE}\n`);

  // ── Reachability check ─────────────────────────────────────────────────
  try {
    await fetch(BASE, { redirect: "manual" });
  } catch {
    console.error(
      `Cannot reach ${BASE}. Start the dev server first: yarn dev`
    );
    process.exit(1);
  }

  // ── Seed ───────────────────────────────────────────────────────────────
  const tag = `t${Date.now().toString(36)}`;
  const aliceID = `alice_${tag}`;
  const bobID = `bob_${tag}`;

  const alice = await prisma.user.create({
    data: { userID: aliceID, name: "Alice Test", email: `${aliceID}@e.com` },
  });
  const bob = await prisma.user.create({
    data: { userID: bobID, name: "Bob Test", email: `${bobID}@e.com` },
  });

  // Real session row → real cookie. Auth.js v5 cookie name is
  // `authjs.session-token` in dev (no __Secure- prefix).
  const sessionToken = randomBytes(32).toString("hex");
  await prisma.session.create({
    data: {
      sessionToken,
      userId: alice.id,
      expires: new Date(Date.now() + 24 * 3600 * 1000),
    },
  });
  const cookie = `authjs.session-token=${sessionToken}`;

  try {
    // ── Section 1: /api/users/me ────────────────────────────────────────
    console.log("§ /api/users/me");
    {
      const r = await call("GET", "/api/users/me");
      assert("GET without cookie -> 401", r.status === 401, r);
    }
    {
      const r = await call("GET", "/api/users/me", { cookie });
      assert("GET with cookie -> 200", r.status === 200);
      const data = r.json.data as Json | undefined;
      assert("response.data.userID is alice", data?.userID === aliceID);
      assert(
        "counts default to 0",
        data?.followersCount === 0 &&
          data?.followingCount === 0 &&
          data?.postsCount === 0
      );
    }
    {
      const r = await call("PATCH", "/api/users/me", {
        cookie,
        body: { bio: "hello world", avatarUrl: "" },
      });
      assert("PATCH valid -> 200", r.status === 200, r);
      const data = r.json.data as Json | undefined;
      assert("bio updated", data?.bio === "hello world");
      assert("avatarUrl cleared", data?.avatarUrl === null);
    }
    {
      const r = await call("PATCH", "/api/users/me", {
        cookie,
        body: { bio: "x".repeat(200) }, // > 160
      });
      assert("PATCH oversized bio -> 400", r.status === 400, r);
    }
    {
      const r = await call("PATCH", "/api/users/me", {
        cookie,
        body: { avatarUrl: "not-a-url" },
      });
      assert("PATCH invalid url -> 400", r.status === 400, r);
    }
    {
      const r = await call("PATCH", "/api/users/me", {
        cookie,
        body: { userID: "hax_attempt" }, // strict schema rejects
      });
      assert("PATCH unknown field -> 400", r.status === 400, r);
    }
    {
      const r = await call("PATCH", "/api/users/me", { cookie, body: {} });
      assert("PATCH empty body -> 400", r.status === 400, r);
    }

    // ── Section 2: GET /api/users/[userID] ──────────────────────────────
    console.log("\n§ GET /api/users/[userID]");
    {
      const r = await call("GET", `/api/users/${bobID}`);
      assert("anonymous GET -> 200", r.status === 200);
      const d = r.json.data as Json | undefined;
      assert("userID matches", d?.userID === bobID);
      assert("isMe is false", d?.isMe === false);
      assert("isFollowing is false", d?.isFollowing === false);
    }
    {
      const r = await call("GET", `/api/users/${aliceID}`, { cookie });
      const d = r.json.data as Json | undefined;
      assert("isMe true on self", d?.isMe === true, d);
    }
    {
      const r = await call("GET", "/api/users/no_such_user_xx");
      assert("GET unknown -> 404", r.status === 404);
    }

    // ── Section 3: follow / unfollow ────────────────────────────────────
    console.log("\n§ POST/DELETE /api/users/[userID]/follow");
    {
      const r = await call("POST", `/api/users/${bobID}/follow`);
      assert("POST without cookie -> 401", r.status === 401);
    }
    {
      const r = await call("POST", `/api/users/${aliceID}/follow`, { cookie });
      assert("self-follow -> 400", r.status === 400, r);
    }
    {
      const r = await call("POST", `/api/users/${bobID}/follow`, { cookie });
      assert("follow bob -> 200", r.status === 200, r);
      const d = r.json.data as Json | undefined;
      assert(
        "following=true, alreadyFollowing=false",
        d?.following === true && d?.alreadyFollowing === false
      );
    }
    {
      const r = await call("POST", `/api/users/${bobID}/follow`, { cookie });
      const d = r.json.data as Json | undefined;
      assert("repeat follow is idempotent", d?.alreadyFollowing === true);
    }
    {
      const r = await call("GET", `/api/users/${bobID}`, { cookie });
      const d = r.json.data as Json | undefined;
      assert("bob.followersCount = 1", d?.followersCount === 1, d);
      assert("isFollowing = true", d?.isFollowing === true, d);
    }
    {
      const r = await call("GET", "/api/users/me", { cookie });
      const d = r.json.data as Json | undefined;
      assert("alice.followingCount = 1", d?.followingCount === 1, d);
    }
    {
      const r = await call("DELETE", `/api/users/${bobID}/follow`, { cookie });
      assert("unfollow -> 200", r.status === 200);
    }
    {
      const r = await call("GET", `/api/users/${bobID}`, { cookie });
      const d = r.json.data as Json | undefined;
      assert("after unfollow, count=0", d?.followersCount === 0);
      assert("isFollowing reverts to false", d?.isFollowing === false);
    }
    {
      const r = await call("DELETE", `/api/users/${bobID}/follow`, { cookie });
      assert("repeat unfollow is idempotent", r.status === 200);
    }
    {
      const r = await call("POST", "/api/users/no_such_user/follow", {
        cookie,
      });
      assert("follow unknown -> 404", r.status === 404);
    }
  } finally {
    // ── Cleanup ──────────────────────────────────────────────────────────
    await prisma.follow.deleteMany({
      where: {
        OR: [
          { followerId: alice.id },
          { followingId: alice.id },
          { followerId: bob.id },
          { followingId: bob.id },
        ],
      },
    });
    await prisma.session.deleteMany({ where: { userId: alice.id } });
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
