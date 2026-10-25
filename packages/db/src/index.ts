import dns from "node:dns";
import { PrismaClient } from "@prisma/client";

if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Supabase session-mode pooler (port 5432) allows only `pool_size` clients in total,
 * which serverless functions exhaust quickly (EMAXCONNSESSION). Always route runtime
 * queries through the transaction-mode pooler (port 6543) with PgBouncer settings.
 */
function runtimeDatabaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return raw;
  try {
    const url = new URL(raw);
    if (!url.hostname.endsWith("pooler.supabase.com")) return raw;
    url.port = "6543";
    url.searchParams.set("pgbouncer", "true");
    if (!url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", "10");
    if (!url.searchParams.has("pool_timeout")) url.searchParams.set("pool_timeout", "30");
    if (!url.searchParams.has("sslmode")) url.searchParams.set("sslmode", "require");
    return url.toString();
  } catch {
    return raw;
  }
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: runtimeDatabaseUrl() } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

globalForPrisma.prisma = prisma;

export * from "@prisma/client";
export default prisma;
