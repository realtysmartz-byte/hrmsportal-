import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  applyLeaveSchema,
  respondLeaveSchema,
  createLeaveTypeSchema,
  updateLeaveTypeSchema,
  countWeekdays,
  listWeekdayDates,
  startOfDayUTC,
  canApproveLeave,
  getISTDateParts,
} from "@realty-smartz/shared";
import type { Role } from "@realty-smartz/shared";
import { hrAdminProcedure, protectedProcedure, router } from "../trpc";
import { assertCanViewSensitive } from "../lib/employee-access";
import { sendEmployeePushNotification } from "../lib/push-notify";

/**
 * Automatically rejects any leave request that has been pending for more than 24 hours.
 * Sends clean corporate email and push notification to the applicant.
 */
export async function autoRejectExpiredLeaves(prisma: any): Promise<number> {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    const expired = await prisma.leaveRequest.findMany({
      where: {
        status: "PENDING",
        appliedAt: { lte: cutoff },
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            manager: { select: { email: true } },
          },
        },
        leaveType: true,
      },
    });

    if (!expired || expired.length === 0) return 0;

    for (const req of expired) {
      try {
        await prisma.leaveRequest.update({
          where: { id: req.id },
          data: {
            status: "REJECTED",
            managerStatus: req.managerStatus === "PENDING" ? "REJECTED" : req.managerStatus,
            approverNote: "Auto-rejected: Request was not approved within 24 hours.",
            respondedAt: new Date(),
          },
        });

        // 1. Send clean corporate email notification to employee (BCC staff)
        try {
          const { notifyLeaveAutoRejected } = await import("../lib/email");
          await notifyLeaveAutoRejected({
            employeeName: `${req.employee.firstName} ${req.employee.lastName}`,
            employeeEmail: req.employee.email,
            leaveType: req.leaveType.name,
            startDate: req.startDate.toISOString().slice(0, 10),
            endDate: req.endDate.toISOString().slice(0, 10),
            days: req.numberOfDays,
            reason: req.reason,
            managerEmail: req.employee.manager?.email,
          });
        } catch (mailErr) {
          console.error("[leave:autoReject] email error for req", req.id, mailErr);
        }

        // 2. Send push notification to employee
        try {
          await sendEmployeePushNotification({
            prisma,
            employeeId: req.employee.id,
            title: "Leave Auto-Rejected (24h Expiry)",
            body: `Your leave request for ${req.numberOfDays}d (${req.leaveType.name}) was automatically rejected as it was not approved within 24 hours.`,
            url: "/employee-portal/leave",
            type: "leave",
          });
        } catch (pushErr) {
          console.error("[leave:autoReject] push error for req", req.id, pushErr);
        }
      } catch (itemErr) {
        console.error("[leave:autoReject] failed processing req", req.id, itemErr);
      }
    }

    return expired.length;
  } catch (err) {
    console.error("[leave:autoReject] error:", err);
    return 0;
  }
}

