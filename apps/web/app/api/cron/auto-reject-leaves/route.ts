import { NextResponse } from "next/server";
import { prisma } from "@realty-smartz/db";
import { autoRejectExpiredLeaves } from "@realty-smartz/api";

export const dynamic = "force-dynamic";

/**
 * Hourly Cron / Webhook Endpoint to Auto-Reject Unapproved Leaves (> 24 Hours)
 * GET /api/cron/auto-reject-leaves
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const count = await autoRejectExpiredLeaves(prisma);

    return NextResponse.json({
      success: true,
      autoRejectedLeaves: count,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[cron:auto-reject-leaves] execution failed:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
