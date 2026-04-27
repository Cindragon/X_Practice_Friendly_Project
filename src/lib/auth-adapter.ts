import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter } from "next-auth/adapters";
import { prisma } from "@/lib/db";

/**
 * Friendly-flavored Prisma adapter.
 *
 * Per spec, signing in with the same email through different OAuth providers
 * must create independent Users (independent userIDs). Auth.js's default
 * behavior is the opposite: it looks up the user by email and links the new
 * account to the existing User.
 *
 * To force "always a fresh User per (provider, providerAccountId)" we override
 * `getUserByEmail` to return null. Auth.js then falls back to its create-user
 * code path, producing a brand-new User row (with userID still null until the
 * user completes /setup-username).
 */
export function buildAuthAdapter(): Adapter {
  const base = PrismaAdapter(prisma) as Adapter;
  return {
    ...base,
    getUserByEmail: async () => null,
  };
}
