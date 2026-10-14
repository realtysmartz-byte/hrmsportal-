import { NextResponse } from "next/server";
import { prisma } from "@realty-smartz/db";
import { sendLocationReminders } from "@/lib/location-reminder";

export const dynamic = "force-dynamic";

/**
 * Every 30 minutes: reminds punched-in employees whose last location is older than 25 minutes
 * to open the app so a fresh GPS fix is recorded.
 * GET /api/cron/location-reminder
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendLocationReminders(prisma);
  if ("error" in result) {
    return NextResponse.json(result, { status: 500 });
  }
  return NextResponse.json({ success: true, ...result });
}

export async function POST(request: Request) {
  return GET(request);
}
