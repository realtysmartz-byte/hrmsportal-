import { NextResponse } from "next/server";
import { prisma } from "@realty-smartz/db";
import {
  ensureAutoPunchOut,
  generateDailyAttendanceData,
  syncReportToGoogleSheet,
  getActiveGoogleSheetConfig,
  setLastSyncMetadata,
} from "@realty-smartz/api";
import { startOfDayUTC } from "@realty-smartz/shared";

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

    // If records were auto-punched out, immediately sync the updated day's report to Google Sheets
    if (result.updatedCount > 0) {
      try {
        const config = getActiveGoogleSheetConfig();
        if (config.webhookUrl || config.spreadsheetId) {
          const today = startOfDayUTC(new Date());
          const reportData = await generateDailyAttendanceData(prisma, today);
          const sheetRes = await syncReportToGoogleSheet(config, reportData);
          setLastSyncMetadata({
            date: reportData.dateStr,
            sheetTitle: sheetRes.sheetTitle,
            rowCount: sheetRes.rowCount,
            syncedAt: new Date().toISOString(),
          });
          console.info(`[cron:auto-punch-out] Synced ${result.updatedCount} auto-punched records to Google Sheet "${reportData.dateStr}"`);
        }
      } catch (sheetErr) {
        console.error("[cron:auto-punch-out] Sheet sync error:", sheetErr);
      }
    }

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
