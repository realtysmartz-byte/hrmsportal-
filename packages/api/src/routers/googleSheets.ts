import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { hrAdminProcedure, protectedProcedure, router } from "../trpc";
import { canManageEmployees, canViewTeamAttendance } from "@realty-smartz/shared";
import type { Role } from "@realty-smartz/shared";
import {
  generateDailyAttendanceData,
  syncReportToGoogleSheet,
  type GoogleSheetConfig,
} from "../lib/google-sheets";

// Runtime override configuration (allows HR/Admin to set credentials via UI or fall back to env)
let runtimeConfig: GoogleSheetConfig = {};
let lastSyncMetadata: {
  date: string;
  sheetTitle: string;
  rowCount: number;
  syncedAt: string;
  spreadsheetUrl: string;
} | null = null;

export function setLastSyncMetadata(meta: typeof lastSyncMetadata) {
  lastSyncMetadata = meta;
}


export function getActiveGoogleSheetConfig(): GoogleSheetConfig {
  return {
    spreadsheetId:
      runtimeConfig.spreadsheetId || process.env.GOOGLE_SHEETS_SPREADSHEET_ID || null,
    serviceAccountEmail:
      runtimeConfig.serviceAccountEmail ||
      process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL ||
      null,
    privateKey:
      runtimeConfig.privateKey || process.env.GOOGLE_SHEETS_PRIVATE_KEY || null,
    webhookUrl:
      runtimeConfig.webhookUrl || process.env.GOOGLE_SHEETS_WEBHOOK_URL || null,
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

    return {
      spreadsheetId: config.spreadsheetId || "",
      serviceAccountEmail: config.serviceAccountEmail || "",
      hasPrivateKey: Boolean(config.privateKey),
      webhookUrl: config.webhookUrl || "",
      isConfigured,
      lastSync: lastSyncMetadata,
      spreadsheetUrl: config.spreadsheetId
        ? `https://docs.google.com/spreadsheets/d/${config.spreadsheetId}`
        : null,
    };
  }),

  saveSettings: protectedProcedure
    .input(
      z.object({
        spreadsheetId: z.string().optional(),
        serviceAccountEmail: z.string().optional(),
        privateKey: z.string().optional(),
        webhookUrl: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const role = ctx.session.user.role as Role;
      if (!canManageEmployees(role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Admin or HR permissions required to update Google Sheets settings",
        });
      }

      runtimeConfig = {
        spreadsheetId: input.spreadsheetId?.trim() || runtimeConfig.spreadsheetId,
        serviceAccountEmail:
          input.serviceAccountEmail?.trim() || runtimeConfig.serviceAccountEmail,
        privateKey: input.privateKey?.trim() || runtimeConfig.privateKey,
        webhookUrl: input.webhookUrl?.trim() || runtimeConfig.webhookUrl,
      };

      return { success: true };
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
        spreadsheetUrl: result.spreadsheetUrl,
      };

      return {
        ...result,
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
    return result;
  }),
});
