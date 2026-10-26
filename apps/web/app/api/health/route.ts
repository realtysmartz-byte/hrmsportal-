import { NextResponse } from "next/server";
import { prisma } from "@realty-smartz/db";

export const dynamic = "force-dynamic";

/** GET /api/health → { status, db, timestamp } */
export async function GET() {
  let db = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = true;
  } catch (err) {
    console.error("[health] database check failed:", err);
  }

  return NextResponse.json(
    {
      status: db ? "ok" : "db_error",
      db,
      timestamp: new Date().toISOString(),
    },
    { status: db ? 200 : 503 }
  );
}
