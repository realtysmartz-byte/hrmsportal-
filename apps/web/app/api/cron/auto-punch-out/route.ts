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
 * Daily 7:00 PM IST Cron / Webhook Endpoint for Multi-Tenant Auto Punch-Out
 * GET /api/cron/auto-punch-out
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await ensureAutoPunchOut(prisma);

    // If records were auto-punched out, immediately sync each organization's report to their configured Google Sheet
    if (result.updatedCount > 0) {
      try {
        const orgs = await prisma.organization.findMany({
          where: { isActive: true },
          select: { id: true, name: true },
        });

        for (const org of orgs) {
          try {
            const config = await getActiveGoogleSheetConfig(prisma, org.id);
            if (config.webhookUrl || config.spreadsheetId) {
              const today = startOfDayUTC(new Date());
              const reportData = await generateDailyAttendanceData(prisma, today, org.id);
              if (reportData.rows.length > 0) {
                const sheetRes = await syncReportToGoogleSheet(config, reportData);
                setLastSyncMetadata({
                  date: reportData.dateStr,
                  sheetTitle: sheetRes.sheetTitle,
                  rowCount: sheetRes.rowCount,
                  syncedAt: new Date().toISOString(),
                });
                console.info(
                  `[cron:auto-punch-out] Synced ${sheetRes.rowCount} records for ${org.name} to Google Sheet "${reportData.dateStr}"`
                );
              }
            }
          } catch (orgErr) {
            console.error(`[cron:auto-punch-out] Sheet sync error for ${org.name}:`, orgErr);
          }
        }
      } catch (sheetErr) {
        console.error("[cron:auto-punch-out] Sheet sync error:", sheetErr);
      }
    }

    return NextResponse.json({
      success: true,
      updatedCount: result.updatedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[cron:auto-punch-out] Execution failed:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
