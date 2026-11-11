import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { hrAdminProcedure, protectedProcedure, router } from "../trpc";
import { canManageCompanySettings } from "@realty-smartz/shared";
import type { Role } from "@realty-smartz/shared";
import { testSmtpConnection, isSmtpConfigured } from "../lib/email";

export const emailSettingsRouter = router({
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const role = ctx.session.user.role as Role;
    const isPlatformSuperAdmin =
      role === "ADMIN" &&
      (ctx.session.user.organizationId === "org_default_realty" || !ctx.session.user.organizationId);
    if (!isPlatformSuperAdmin) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Only Platform Super Admin can view Email Service status" });
    }

    // Return ONLY high-level operational status — never SMTP host, user, port, or passwords
    return {
      isConfigured: isSmtpConfigured(),
    };
  }),

  sendTestEmail: hrAdminProcedure
    .input(
      z.object({
        targetEmail: z.string().email(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const isPlatformSuperAdmin =
        ctx.session.user.role === "ADMIN" &&
        (ctx.session.user.organizationId === "org_default_realty" || !ctx.session.user.organizationId);
      if (!isPlatformSuperAdmin) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only Platform Super Admin can test Email Service" });
      }
      return testSmtpConnection(input.targetEmail);
    }),
});
