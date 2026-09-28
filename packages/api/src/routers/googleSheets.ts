import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc";
import { canViewTeamAttendance } from "@realty-smartz/shared";
import type { Role } from "@realty-smartz/shared";
import {
  generateDailyAttendanceData,
  syncReportToGoogleSheet,
  type GoogleSheetConfig,
} from "../lib/google-sheets";

// In-memory operational status metadata (never stores credentials or URLs)
let lastSyncMetadata: {
  date: string;
  sheetTitle: string;
  rowCount: number;
  syncedAt: string;
} | null = null;

export function setLastSyncMetadata(meta: typeof lastSyncMetadata) {
  lastSyncMetadata = meta;
}

export function getActiveGoogleSheetConfig(): GoogleSheetConfig {
  return {
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || null,
    serviceAccountEmail: process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL || null,
    privateKey: process.env.GOOGLE_SHEETS_PRIVATE_KEY || null,
    webhookUrl: process.env.GOOGLE_SHEETS_WEBHOOK_URL || null,
  };
}

export const googleSheetsRouter = router({
  getSettings: protectedProcedure.query(async ({ ctx }) => {
    const role = ctx.session.user.role as Role;
    if (!canViewTeamAttendance(role)) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    const config = getActiveGoogleSheetConfig();
    const isConfigured = Boolean(
      (config.spreadsheetId && config.serviceAccountEmail && config.privateKey) ||
        config.webhookUrl
    );

    // Return ONLY high-level operational status — never credentials or URLs
    return {
      isConfigured,
      lastSync: lastSyncMetadata
        ? {
            date: lastSyncMetadata.date,
            sheetTitle: lastSyncMetadata.sheetTitle,
            rowCount: lastSyncMetadata.rowCount,
            syncedAt: lastSyncMetadata.syncedAt,
          }
        : null,
    };
  }),

  syncDailyReport: protectedProcedure
    .input(
      z.object({
        date: z.string().optional(), // YYYY-MM-DD
      })
    )
    .mutation(async ({ ctx, input }) => {
      const role = ctx.session.user.role as Role;
      if (!canViewTeamAttendance(role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Permission denied",
        });
      }

      let targetDate = new Date();
      if (input.date) {
        const parts = input.date.split("-");
        if (parts.length === 3) {
          targetDate = new Date(
            parseInt(parts[0], 10),
            parseInt(parts[1], 10) - 1,
            parseInt(parts[2], 10)
          );
        }
      }

      const config = getActiveGoogleSheetConfig();
      const reportData = await generateDailyAttendanceData(
        ctx.prisma,
        targetDate
      );

      const result = await syncReportToGoogleSheet(config, reportData);

      lastSyncMetadata = {
        date: reportData.dateStr,
        sheetTitle: result.sheetTitle,
        rowCount: result.rowCount,
        syncedAt: new Date().toISOString(),
      };

      return {
        success: true,
        sheetTitle: result.sheetTitle,
        rowCount: result.rowCount,
        formattedDate: reportData.formattedDate,
        date: reportData.dateStr,
      };
    }),

  testConnection: protectedProcedure.mutation(async ({ ctx }) => {
    const role = ctx.session.user.role as Role;
    if (!canViewTeamAttendance(role)) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    const config = getActiveGoogleSheetConfig();
    const today = new Date();
    const reportData = await generateDailyAttendanceData(ctx.prisma, today);

    const result = await syncReportToGoogleSheet(config, reportData);
    return {
      success: true,
      sheetTitle: result.sheetTitle,
      rowCount: result.rowCount,
    };
  }),
});
