import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { hrAdminProcedure, protectedProcedure, router } from "../trpc";
import { canManageCompanySettings } from "@realty-smartz/shared";
import type { Role } from "@realty-smartz/shared";
import {
  getSmtpConfig,
  setRuntimeSmtpConfig,
  testSmtpConnection,
  isSmtpConfigured,
} from "../lib/email";

export const emailSettingsRouter = router({
  getConfig: protectedProcedure.query(async ({ ctx }) => {
    const role = ctx.session.user.role as Role;
    if (!canManageCompanySettings(role)) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    const cfg = getSmtpConfig();
    return {
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      user: cfg.user,
      from: cfg.from,
      hasPassword: Boolean(cfg.pass),
      isConfigured: isSmtpConfigured(),
      hrNotifyEmail: process.env.HR_NOTIFY_EMAIL || "geetasingh12412@gmail.com",
    };
  }),

  updateConfig: hrAdminProcedure
    .input(
      z.object({
        host: z.string().optional(),
        port: z.number().optional(),
        secure: z.boolean().optional(),
        user: z.string().email().optional(),
        pass: z.string().optional(),
        from: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      setRuntimeSmtpConfig({
        host: input.host,
        port: input.port,
        secure: input.secure,
        user: input.user,
        pass: input.pass,
        from: input.from,
      });

      return {
        success: true,
        message: "SMTP configuration updated successfully",
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
