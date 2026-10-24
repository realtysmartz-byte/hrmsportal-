import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { hrAdminProcedure, router } from "../trpc";
import {
  autoFetchTelegramChatId,
  getTelegramConfig,
  invalidateTelegramConfigCache,
  sendRawTelegramMessage,
  formatBirthdayTelegramMessage,
  formatWeeklyBirthdayTelegramMessage,
  getWeeklyBirthdayRange,
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
      // Default to active if botToken and chatId are present
      const enabled =
        data.enabled !== undefined
          ? data.enabled
          : Boolean(data.botToken && data.chatId);

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
          enabled,
        },
        update: {
          ...data,
          enabled,
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

      // Automatically save and activate the verified Bot Token and Chat ID
      await ctx.prisma.telegramAutomationConfig.upsert({
        where: { channelType: input.channelType },
        create: {
          channelType: input.channelType,
          name:
            input.channelType === "ATTENDANCE_LEAVE"
              ? "Attendance & Leaves Automation"
              : "HR & Employee Lifecycle Automation",
          botToken: input.botToken.trim(),
          chatId: input.chatId.trim(),
          enabled: true,
          notifyPunchIn: true,
          notifyPunchOut: false,
          notifyLeave: true,
          notifyBirthday: true,
          lastTestSentAt: new Date(),
        },
        update: {
          botToken: input.botToken.trim(),
          chatId: input.chatId.trim(),
          enabled: true,
          lastTestSentAt: new Date(),
        },
      });

      // Immediately invalidate Redis cache so active bot is live everywhere
      await invalidateTelegramConfigCache(input.channelType);

      return { success: true };
    }),

  triggerBirthdayCheck: hrAdminProcedure.mutation(async ({ ctx }) => {
    const config = await ctx.prisma.telegramAutomationConfig.findUnique({
      where: { channelType: "ATTENDANCE_LEAVE" },
    });

    const { weekRangeStr, days } = getWeeklyBirthdayRange();

    const employees = await ctx.prisma.employee.findMany({
      where: {
        status: "ACTIVE",
        dateOfBirth: { not: null },
      },
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        dateOfBirth: true,
        designation: { select: { title: true } },
        department: { select: { name: true } },
      },
    });

    const birthdays = employees
      .flatMap((emp) => {
        if (!emp.dateOfBirth) return [];
        const dob = new Date(emp.dateOfBirth);
        const dobMonth = dob.getMonth() + 1;
        const dobDay = dob.getDate();
        const matchIndex = days.findIndex((d) => d.month === dobMonth && d.day === dobDay);
        if (matchIndex === -1) return [];

        return [
          {
            id: emp.id,
            name: `${emp.firstName} ${emp.lastName}`.trim(),
            employeeCode: emp.employeeCode,
            birthdayDate: days[matchIndex].displayDate,
            designation: emp.designation?.title,
            department: emp.department?.name,
            phone: emp.phone,
            email: emp.email,
            dayIndex: matchIndex,
          },
        ];
      })
      .sort((a, b) => a.dayIndex - b.dayIndex);

    const msg = formatWeeklyBirthdayTelegramMessage({
      weekRangeStr,
      birthdays,
    });

    let delivered = false;
    if (config?.enabled && config?.notifyBirthday && config?.botToken && config?.chatId) {
      const res = await sendRawTelegramMessage(config.botToken, config.chatId, msg);
      delivered = res.ok;
    }

    return {
      count: birthdays.length,
      weekRange: weekRangeStr,
      employees: birthdays,
      delivered,
    };
  }),
});
