import { PrismaClient } from "@prisma/client";

/**
 * Prisma client singleton.
 * In dev, Next.js HMR re-imports this file on every change — without caching
 * the client on `globalThis`, we'd leak connections.
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
