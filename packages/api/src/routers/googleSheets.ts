import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { PrismaClient } from "@realty-smartz/db";
import { protectedProcedure, router } from "../trpc";
import { canViewTeamAttendance } from "@realty-smartz/shared";
import type { Role } from "@realty-smartz/shared";
import {
  generateDailyAttendanceData,
  syncReportToGoogleSheet,
  type GoogleSheetConfig,
} from "../lib/google-sheets";

// In-memory operational status metadata fallback
let lastSyncMetadata: {
  date: string;
  sheetTitle: string;
  rowCount: number;
  syncedAt: string;
} | null = null;

export function setLastSyncMetadata(meta: typeof lastSyncMetadata) {
  lastSyncMetadata = meta;
}

export async function getActiveGoogleSheetConfig(
  prisma?: PrismaClient,
  organizationId?: string
): Promise<GoogleSheetConfig> {
  const orgId = organizationId || "org_default_realty";

  if (prisma) {
    try {
      const dbConfig = await prisma.googleSheetConfig.findUnique({
        where: { organizationId: orgId },
      });
      if (dbConfig) {
        return {
          spreadsheetId:
            dbConfig.spreadsheetId ||
            (orgId === "org_default_realty" ? process.env.GOOGLE_SHEETS_SPREADSHEET_ID || null : null),
          serviceAccountEmail:
            dbConfig.serviceAccountEmail ||
            (orgId === "org_default_realty" ? process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL || null : null),
          privateKey:
            dbConfig.privateKey ||
            (orgId === "org_default_realty" ? process.env.GOOGLE_SHEETS_PRIVATE_KEY || null : null),
          webhookUrl:
            dbConfig.webhookUrl ||
            (orgId === "org_default_realty" ? process.env.GOOGLE_SHEETS_WEBHOOK_URL || null : null),
        };
      }
    } catch (err) {
      console.error("[getActiveGoogleSheetConfig] DB lookup error:", err);
    }
  }

  // Fallback for default Realty Smartz org
  return {
    spreadsheetId: orgId === "org_default_realty" ? process.env.GOOGLE_SHEETS_SPREADSHEET_ID || null : null,
    serviceAccountEmail: orgId === "org_default_realty" ? process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL || null : null,
    privateKey: orgId === "org_default_realty" ? process.env.GOOGLE_SHEETS_PRIVATE_KEY || null : null,
    webhookUrl: orgId === "org_default_realty" ? process.env.GOOGLE_SHEETS_WEBHOOK_URL || null : null,
  };
}

