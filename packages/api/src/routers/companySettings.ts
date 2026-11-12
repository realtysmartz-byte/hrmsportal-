import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../trpc";
import {
  updateCompanySettingsSchema,
  canManageCompanySettings,
} from "@realty-smartz/shared";
import type { Role } from "@realty-smartz/shared";
import { invalidatePunchGeofenceCache } from "../lib/work-location";

export const companySettingsRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId || "org_default_realty";

    let settings = await ctx.prisma.companySettings.findFirst({
      where: { organizationId: orgId },
    });

    if (!settings && orgId === "org_default_realty") {
      settings = await ctx.prisma.companySettings.findUnique({
        where: { id: "singleton" },
      });
    }

    return settings;
  }),

  update: protectedProcedure
    .input(updateCompanySettingsSchema)
    .mutation(async ({ ctx, input }) => {
      const role = ctx.session.user.role as Role;
      if (!canManageCompanySettings(role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Admin role required",
        });
      }

      const orgId = ctx.session.user.organizationId || "org_default_realty";

      const existing = await ctx.prisma.companySettings.findFirst({
        where: { organizationId: orgId },
      });

      const targetId = existing?.id || (orgId === "org_default_realty" ? "singleton" : `cs_${orgId}`);

      const settings = await ctx.prisma.companySettings.upsert({
        where: { id: targetId },
        create: {
          id: targetId,
          organizationId: orgId,
          officeName: input.officeName ?? "Realty Smartz Private Limited HQ",
          officeLat: input.officeLat ?? 28.6139,
          officeLng: input.officeLng ?? 77.2090,
          geofenceRadiusM: input.geofenceRadiusM ?? 200,
          weeklyOffDay: input.weeklyOffDay ?? 2,
          lateCheckInTime: input.lateCheckInTime ?? "10:30",
          halfDayCheckInTime: input.halfDayCheckInTime ?? "11:00",
          latesPerHalfDayCut: input.latesPerHalfDayCut ?? 3,
          probationMonths: input.probationMonths ?? 6,
          sandwichRuleEnabled: input.sandwichRuleEnabled ?? true,
        },
        update: {
          organizationId: orgId,
          ...(input.officeName !== undefined ? { officeName: input.officeName } : {}),
          ...(input.officeLat !== undefined ? { officeLat: input.officeLat } : {}),
          ...(input.officeLng !== undefined ? { officeLng: input.officeLng } : {}),
          ...(input.geofenceRadiusM !== undefined ? { geofenceRadiusM: input.geofenceRadiusM } : {}),
          ...(input.weeklyOffDay !== undefined ? { weeklyOffDay: input.weeklyOffDay } : {}),
          ...(input.lateCheckInTime !== undefined ? { lateCheckInTime: input.lateCheckInTime } : {}),
          ...(input.halfDayCheckInTime !== undefined ? { halfDayCheckInTime: input.halfDayCheckInTime } : {}),
          ...(input.latesPerHalfDayCut !== undefined ? { latesPerHalfDayCut: input.latesPerHalfDayCut } : {}),
          ...(input.probationMonths !== undefined ? { probationMonths: input.probationMonths } : {}),
          ...(input.sandwichRuleEnabled !== undefined ? { sandwichRuleEnabled: input.sandwichRuleEnabled } : {}),
        },
      });

      // Synchronize with payroll_settings table so calculation policies stay strictly aligned
      try {
        await ctx.prisma.$executeRawUnsafe(
          `INSERT INTO payroll_settings (
            id, late_after_time, half_day_after_time, lates_per_half_day_cut, weekly_off_day, sandwich_rule_enabled, probation_months, updated_at
          ) VALUES (
            'singleton', $1, $2, $3, $4, $5, $6, NOW()
          ) ON CONFLICT (id) DO UPDATE SET
            late_after_time = EXCLUDED.late_after_time,
            half_day_after_time = EXCLUDED.half_day_after_time,
            lates_per_half_day_cut = EXCLUDED.lates_per_half_day_cut,
            weekly_off_day = EXCLUDED.weekly_off_day,
            sandwich_rule_enabled = EXCLUDED.sandwich_rule_enabled,
            probation_months = EXCLUDED.probation_months,
            updated_at = NOW()`,
          input.lateCheckInTime || settings.lateCheckInTime || "10:30",
          input.halfDayCheckInTime || settings.halfDayCheckInTime || "11:00",
          Number(input.latesPerHalfDayCut ?? settings.latesPerHalfDayCut ?? 3),
          Number(input.weeklyOffDay ?? settings.weeklyOffDay ?? 2),
          Boolean(input.sandwichRuleEnabled ?? settings.sandwichRuleEnabled ?? true),
          Number(input.probationMonths ?? settings.probationMonths ?? 6)
        );
      } catch (err) {
        console.warn("[companySettings] Could not sync payroll_settings:", err);
      }

      await invalidatePunchGeofenceCache();
      return settings;
    }),
});
