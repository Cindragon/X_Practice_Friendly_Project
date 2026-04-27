/**
 * One-shot health check for both databases.
 *
 * Run with: `yarn tsx scripts/verify-db.ts`
 */
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { connectMongo } from "../src/lib/mongo";
import { Post } from "../src/models/Post";
import { Draft } from "../src/models/Draft";

async function main() {
  // ── Postgres ────────────────────────────────────────────────────────────
  const userCount = await prisma.user.count();
  const followCount = await prisma.follow.count();
  const likeCount = await prisma.like.count();
  console.log("[postgres] OK", { userCount, followCount, likeCount });

  // ── MongoDB ─────────────────────────────────────────────────────────────
  const mongoConn = await connectMongo();
  const postCount = await Post.countDocuments();
  const draftCount = await Draft.countDocuments();
  console.log("[mongodb] OK", {
    db: mongoConn.connection.name,
    postCount,
    draftCount,
  });

  await prisma.$disconnect();
  await mongoConn.disconnect();
}

main().catch((err) => {
  console.error("[verify-db] FAILED", err);
  process.exit(1);
});