export const googleSheetsRouter = router({
  getSettings: protectedProcedure.query(async ({ ctx }) => {
    const role = ctx.session.user.role as Role;
    if (!canViewTeamAttendance(role)) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    const orgId = ctx.session.user.organizationId || "org_default_realty";
    const dbConfig = await ctx.prisma.googleSheetConfig.findUnique({
      where: { organizationId: orgId },
    });

    const isEnvConfigured =
      orgId === "org_default_realty" &&
      Boolean(
        (process.env.GOOGLE_SHEETS_SPREADSHEET_ID &&
          process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL &&
          process.env.GOOGLE_SHEETS_PRIVATE_KEY) ||
          process.env.GOOGLE_SHEETS_WEBHOOK_URL
      );

    const isDbConfigured = Boolean(
      (dbConfig?.spreadsheetId && dbConfig?.serviceAccountEmail && dbConfig?.privateKey) ||
        dbConfig?.webhookUrl
    );

    const isConfigured = isDbConfigured || isEnvConfigured;

    return {
      isConfigured,
      source: isDbConfigured ? "DATABASE" : isEnvConfigured ? "ENVIRONMENT" : "NONE",
      spreadsheetId: dbConfig?.spreadsheetId || (orgId === "org_default_realty" ? process.env.GOOGLE_SHEETS_SPREADSHEET_ID || "" : ""),
      serviceAccountEmail: dbConfig?.serviceAccountEmail || (orgId === "org_default_realty" ? process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL || "" : ""),
      hasPrivateKey: Boolean(dbConfig?.privateKey || (orgId === "org_default_realty" && process.env.GOOGLE_SHEETS_PRIVATE_KEY)),
      webhookUrl: dbConfig?.webhookUrl || (orgId === "org_default_realty" ? process.env.GOOGLE_SHEETS_WEBHOOK_URL || "" : ""),
      autoSyncEnabled: dbConfig?.autoSyncEnabled ?? true,
      lastSync: dbConfig?.lastSyncedAt
        ? {
            date: dbConfig.lastSyncedAt.toISOString().slice(0, 10),
            sheetTitle: dbConfig.lastSyncStatus || "Synced",
            rowCount: dbConfig.lastSyncRows || 0,
            syncedAt: dbConfig.lastSyncedAt.toISOString(),
          }
        : (orgId === "org_default_realty" ? lastSyncMetadata : null),
    };
  }),

  saveSettings: protectedProcedure
    .input(
      z.object({
        spreadsheetId: z.string().trim().nullable().optional(),
        serviceAccountEmail: z.string().trim().nullable().optional(),
        privateKey: z.string().trim().nullable().optional(),
        webhookUrl: z.string().trim().nullable().optional(),
        autoSyncEnabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const role = ctx.session.user.role as Role;
      if (role !== "ADMIN" && role !== "HR") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only Admin or HR can update Google Sheets settings",
        });
      }

      const orgId = ctx.session.user.organizationId || "org_default_realty";

      const updateData: Record<string, any> = {};
      if (input.spreadsheetId !== undefined) updateData.spreadsheetId = input.spreadsheetId || null;
      if (input.serviceAccountEmail !== undefined) updateData.serviceAccountEmail = input.serviceAccountEmail || null;
      if (input.privateKey !== undefined && input.privateKey && input.privateKey.trim().length > 0) {
        updateData.privateKey = input.privateKey.trim();
      }
      if (input.webhookUrl !== undefined) updateData.webhookUrl = input.webhookUrl || null;
      if (input.autoSyncEnabled !== undefined) updateData.autoSyncEnabled = input.autoSyncEnabled;

      const saved = await ctx.prisma.googleSheetConfig.upsert({
        where: { organizationId: orgId },
        create: {
          organizationId: orgId,
          spreadsheetId: input.spreadsheetId || null,
          serviceAccountEmail: input.serviceAccountEmail || null,
          privateKey: input.privateKey || null,
          webhookUrl: input.webhookUrl || null,
          autoSyncEnabled: input.autoSyncEnabled ?? true,
        },
        update: updateData,
      });

      return { success: true, saved };
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

      const orgId = ctx.session.user.organizationId || "org_default_realty";

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

      const config = await getActiveGoogleSheetConfig(ctx.prisma, orgId);
      const reportData = await generateDailyAttendanceData(
        ctx.prisma,
        targetDate,
        orgId
      );

      try {
        const result = await syncReportToGoogleSheet(config, reportData);

        lastSyncMetadata = {
          date: reportData.dateStr,
          sheetTitle: result.sheetTitle,
          rowCount: result.rowCount,
          syncedAt: new Date().toISOString(),
        };

        await ctx.prisma.googleSheetConfig.upsert({
          where: { organizationId: orgId },
          create: {
            organizationId: orgId,
            lastSyncedAt: new Date(),
            lastSyncStatus: result.sheetTitle,
            lastSyncRows: result.rowCount,
          },
          update: {
            lastSyncedAt: new Date(),
            lastSyncStatus: result.sheetTitle,
            lastSyncRows: result.rowCount,
          },
        });

        return {
          success: true,
          sheetTitle: result.sheetTitle,
          rowCount: result.rowCount,
          formattedDate: reportData.formattedDate,
          date: reportData.dateStr,
        };
      } catch (err: any) {
        console.error("[googleSheets.syncDailyReport] Sync failed:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err?.message || "Failed to sync attendance data to Google Sheets.",
        });
      }
    }),

  testConnection: protectedProcedure.mutation(async ({ ctx }) => {
    const role = ctx.session.user.role as Role;
    if (!canViewTeamAttendance(role)) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    const orgId = ctx.session.user.organizationId || "org_default_realty";
    const config = await getActiveGoogleSheetConfig(ctx.prisma, orgId);
    const today = new Date();
    const reportData = await generateDailyAttendanceData(ctx.prisma, today, orgId);

    try {
      const result = await syncReportToGoogleSheet(config, reportData);
      return {
        success: true,
        sheetTitle: result.sheetTitle,
        rowCount: result.rowCount,
      };
    } catch (err: any) {
      console.error("[googleSheets.testConnection] Connection failed:", err);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: err?.message || "Failed to connect to Google Sheets.",
      });
    }
  }),
});
