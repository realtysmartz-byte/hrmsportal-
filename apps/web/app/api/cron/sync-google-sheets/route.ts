import { NextResponse } from "next/server";
import { prisma } from "@realty-smartz/db";
import {
  generateDailyAttendanceData,
  syncReportToGoogleSheet,
  getActiveGoogleSheetConfig,
  setLastSyncMetadata,
} from "@realty-smartz/api";

export const dynamic = "force-dynamic";

/**
 * Daily Automated Sync Endpoint for Google Sheets
 * - Automatically invoked once a day (e.g. 11:59 PM or end-of-shift)
 * - Creates a new tab named YYYY-MM-DD for the date if not exists
 * - Populates the entire attendance report into that tab
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const authHeader = req.headers.get("authorization");
    const secret = searchParams.get("secret");

    // Optional Cron Secret verification if configured
    if (process.env.CRON_SECRET) {
      const token = authHeader?.replace("Bearer ", "") || secret;
      if (token !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    // Date to sync (defaults to today)
    const customDate = searchParams.get("date");
    let targetDate = new Date();
    if (customDate) {
      const parts = customDate.split("-");
      if (parts.length === 3) {
        targetDate = new Date(
          parseInt(parts[0], 10),
          parseInt(parts[1], 10) - 1,
          parseInt(parts[2], 10)
        );
      }
    }

    const config = getActiveGoogleSheetConfig();
    const reportData = await generateDailyAttendanceData(prisma, targetDate);
    const result = await syncReportToGoogleSheet(config, reportData);

    setLastSyncMetadata({
      date: reportData.dateStr,
      sheetTitle: result.sheetTitle,
      rowCount: result.rowCount,
      syncedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: `Daily report synced to tab "${result.sheetTitle}"`,
      sheetTitle: result.sheetTitle,
      rowCount: result.rowCount,
    });
  } catch (error: any) {
    console.error("[cron/sync-google-sheets] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Internal server error while syncing to Google Sheet",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  return GET(req);
}
