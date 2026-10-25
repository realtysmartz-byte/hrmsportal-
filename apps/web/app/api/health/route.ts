import { NextResponse } from "next/server";
import { prisma } from "@realty-smartz/db";

export const dynamic = "force-dynamic";

/** GET /api/health → { status, db, timestamp } */
export async function GET() {
  let db = false;
  let q1Ms = -1;
  let q2Ms = -1;
  
  try {
    const t0 = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    q1Ms = Date.now() - t0;

    const t1 = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    q2Ms = Date.now() - t1;

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
      q1Ms,
      q2Ms,
      timestamp: new Date().toISOString(),
    },
    { status: db ? 200 : 503 }
  );
}
