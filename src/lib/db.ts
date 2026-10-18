import { PrismaClient } from "@prisma/client";

/**
 * Prisma client singleton.
 *
 * Next.js hot-reloads modules during development, which would otherwise create
 * a new connection pool on every reload and exhaust database connections. The
 * instance is cached on `globalThis` outside production so the same client is
 * reused across reloads.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/** True when the underlying database is SQLite (case-insensitive search is limited). */
export const isSqlite = (process.env.DATABASE_URL ?? "").startsWith("file:");
