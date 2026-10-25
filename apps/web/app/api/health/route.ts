import { NextResponse } from "next/server";
import { prisma } from "@realty-smartz/db";

export const dynamic = "force-dynamic";

/** GET /api/health → { status, db, timestamp } */
export async function GET() {
  let db = false;
  let queryMs = -1;
  const t0 = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    queryMs = Date.now() - t0;
    db = true;
  } catch (err) {
    console.error("[health] database check failed:", err);
  }

  let dbHost = "not_set";
  try {
    const raw = process.env.DATABASE_URL;
    if (raw) {
      const u = new URL(raw);
      dbHost = `${u.hostname}:${u.port || "default"}`;
    }
  } catch {}

  return NextResponse.json(
    {
      status: db ? "ok" : "db_error",
      db,
      dbHost,
      queryMs,
      timestamp: new Date().toISOString(),
    },
    { status: db ? 200 : 503 }
  );
}
