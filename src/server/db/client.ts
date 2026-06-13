import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Lazily-constructed singleton Prisma client.
//
// Construction is deferred to first use so that merely importing this
// module never touches DATABASE_URL. That matters at build time: Next
// evaluates route modules to read their config, and a client that threw
// at import would fail the build even though no query runs. The env is
// still required for any real query.
//
// The instance is cached on globalThis because Next hot-reload
// re-evaluates modules in development, which would otherwise exhaust
// database connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function getClient(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }
  return client;
}

/**
 * Shared Prisma client. A proxy forwards every access to the real client,
 * constructing it on the first call. Methods are bound so `this` (e.g.
 * for `$transaction`) stays correct.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient();
    const value = client[prop as keyof PrismaClient];
    return typeof value === "function" ? value.bind(client) : value;
  },
});
