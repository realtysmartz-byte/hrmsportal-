import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { hrAdminProcedure, router } from "../trpc";
import {
  autoFetchTelegramChatId,
  getTelegramConfig,
  invalidateTelegramConfigCache,
  sendRawTelegramMessage,
  formatBirthdayTelegramMessage,
} from "../lib/telegram";
import { getRedisClient } from "../lib/redis";

const updateConfigSchema = z.object({
  channelType: z.enum(["ATTENDANCE_LEAVE", "HR_LIFECYCLE"]),
  botToken: z.string().nullable().optional(),
  chatId: z.string().nullable().optional(),
  chatTitle: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
  notifyPunchIn: z.boolean().optional(),
  notifyLeave: z.boolean().optional(),
  notifyBirthday: z.boolean().optional(),
  notifyNewJoin: z.boolean().optional(),
  notifyCandidate: z.boolean().optional(),
  notifyResigned: z.boolean().optional(),
  notifyTerminated: z.boolean().optional(),
});

export const telegramRouter = router({
  getConfigs: hrAdminProcedure.query(async ({ ctx }) => {
    const [attendanceLeave, hrLifecycle] = await Promise.all([
      getTelegramConfig(ctx.prisma, "ATTENDANCE_LEAVE"),
      getTelegramConfig(ctx.prisma, "HR_LIFECYCLE"),
    ]);
    const redis = getRedisClient();
    return {
      attendanceLeave,
      hrLifecycle,
      redisConnected: Boolean(redis),
    };
  }),

  updateConfig: hrAdminProcedure
    .input(updateConfigSchema)
    .mutation(async ({ ctx, input }) => {
      const { channelType, ...data } = input;
      const updated = await ctx.prisma.telegramAutomationConfig.upsert({
        where: { channelType },
        create: {
          channelType,
          name:
            channelType === "ATTENDANCE_LEAVE"
              ? "Attendance & Leaves Automation"
              : "HR & Employee Lifecycle Automation",
          notifyPunchOut: false,
          ...data,
        },
        update: {
          ...data,
          notifyPunchOut: false,
        },
      });
      // Invalidate Redis cache to ensure immediate update across all services
      await invalidateTelegramConfigCache(channelType);
      return updated;
    }),

  autoDetectChatId: hrAdminProcedure
    .input(z.object({ botToken: z.string().min(15, "Please enter a valid Telegram Bot Token") }))
    .mutation(async ({ input }) => {
      const res = await autoFetchTelegramChatId(input.botToken.trim());
      if (!res.ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: res.error || "Could not detect group chat ID",
        });
      }
      return {
        chatId: res.chatId!,
        chatTitle: res.chatTitle || "Telegram Group",
        chatType: res.chatType,
      };
    }),

  sendTestMessage: hrAdminProcedure
    .input(
      z.object({
        channelType: z.enum(["ATTENDANCE_LEAVE", "HR_LIFECYCLE"]),
        botToken: z.string().min(15, "Invalid Bot Token"),
        chatId: z.string().min(1, "Invalid Chat ID"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const channelLabel =
        input.channelType === "ATTENDANCE_LEAVE"
          ? "Attendance & Leaves"
          : "HR & Employee Lifecycle";

      const testMsg = [
        `<b>[AUTOMATION TEST NOTIFICATION]</b>`,
        `----------------------------------------`,
        `<b>Status:</b> Active and Connected`,
        `<b>Channel:</b> ${channelLabel}`,
        `<b>Tested At:</b> ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`,
        ``,
        `Configured automation alerts will be delivered to this group.`,
        ``,
        `<i>Realty Smartz Private Limited</i>`,
      ].join("\n");

      const result = await sendRawTelegramMessage(
        input.botToken.trim(),
        input.chatId.trim(),
        testMsg
      );

      if (!result.ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: result.error || "Failed to send test message",
        });
      }

      await ctx.prisma.telegramAutomationConfig.updateMany({
        where: { channelType: input.channelType },
        data: { lastTestSentAt: new Date() },
      });

      return { success: true };
    }),

  triggerBirthdayCheck: hrAdminProcedure.mutation(async ({ ctx }) => {
    const config = await ctx.prisma.telegramAutomationConfig.findUnique({
      where: { channelType: "ATTENDANCE_LEAVE" },
    });

    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();

    const employees = await ctx.prisma.employee.findMany({
      where: {
        status: "ACTIVE",
        dateOfBirth: { not: null },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        designation: { select: { title: true } },
        department: { select: { name: true } },
      },
    });

    const birthdayEmployees = employees.filter((emp) => {
      if (!emp.dateOfBirth) return false;
      const dob = new Date(emp.dateOfBirth);
      return dob.getMonth() + 1 === currentMonth && dob.getDate() === currentDay;
    });

    if (
      config &&
      config.enabled &&
      config.notifyBirthday &&
      config.botToken &&
      config.chatId &&
      birthdayEmployees.length > 0
    ) {
      for (const emp of birthdayEmployees) {
        const msg = formatBirthdayTelegramMessage({
          employeeName: `${emp.firstName} ${emp.lastName}`,
          designation: emp.designation?.title,
          department: emp.department?.name,
        });
        await sendRawTelegramMessage(config.botToken, config.chatId, msg);
      }
    }

    return {
      count: birthdayEmployees.length,
      employees: birthdayEmployees.map((e) => ({
        id: e.id,
        name: `${e.firstName} ${e.lastName}`,
        designation: e.designation?.title,
        department: e.department?.name,
      })),
      delivered: Boolean(
        config?.enabled &&
          config?.notifyBirthday &&
          config?.botToken &&
          config?.chatId &&
          birthdayEmployees.length > 0
      ),
    };
  }),
});
