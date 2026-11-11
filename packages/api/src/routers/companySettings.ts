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
          ...input,
        },
        update: {
          ...input,
          organizationId: orgId,
        },
      });

      await invalidatePunchGeofenceCache();
      return settings;
    }),
});
