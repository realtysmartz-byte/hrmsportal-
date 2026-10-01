import { NextResponse } from "next/server";
import { prisma } from "@realty-smartz/db";
import { ensureAutoPunchOut } from "@realty-smartz/api";


export const dynamic = "force-dynamic";

/**
 * Daily 7:00 PM IST Cron / Webhook Endpoint for Realty Smartz Auto Punch-Out
 * GET /api/cron/auto-punch-out
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // If a secret is defined in environment, enforce it for safety
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await ensureAutoPunchOut(prisma);

    return NextResponse.json({
      success: true,
      message: `Auto punch-out executed successfully at 7:00 PM IST.`,
      updatedRecords: result.updatedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron:auto-punch-out] Error:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
