import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { hrAdminProcedure, protectedProcedure, router } from "../trpc";
import { canManageCompanySettings } from "@realty-smartz/shared";
import type { Role } from "@realty-smartz/shared";
import { testSmtpConnection, isSmtpConfigured } from "../lib/email";

export const emailSettingsRouter = router({
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const role = ctx.session.user.role as Role;
    if (!canManageCompanySettings(role)) {
      throw new TRPCError({ code: "FORBIDDEN" });
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
    .mutation(async ({ input }) => {
      return testSmtpConnection(input.targetEmail);
    }),
});
