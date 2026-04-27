import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { buildAuthAdapter } from "@/lib/auth-adapter";
import { prisma } from "@/lib/db";

/**
 * Full Auth.js setup with database session strategy.
 *
 * The adapter and Prisma access live here (not in auth.config.ts) because
 * Prisma can't run on the edge runtime that Next.js middleware uses.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: buildAuthAdapter(),
  session: { strategy: "database" },
  callbacks: {
    ...authConfig.callbacks,
    /**
     * On every session read, hydrate the userID from the DB so the client
     * always knows whether the setup-username step is complete.
     */
    async session({ session, user }) {
      if (session.user && user?.id) {
        session.user.id = user.id;
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { userID: true },
        });
        session.user.userID = dbUser?.userID ?? null;
      }
      return session;
    },
  },
});
