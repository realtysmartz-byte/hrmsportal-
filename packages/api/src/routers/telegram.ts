import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { hrAdminProcedure, protectedProcedure, router } from "../trpc";
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
    const orgId = ctx.session.user.organizationId || "org_default_realty";
    const [attendanceLeave, hrLifecycle] = await Promise.all([
      getTelegramConfig(ctx.prisma, "ATTENDANCE_LEAVE", orgId),
      getTelegramConfig(ctx.prisma, "HR_LIFECYCLE", orgId),
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
      const orgId = ctx.session.user.organizationId || "org_default_realty";
      const { channelType, ...data } = input;
      // Default to active if botToken and chatId are present
      const enabled =
        data.enabled !== undefined
          ? data.enabled
          : Boolean(data.botToken && data.chatId);

      const updated = await ctx.prisma.telegramAutomationConfig.upsert({
        where: {
          organizationId_channelType: {
            organizationId: orgId,
            channelType,
          },
        },
        create: {
          organizationId: orgId,
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
      await invalidateTelegramConfigCache(channelType, orgId);
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
      const orgId = ctx.session.user.organizationId || "org_default_realty";
      const channelLabel =
        input.channelType === "ATTENDANCE_LEAVE"
          ? "Attendance & Leaves"
          : "HR & Employee Lifecycle";

      const org = await ctx.prisma.organization.findUnique({
        where: { id: orgId },
        select: { name: true },
      });
      const orgName = org?.name || "HRMS Portal";

      const testMsg = [
        `<b>[AUTOMATION TEST NOTIFICATION]</b>`,
        `----------------------------------------`,
        `<b>Status:</b> Active and Connected`,
        `<b>Channel:</b> ${channelLabel}`,
        `<b>Tested At:</b> ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`,
        ``,
        `Configured automation alerts will be delivered to this group.`,
        ``,
        `<i>${orgName}</i>`,
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
        where: {
          organizationId_channelType: {
            organizationId: orgId,
            channelType: input.channelType,
          },
        },
        create: {
          organizationId: orgId,
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
      await invalidateTelegramConfigCache(input.channelType, orgId);

      return { success: true };
    }),

  triggerBirthdayCheck: hrAdminProcedure.mutation(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId || "org_default_realty";
    const config = await ctx.prisma.telegramAutomationConfig.findUnique({
      where: {
        organizationId_channelType: {
          organizationId: orgId,
          channelType: "ATTENDANCE_LEAVE",
        },
      },
    });

    const { weekRangeStr, days } = getWeeklyBirthdayRange();

    const employees = await ctx.prisma.employee.findMany({
      where: {
        organizationId: orgId,
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

  /**
   * Dispatches an employee support issue ticket directly to Telegram.
   * No database table storage needed.
   */
  sendSupportTicket: protectedProcedure
    .input(
      z.object({
        issueCategory: z.string().min(1, "Please select an issue category"),
        issueDetails: z.string().max(2000).optional(),
        deviceInfo: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId || "org_default_realty";

      // 1. Fetch current employee's information
      const employee = await ctx.prisma.employee.findUnique({
        where: { id: ctx.session.user.id },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeCode: true,
          email: true,
          phone: true,
          companyName: true,
          department: { select: { name: true } },
          designation: { select: { title: true } },
        },
      });

      // 2. Locate active Telegram bot credentials (ATTENDANCE_LEAVE preferred, or any configured bot)
      let config = await ctx.prisma.telegramAutomationConfig.findFirst({
        where: {
          organizationId: orgId,
          channelType: "ATTENDANCE_LEAVE",
          enabled: true,
          NOT: [{ botToken: null }, { botToken: "" }, { chatId: null }, { chatId: "" }],
        },
      });

        if (!config) {
          config = await ctx.prisma.telegramAutomationConfig.findFirst({
            where: {
              enabled: true,
              NOT: [{ botToken: null }, { botToken: "" }, { chatId: null }, { chatId: "" }],
            },
          });
        }

        if (!config) {
          config = await ctx.prisma.telegramAutomationConfig.findFirst({
            where: {
              NOT: [{ botToken: null }, { botToken: "" }, { chatId: null }, { chatId: "" }],
            },
          });
        }

        const botToken = config?.botToken || process.env.TELEGRAM_BOT_TOKEN;
        const chatId = config?.chatId || process.env.TELEGRAM_CHAT_ID;

        if (!botToken || !chatId) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Support channel is currently unavailable. Please contact administration directly.",
          });
        }

        // 3. Format message in clean, readable HTML for Telegram
        const nowIST = new Date().toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });

        const empName = employee
          ? `${employee.firstName} ${employee.lastName || ""}`.trim()
          : ctx.session.user.name || "Employee";
        const empCode = employee?.employeeCode || "N/A";
        const empDept = employee?.department?.name || "N/A";
        const empDesig = employee?.designation?.title || "N/A";
        const empPhone = employee?.phone || "N/A";
        const empEmail = employee?.email || ctx.session.user.email || "N/A";

        const escapeHtml = (str: string) =>
          str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        const safeCategory = escapeHtml(input.issueCategory);
        const safeDetails = input.issueDetails?.trim()
          ? escapeHtml(input.issueDetails.trim())
          : "<i>No additional notes provided</i>";
        const safeDevice = input.deviceInfo ? escapeHtml(input.deviceInfo) : "Web / Mobile App";

        const html = [
          `🚨 <b>HRMS Employee Support Ticket</b>`,
          `━━━━━━━━━━━━━━━━━━━━━━`,
          `👤 <b>Employee:</b> ${escapeHtml(empName)} (<code>${escapeHtml(empCode)}</code>)`,
          `🏢 <b>Department:</b> ${escapeHtml(empDept)}`,
          `💼 <b>Designation:</b> ${escapeHtml(empDesig)}`,
          `📞 <b>Contact:</b> ${escapeHtml(empPhone)} | ✉️ <code>${escapeHtml(empEmail)}</code>`,
          ``,
          `⚠️ <b>Reported Issue:</b>`,
          `👉 <b>${safeCategory}</b>`,
          ``,
          `📝 <b>Notes / Description:</b>`,
          `${safeDetails}`,
          ``,
          `📱 <b>Device Info:</b> <code>${safeDevice}</code>`,
          `🕒 <b>Reported At:</b> ${nowIST} IST`,
          `━━━━━━━━━━━━━━━━━━━━━━`,
        ].join("\n");

        // 4. Send directly to Telegram channel (no database storage)
        const res = await sendRawTelegramMessage(botToken, chatId, html);

        if (!res.ok) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Unable to submit your support request at this moment. Please try again.",
          });
        }

        return {
          success: true,
          chatTitle: config?.chatTitle || "Support Channel",
          sentAt: nowIST,
        };
      }),
});
