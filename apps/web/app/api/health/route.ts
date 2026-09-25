import { NextResponse } from "next/server";
import { prisma } from "@realty-smartz/db";

/**
 * Lightweight health-check endpoint for diagnosing deployment issues.
 * GET /api/health → { status, db, env, timestamp }
 * Remove or protect this endpoint after debugging is complete.
 */
export async function GET() {
  const checks: Record<string, unknown> = {
    status: "ok",
    timestamp: new Date().toISOString(),
    env: {
      DATABASE_URL: process.env.DATABASE_URL ? "SET" : "MISSING",
      NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? "NOT SET",
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? `SET (${process.env.NEXTAUTH_SECRET.length} chars)` : "MISSING",
      VERCEL_URL: process.env.VERCEL_URL ?? "NOT SET",
      VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL ?? "NOT SET",
      NODE_ENV: process.env.NODE_ENV,
    },
  };

  // Test database connectivity
  try {
    const count = await prisma.employee.count();
    checks.db = { connected: true, employeeCount: count };
  } catch (err) {
    checks.status = "db_error";
    checks.db = {
      connected: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const statusCode = checks.status === "ok" ? 200 : 503;
  return NextResponse.json(checks, { status: statusCode });
}