export const leaveRouter = router({
  types: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId || "org_default_realty";
    return ctx.prisma.leaveType.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
    });
  }),

  createType: hrAdminProcedure
    .input(createLeaveTypeSchema)
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId || "org_default_realty";
      const existing = await ctx.prisma.leaveType.findFirst({
        where: { name: input.name, organizationId: orgId },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Leave type already exists in this company",
        });
      }

      const leaveType = await ctx.prisma.leaveType.create({
        data: {
          ...input,
          organizationId: orgId,
        },
      });

      const year = new Date().getFullYear();
      const employees = await ctx.prisma.employee.findMany({
        where: { organizationId: orgId, status: { in: ["ACTIVE", "ON_LEAVE"] } },
        select: { id: true, email: true },
      });

      if (employees.length > 0) {
        await ctx.prisma.leaveBalance.createMany({
          data: employees.map((e) => ({
            employeeId: e.id,
            leaveTypeId: leaveType.id,
            year,
            allotted: leaveType.annualQuota,
            used: 0,
            remaining: leaveType.annualQuota,
          })),
          skipDuplicates: true,
        });
      }

      void (async () => {
        try {
          const { notifyPolicyUpdate, getStaffNotifyEmails } = await import("../lib/email");
          const emails: string[] = employees.map((e) => e.email);
          emails.push(...getStaffNotifyEmails());
          await notifyPolicyUpdate({
            title: `New leave type: ${leaveType.name}`,
            summary: `Annual quota: ${leaveType.annualQuota} days. Approval required: ${leaveType.requiresApproval ? "Yes" : "No"}. Carry forward: ${leaveType.carryForwardAllowed ? "Allowed" : "Not allowed"}.`,
            recipientEmails: Array.from(new Set(emails)),
          });
        } catch (err) {
          console.error("[leave] policy email failed:", err);
        }
      })();

      return leaveType;
    }),

  updateType: hrAdminProcedure
    .input(updateLeaveTypeSchema)
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId || "org_default_realty";
      const { id, ...data } = input;
      const existing = await ctx.prisma.leaveType.findFirst({
        where: { id, organizationId: orgId },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return ctx.prisma.leaveType.update({ where: { id }, data });
    }),

  deleteType: hrAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId || "org_default_realty";
      const existing = await ctx.prisma.leaveType.findFirst({
        where: { id: input.id, organizationId: orgId },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const pending = await ctx.prisma.leaveRequest.count({
        where: { leaveTypeId: input.id, status: "PENDING" },
      });
      if (pending > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete leave type with pending requests",
        });
      }
      await ctx.prisma.leaveBalance.deleteMany({
        where: { leaveTypeId: input.id },
      });
      await ctx.prisma.leaveType.delete({ where: { id: input.id } });
      return { success: true };
    }),

  myBalances: protectedProcedure.query(async ({ ctx }) => {
    const year = new Date().getFullYear();
    return ctx.prisma.leaveBalance.findMany({
      where: { employeeId: ctx.session.user.id, year },
      include: { leaveType: true },
      orderBy: { leaveType: { name: "asc" } },
    });
  }),

  myProbationStatus: protectedProcedure.query(async ({ ctx }) => {
    const employee = await ctx.prisma.employee.findUnique({
      where: { id: ctx.session.user.id },
      select: { id: true, dateOfJoining: true, organizationId: true },
    });
    const settings = employee?.organizationId
      ? await ctx.prisma.companySettings.findFirst({ where: { organizationId: employee.organizationId } })
      : null;

    const probationMonths = settings?.probationMonths ?? 6;
    const sandwichRuleEnabled = settings?.sandwichRuleEnabled ?? true;
    let isUnderProbation = false;
    let probationEndDate: Date | null = null;

    if (employee?.dateOfJoining) {
      const joiningDate = new Date(employee.dateOfJoining);
      probationEndDate = new Date(joiningDate);
      probationEndDate.setMonth(probationEndDate.getMonth() + probationMonths);
      isUnderProbation = new Date() < probationEndDate;
    }

    return {
      isUnderProbation,
      probationMonths,
      probationEndDate,
      sandwichRuleEnabled,
      lateCheckInTime: settings?.lateCheckInTime ?? "10:30",
      halfDayCheckInTime: settings?.halfDayCheckInTime ?? "11:00",
      latesPerHalfDayCut: settings?.latesPerHalfDayCut ?? 3,
    };
  }),

  myRequests: protectedProcedure.query(async ({ ctx }) => {
    await autoRejectExpiredLeaves(ctx.prisma);
    return ctx.prisma.leaveRequest.findMany({
      where: { employeeId: ctx.session.user.id },
      include: {
        leaveType: true,
        approvedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        manager: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { appliedAt: "desc" },
    });
  }),

  apply: protectedProcedure
    .input(applyLeaveSchema)
    .mutation(async ({ ctx, input }) => {
      await autoRejectExpiredLeaves(ctx.prisma);
      const leaveType = await ctx.prisma.leaveType.findUnique({
        where: { id: input.leaveTypeId },
      });
      if (!leaveType) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Leave type not found" });
      }

      const startDate = startOfDayUTC(input.startDate);
      const endDate = startOfDayUTC(input.endDate);
      const istNow = getISTDateParts(new Date());
      const todayIST = new Date(Date.UTC(istNow.year, istNow.month - 1, istNow.day));
      if (startDate.getTime() < todayIST.getTime() || endDate.getTime() < todayIST.getTime()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Leave can only be applied for today or upcoming dates.",
        });
      }
      if (input.isHalfDay && startDate.getTime() !== endDate.getTime()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Half day can only be applied for a single date",
        });
      }
      const weekdays = countWeekdays(startDate, endDate);
      const numberOfDays = input.isHalfDay && weekdays > 0 ? 0.5 : weekdays;

      if (numberOfDays <= 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Selected range has no working days",
        });
      }

      const year = startDate.getUTCFullYear();

      // Prefer live employee id with organization and joining date
      const actor =
        (await ctx.prisma.employee.findUnique({
          where: { id: ctx.session.user.id },
          select: { id: true, dateOfJoining: true, organizationId: true },
        })) ??
        (await ctx.prisma.employee.findUnique({
          where: { email: ctx.session.user.email.toLowerCase() },
          select: { id: true, dateOfJoining: true, organizationId: true },
        }));

      if (!actor) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message:
            "Your session is out of date. Sign out and sign in again, then retry.",
        });
      }

      // Company settings for probation and sandwich rules
      const companySettings = actor?.organizationId
        ? await ctx.prisma.companySettings.findFirst({ where: { organizationId: actor.organizationId } })
        : null;

      const probationMonths = companySettings?.probationMonths ?? 6;
      const sandwichRuleEnabled = companySettings?.sandwichRuleEnabled ?? true;

      // 1. Enforce probation rule: New employees (<= probationMonths) have 0 paid leaves and can only apply for Unpaid Leave
      let isUnderProbation = false;
      let probationEndDate: Date | null = null;
      if (actor?.dateOfJoining) {
        const joiningDate = new Date(actor.dateOfJoining);
        probationEndDate = new Date(joiningDate);
        probationEndDate.setMonth(probationEndDate.getMonth() + probationMonths);
        if (new Date() < probationEndDate) {
          isUnderProbation = true;
        }
      }

      const isUnpaidType =
        leaveType.annualQuota === 0 ||
        leaveType.name.toLowerCase().includes("unpaid") ||
        leaveType.name.toLowerCase().includes("loss of pay") ||
        leaveType.name.toLowerCase().includes("lop");

      if (isUnderProbation && !isUnpaidType) {
        const formattedDate = probationEndDate
          ? probationEndDate.toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          : `${probationMonths} months after joining`;
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `You are currently on your ${probationMonths}-month probation period (until ${formattedDate}). During probation, paid leaves cannot be applied. Please apply for Unpaid Leave (Loss of Pay).`,
        });
      }

      // 2. Enforce sandwich rule: If enabled, Tuesday weekly off days spanned or connected to leaves are counted as leave days
      let sandwichDays = 0;
      let sandwichNote = "";

      if (sandwichRuleEnabled && !input.isHalfDay) {
        // Range check: if range spans Tuesday weekly off (day 2)
        const cur = new Date(startDate);
        let hasWorkingDayBefore = false;
        let offDaysInSpan = 0;
        while (cur <= endDate) {
          const d = cur.getUTCDay();
          // Tuesday is weekly off (2); Saturday (6) and Sunday (0) are working days
          if (d !== 2) {
            if (offDaysInSpan > 0) {
              sandwichDays += offDaysInSpan;
              offDaysInSpan = 0;
            }
            hasWorkingDayBefore = true;
          } else {
            if (hasWorkingDayBefore) {
              offDaysInSpan++;
            }
          }
          cur.setUTCDate(cur.getUTCDate() + 1);
        }

        // Check if starts on Wednesday (day 3) and preceding Monday (day 1) was on leave
        if (startDate.getUTCDay() === 3) {
          const prevMonday = new Date(startDate);
          prevMonday.setUTCDate(prevMonday.getUTCDate() - 2);
          const hasPrevMondayLeave = await ctx.prisma.leaveRequest.findFirst({
            where: {
              employeeId: actor.id,
              status: { in: ["APPROVED", "PENDING"] },
              startDate: { lte: prevMonday },
              endDate: { gte: prevMonday },
            },
          });
          if (hasPrevMondayLeave) {
            sandwichDays += 1;
            sandwichNote += " [Sandwich Rule: Tuesday weekly off added due to leave on preceding Monday]";
          }
        }

        // Check if ends on Monday (day 1) and following Wednesday (day 3) is on leave
        if (endDate.getUTCDay() === 1) {
          const nextWednesday = new Date(endDate);
          nextWednesday.setUTCDate(nextWednesday.getUTCDate() + 2);
          const hasNextWednesdayLeave = await ctx.prisma.leaveRequest.findFirst({
            where: {
              employeeId: actor.id,
              status: { in: ["APPROVED", "PENDING"] },
              startDate: { lte: nextWednesday },
              endDate: { gte: nextWednesday },
            },
          });
          if (hasNextWednesdayLeave) {
            sandwichDays += 1;
            sandwichNote += " [Sandwich Rule: Tuesday weekly off added due to leave on following Wednesday]";
          }
        }
      }

      const totalLeaveDays = numberOfDays + sandwichDays;

      const balance = await ctx.prisma.leaveBalance.findUnique({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId: actor.id,
            leaveTypeId: input.leaveTypeId,
            year,
          },
        },
      });

      const exceedsBalance = !balance || balance.remaining < totalLeaveDays;

      const empDetails = await ctx.prisma.employee.findUnique({
        where: { id: actor.id },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          managerId: true,
          organizationId: true,
        },
      });

      const hasManager = Boolean(empDetails?.managerId);
      const managerStatus = hasManager ? "PENDING" : "NOT_REQUIRED";

      const created = await ctx.prisma.leaveRequest.create({
        data: {
          employeeId: actor.id,
          leaveTypeId: input.leaveTypeId,
          startDate,
          endDate,
          numberOfDays: totalLeaveDays,
          isHalfDay: input.isHalfDay,
          halfDaySlot: input.isHalfDay ? (input.halfDaySlot ?? "FIRST_HALF") : null,
          reason:
            exceedsBalance
              ? `${input.reason}${sandwichNote}\n\n[Note: Request exceeds available balance]`
              : `${input.reason}${sandwichNote}`,
          status: leaveType.requiresApproval ? "PENDING" : "APPROVED",
          managerStatus: leaveType.requiresApproval ? managerStatus : "NOT_REQUIRED",
          ...(leaveType.requiresApproval
            ? {}
            : {
                approvedById: actor.id,
                respondedAt: new Date(),
              }),
        },
        include: { leaveType: true },
      });

      void (async () => {
        try {
          const { notifyLeaveApplied } = await import("../lib/email");
          const emp = await ctx.prisma.employee.findUnique({
            where: { id: actor.id },
            select: {
              email: true,
              firstName: true,
              lastName: true,
              manager: { select: { email: true } },
            },
          });
          if (!emp) return;
          await notifyLeaveApplied({
            employeeName: `${emp.firstName} ${emp.lastName}`,
            employeeEmail: emp.email,
            leaveType: leaveType.name,
            startDate: startDate.toISOString().slice(0, 10),
            endDate: endDate.toISOString().slice(0, 10),
            days: numberOfDays,
            reason: input.reason,
            status: created.status,
            managerEmail: emp.manager?.email,
          });

          // Telegram Alert
          const { formatLeaveTelegramMessage, sendTelegramNotification } = await import(
            "../lib/telegram"
          );
          const telegramMsg = formatLeaveTelegramMessage({
            employeeName: `${emp.firstName} ${emp.lastName}`,
            leaveType: leaveType.name,
            startDate: startDate.toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              timeZone: "Asia/Kolkata",
            }),
            endDate: endDate.toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              timeZone: "Asia/Kolkata",
            }),
            days: numberOfDays,
            reason: input.reason,
            status: created.status,
          });
          await sendTelegramNotification(
            ctx.prisma,
            "ATTENDANCE_LEAVE",
            "notifyLeave",
            telegramMsg
          );

          // Push Notifications to Manager and Applicant (avoid self-duplicate)
          if (hasManager && empDetails?.managerId && empDetails.managerId !== actor.id) {
            void sendEmployeePushNotification({
              prisma: ctx.prisma,
              employeeId: empDetails.managerId,
              title: "Leave Approval Required",
              body: `${emp.firstName} ${emp.lastName} applied for ${numberOfDays}d ${leaveType.name}. Action required.`,
              url: "/employee-portal/leave/approvals",
              type: "leave",
            });
          }
          void sendEmployeePushNotification({
            prisma: ctx.prisma,
            employeeId: actor.id,
            title: "Leave Application Submitted",
            body: hasManager
              ? `Your ${numberOfDays}d leave application has been submitted to your manager.`
              : `Your ${numberOfDays}d leave application has been submitted to HR.`,
            url: "/employee-portal/leave",
            type: "leave",
          });
        } catch (err) {
          console.error("[leave] apply alert failed:", err);
        }
      })();

      return created;
    }),

  cancel: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const req = await ctx.prisma.leaveRequest.findUnique({
        where: { id: input.id },
      });
      if (!req || req.employeeId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (req.status !== "PENDING") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only pending requests can be cancelled",
        });
      }
      const updated = await ctx.prisma.leaveRequest.update({
        where: { id: input.id },
        data: { status: "CANCELLED", respondedAt: new Date() },
        include: { leaveType: true },
      });

      void (async () => {
        try {
          const { notifyLeaveCancelled } = await import("../lib/email");
          const emp = await ctx.prisma.employee.findUnique({
            where: { id: ctx.session.user.id },
            select: { email: true, firstName: true, lastName: true },
          });
          if (!emp) return;
          await notifyLeaveCancelled({
            employeeName: `${emp.firstName} ${emp.lastName}`,
            employeeEmail: emp.email,
            leaveType: updated.leaveType.name,
            startDate: updated.startDate.toISOString().slice(0, 10),
            endDate: updated.endDate.toISOString().slice(0, 10),
            days: updated.numberOfDays,
          });
        } catch (err) {
          console.error("[leave] cancel email failed:", err);
        }
      })();

      return updated;
    }),

  listApprovals: protectedProcedure
    .input(
      z
        .object({
          status: z
            .enum(["PENDING", "APPROVED", "REJECTED", "ALL"])
            .optional()
            .default("PENDING"),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      await autoRejectExpiredLeaves(ctx.prisma);
      const approver = await ctx.prisma.employee.findUnique({
        where: { id: ctx.session.user.id },
        select: { id: true, role: true, directReports: { select: { id: true } } },
      });
      const isManager = approver && (approver.role === "MANAGER" || approver.directReports.length > 0);
      const isHRorAdmin = approver?.role === "ADMIN" || approver?.role === "HR";

      if (!isManager && !isHRorAdmin) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied to leave approvals." });
      }

      const statusFilter = input?.status ?? "PENDING";
      const where: Record<string, unknown> = {};
      if (statusFilter !== "ALL") {
        where.status = statusFilter;
      }
      const orgId = ctx.session.user.organizationId || "org_default_realty";

      if (isManager && !isHRorAdmin) {
        where.employee = {
          organizationId: orgId,
          managerId: approver.id,
        };
      } else {
        where.employee = { organizationId: orgId };
      }

      return ctx.prisma.leaveRequest.findMany({
        where,
        include: {
          leaveType: true,
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeCode: true,
              profilePhotoUrl: true,
              department: { select: { name: true } },
              manager: { select: { id: true, firstName: true, lastName: true } },
            },
          },
          approvedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          manager: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { appliedAt: "desc" },
      });
    }),

  pendingApprovals: protectedProcedure.query(async ({ ctx }) => {
    await autoRejectExpiredLeaves(ctx.prisma);
    const approver = await ctx.prisma.employee.findUnique({
      where: { id: ctx.session.user.id },
      select: { id: true, role: true, directReports: { select: { id: true } } },
    });
    const isManager = approver && (approver.role === "MANAGER" || approver.directReports.length > 0);
    const isHRorAdmin = approver?.role === "ADMIN" || approver?.role === "HR";

    if (!isManager && !isHRorAdmin) {
      return [];
    }

    const orgId = ctx.session.user.organizationId || "org_default_realty";

    if (isManager && !isHRorAdmin) {
      return ctx.prisma.leaveRequest.findMany({
        where: {
          status: "PENDING",
          managerStatus: "PENDING",
          employee: {
            organizationId: orgId,
            managerId: approver.id,
          },
        },
        include: {
          leaveType: true,
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeCode: true,
              profilePhotoUrl: true,
              department: { select: { name: true } },
            },
          },
        },
        orderBy: { appliedAt: "asc" },
      });
    }

    return ctx.prisma.leaveRequest.findMany({
      where: {
        status: "PENDING",
        employee: { organizationId: orgId },
      },
      include: {
        leaveType: true,
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            profilePhotoUrl: true,
            department: { select: { name: true } },
            manager: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        manager: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { appliedAt: "asc" },
    });
  }),

  myTeamPendingCount: protectedProcedure.query(async ({ ctx }) => {
    await autoRejectExpiredLeaves(ctx.prisma);
    const approver = await ctx.prisma.employee.findUnique({
      where: { id: ctx.session.user.id },
      select: { id: true, role: true, directReports: { select: { id: true } } },
    });
    if (!approver || (approver.role !== "MANAGER" && approver.directReports.length === 0)) {
      return 0;
    }
    return ctx.prisma.leaveRequest.count({
      where: {
        status: "PENDING",
        managerStatus: "PENDING",
        employee: { managerId: approver.id },
      },
    });
  }),

  respond: protectedProcedure
    .input(respondLeaveSchema)
    .mutation(async ({ ctx, input }) => {
      await autoRejectExpiredLeaves(ctx.prisma);
      const role = ctx.session.user.role as Role;
      const approver =
        (await ctx.prisma.employee.findUnique({
          where: { id: ctx.session.user.id },
          select: { id: true, firstName: true, lastName: true, role: true, directReports: { select: { id: true } } },
        })) ??
        (ctx.session.user.email
          ? await ctx.prisma.employee.findUnique({
              where: { email: ctx.session.user.email.toLowerCase() },
              select: { id: true, firstName: true, lastName: true, role: true, directReports: { select: { id: true } } },
            })
          : null);

      if (!approver) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message:
            "Your session is out of date. Sign out and sign in again, then retry.",
        });
      }

      const isManager = approver.role === "MANAGER" || approver.directReports.length > 0;
      const isHRorAdmin = approver.role === "ADMIN" || approver.role === "HR" || role === "ADMIN" || role === "HR";

      if (!isManager && !isHRorAdmin) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You are not authorized to approve leave requests." });
      }

      const req = await ctx.prisma.leaveRequest.findUnique({
        where: { id: input.id },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              managerId: true,
              organizationId: true,
            },
          },
          leaveType: true,
        },
      });
      if (!req) throw new TRPCError({ code: "NOT_FOUND" });

      const isDirectManager = req.employee.managerId === approver.id;

      if (!isDirectManager && !isHRorAdmin) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only approve leave requests for your direct reports." });
      }

      // Case 1: Direct Manager Responding (Stage 1 Approval)
      if (isDirectManager && !isHRorAdmin) {
        if (input.action === "APPROVE") {
          const updated = await ctx.prisma.leaveRequest.update({
            where: { id: input.id },
            data: {
              managerStatus: "APPROVED",
              managerId: approver.id,
              managerNote: input.approverNote || null,
              managerRespondedAt: new Date(),
            },
            include: { leaveType: true, employee: true },
          });

          // Send corporate email to employee (BCC staff)
          void (async () => {
            try {
              const { notifyLeaveManagerApproval } = await import("../lib/email");
              await notifyLeaveManagerApproval({
                employeeName: `${req.employee.firstName} ${req.employee.lastName}`,
                employeeEmail: req.employee.email,
                managerName: `${approver.firstName} ${approver.lastName}`,
                managerNote: input.approverNote,
                leaveType: req.leaveType.name,
                startDate: req.startDate.toISOString().slice(0, 10),
                endDate: req.endDate.toISOString().slice(0, 10),
                days: req.numberOfDays,
              });
            } catch (err) {
              console.error("[leave] manager approval email failed:", err);
            }
          })();

          // Push to employee
          void sendEmployeePushNotification({
            prisma: ctx.prisma,
            employeeId: req.employeeId,
            title: "Leave Approved by Manager",
            body: `Your leave has been approved by ${approver.firstName} ${approver.lastName} and forwarded to HR for final authorization.`,
            url: "/employee-portal/leave",
            type: "leave",
          });

          // Push to HR / Admin team
          const hrAdmins = await ctx.prisma.employee.findMany({
            where: {
              organizationId: req.employee.organizationId || "org_default_realty",
              role: { in: ["ADMIN", "HR"] },
              status: { in: ["ACTIVE", "ON_LEAVE"] },
            },
            select: { id: true },
          });
          if (hrAdmins.length > 0) {
            void sendEmployeePushNotification({
              prisma: ctx.prisma,
              employeeId: hrAdmins.map((h) => h.id),
              title: "Leave Ready for HR Sign-off",
              body: `${req.employee.firstName} ${req.employee.lastName}'s leave was approved by manager. Final HR approval pending.`,
              url: "/admin-portal/leave/approvals",
              type: "leave",
            });
          }

          return updated;
        } else if (input.action === "REJECT") {
          const updated = await ctx.prisma.leaveRequest.update({
            where: { id: input.id },
            data: {
              status: "REJECTED",
              managerStatus: "REJECTED",
              managerId: approver.id,
              managerNote: input.approverNote || null,
              managerRespondedAt: new Date(),
              respondedAt: new Date(),
            },
            include: { leaveType: true, employee: true },
          });

          // Send corporate email to employee (BCC staff)
          void (async () => {
            try {
              const { notifyLeaveDecision } = await import("../lib/email");
              await notifyLeaveDecision({
                employeeName: `${req.employee.firstName} ${req.employee.lastName}`,
                employeeEmail: req.employee.email,
                leaveType: req.leaveType.name,
                startDate: req.startDate.toISOString().slice(0, 10),
                endDate: req.endDate.toISOString().slice(0, 10),
                days: req.numberOfDays,
                action: "REJECTED",
                note: input.approverNote || "Rejected by Reporting Manager",
                decisionBy: `${approver.firstName} ${approver.lastName} (Reporting Manager)`,
              });
            } catch (err) {
              console.error("[leave] manager rejection email failed:", err);
            }
          })();

          void sendEmployeePushNotification({
            prisma: ctx.prisma,
            employeeId: req.employeeId,
            title: "Leave Rejected by Manager",
            body: `Your leave request was rejected by ${approver.firstName} ${approver.lastName}${input.approverNote ? `: ${input.approverNote}` : "."}`,
            url: "/employee-portal/leave",
            type: "leave",
          });

          return updated;
        }
      }

      // Case 2: HR / Admin Responding (Stage 2 / Final Approval)
      const prevStatus = req.status;
      const newStatus =
        input.action === "APPROVE"
          ? "APPROVED"
          : input.action === "REJECT"
          ? "REJECTED"
          : "PENDING";

      const updated = await ctx.prisma.$transaction(async (tx) => {
        // If transitioning AWAY from APPROVED (e.g. APPROVED -> REJECTED or APPROVED -> PENDING)
        if (prevStatus === "APPROVED" && newStatus !== "APPROVED") {
          const year = req.startDate.getUTCFullYear();
          const balance = await tx.leaveBalance.findUnique({
            where: {
              employeeId_leaveTypeId_year: {
                employeeId: req.employeeId,
                leaveTypeId: req.leaveTypeId,
                year,
              },
            },
          });
          if (balance) {
            const used = Math.max(0, balance.used - req.numberOfDays);
            await tx.leaveBalance.update({
              where: { id: balance.id },
              data: {
                used,
                remaining: balance.allotted - used,
              },
            });
          }

          const days = req.isHalfDay ? [] : listWeekdayDates(req.startDate, req.endDate);
          if (days.length > 0) {
            await tx.attendanceLog.deleteMany({
              where: {
                employeeId: req.employeeId,
                date: { in: days },
                notes: "Auto-created from approved leave",
              },
            });
          }
        }

        // If transitioning TO APPROVED (from PENDING or REJECTED)
        if (prevStatus !== "APPROVED" && newStatus === "APPROVED") {
          const year = req.startDate.getUTCFullYear();
          const balance = await tx.leaveBalance.findUnique({
            where: {
              employeeId_leaveTypeId_year: {
                employeeId: req.employeeId,
                leaveTypeId: req.leaveTypeId,
                year,
              },
            },
          });
          if (balance) {
            const used = balance.used + req.numberOfDays;
            await tx.leaveBalance.update({
              where: { id: balance.id },
              data: {
                used,
                remaining: balance.allotted - used,
              },
            });
          }

          const days = req.isHalfDay ? [] : listWeekdayDates(req.startDate, req.endDate);
          for (const day of days) {
            await tx.attendanceLog.upsert({
              where: {
                employeeId_date: {
                  employeeId: req.employeeId,
                  date: day,
                },
              },
              create: {
                employeeId: req.employeeId,
                date: day,
                status: "ON_LEAVE",
                withinGeofence: true,
                notes: "Auto-created from approved leave",
              },
              update: {
                status: "ON_LEAVE",
                notes: "Auto-created from approved leave",
              },
            });
          }
        }

        return tx.leaveRequest.update({
          where: { id: input.id },
          data: {
            status: newStatus,
            managerStatus: req.managerStatus === "PENDING" && newStatus === "APPROVED" ? "APPROVED" : req.managerStatus,
            approvedById: newStatus === "PENDING" ? null : approver.id,
            approverNote: input.approverNote || null,
            respondedAt: newStatus === "PENDING" ? null : new Date(),
          },
          include: {
            leaveType: true,
            employee: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                employeeCode: true,
              },
            },
            approvedBy: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        });
      });

      // Send decision email and push if Approved or Rejected
      if (newStatus !== "PENDING") {
        void (async () => {
          try {
            const { notifyLeaveDecision } = await import("../lib/email");
            await notifyLeaveDecision({
              employeeName: `${updated.employee.firstName} ${updated.employee.lastName}`,
              employeeEmail: updated.employee.email,
              leaveType: updated.leaveType.name,
              startDate: updated.startDate.toISOString().slice(0, 10),
              endDate: updated.endDate.toISOString().slice(0, 10),
              days: updated.numberOfDays,
              action: newStatus,
              note: input.approverNote,
              decisionBy: `${approver.firstName} ${approver.lastName} (HR / Admin)`,
            });
          } catch (err) {
            console.error("[leave] decision email failed:", err);
          }
        })();

        void sendEmployeePushNotification({
          prisma: ctx.prisma,
          employeeId: req.employeeId,
          title: newStatus === "APPROVED" ? "Leave Approved by HR" : "Leave Rejected by HR",
          body: newStatus === "APPROVED"
            ? `Your ${req.numberOfDays}d leave application has been approved by HR.`
            : `Your leave application was rejected by HR${input.approverNote ? `: ${input.approverNote}` : "."}`,
          url: "/employee-portal/leave",
          type: "leave",
        });
      }

      return updated;
    }),

  forEmployee: protectedProcedure
    .input(z.object({ employeeId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertCanViewSensitive(ctx, input.employeeId);
      await autoRejectExpiredLeaves(ctx.prisma);
      const year = new Date().getFullYear();

      const [balances, requests] = await Promise.all([
        ctx.prisma.leaveBalance.findMany({
          where: { employeeId: input.employeeId, year },
          include: { leaveType: true },
          orderBy: { leaveType: { name: "asc" } },
        }),
        ctx.prisma.leaveRequest.findMany({
          where: { employeeId: input.employeeId },
          include: {
            leaveType: true,
            approvedBy: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
          orderBy: { appliedAt: "desc" },
        }),
      ]);

      return { balances, requests, year };
    }),

  adjustBalance: hrAdminProcedure
    .input(
      z.object({
        employeeId: z.string().min(1),
        leaveTypeId: z.string().min(1),
        year: z.number().int().optional(),
        allotted: z.number().min(0).max(365),
        reason: z.string().min(3).max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const year = input.year ?? new Date().getFullYear();
      const existing = await ctx.prisma.leaveBalance.findUnique({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId: input.employeeId,
            leaveTypeId: input.leaveTypeId,
            year,
          },
        },
      });

      if (!existing) {
        return ctx.prisma.leaveBalance.create({
          data: {
            employeeId: input.employeeId,
            leaveTypeId: input.leaveTypeId,
            year,
            allotted: input.allotted,
            used: 0,
            remaining: input.allotted,
          },
          include: { leaveType: true },
        });
      }

      const remaining = Math.max(0, input.allotted - existing.used);
      return ctx.prisma.leaveBalance.update({
        where: { id: existing.id },
        data: {
          allotted: input.allotted,
          remaining,
        },
        include: { leaveType: true },
      });
    }),
});
