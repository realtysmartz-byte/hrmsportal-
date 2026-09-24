import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../trpc";
import {
  updateCompanySettingsSchema,
  canManageCompanySettings,
} from "@realty-smartz/shared";
import type { Role } from "@realty-smartz/shared";

export const companySettingsRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.companySettings.findUnique({
      where: { id: "singleton" },
    });
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

      return ctx.prisma.companySettings.upsert({
        where: { id: "singleton" },
        create: {
          id: "singleton",
          ...input,
        },
        update: input,
      });
    }),
});
