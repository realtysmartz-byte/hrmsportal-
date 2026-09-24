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
} from "@realty-smartz/shared";
import type { Role } from "@realty-smartz/shared";
import { hrAdminProcedure, protectedProcedure, router } from "../trpc";
import { assertCanViewSensitive } from "../lib/employee-access";

export const leaveRouter = router({
  types: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.leaveType.findMany({ orderBy: { name: "asc" } });
  }),

  createType: hrAdminProcedure
    .input(createLeaveTypeSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.leaveType.findUnique({
        where: { name: input.name },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Leave type already exists",
        });
      }

      const leaveType = await ctx.prisma.leaveType.create({ data: input });

      const year = new Date().getFullYear();
      const employees = await ctx.prisma.employee.findMany({
        where: { status: { in: ["ACTIVE", "ON_LEAVE"] } },
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
          const { notifyPolicyUpdate } = await import("../lib/email");
          const emails = employees.map((e) => e.email);
          if (process.env.HR_NOTIFY_EMAIL) emails.push(process.env.HR_NOTIFY_EMAIL);
          await notifyPolicyUpdate({
            title: `New leave type: ${leaveType.name}`,
            summary: `Annual quota: ${leaveType.annualQuota} days. Approval required: ${leaveType.requiresApproval ? "Yes" : "No"}. Carry forward: ${leaveType.carryForwardAllowed ? "Allowed" : "Not allowed"}.`,
            recipientEmails: [...new Set(emails)],
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
      const { id, ...data } = input;
      const existing = await ctx.prisma.leaveType.findUnique({ where: { id } });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return ctx.prisma.leaveType.update({ where: { id }, data });
    }),

  deleteType: hrAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
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

  myRequests: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.leaveRequest.findMany({
      where: { employeeId: ctx.session.user.id },
      include: {
        leaveType: true,
        approvedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { appliedAt: "desc" },
    });
  }),

  apply: protectedProcedure
    .input(applyLeaveSchema)
    .mutation(async ({ ctx, input }) => {
      const leaveType = await ctx.prisma.leaveType.findUnique({
        where: { id: input.leaveTypeId },
      });
      if (!leaveType) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Leave type not found" });
      }

      const startDate = startOfDayUTC(input.startDate);
      const endDate = startOfDayUTC(input.endDate);
      const numberOfDays = countWeekdays(startDate, endDate);

      if (numberOfDays <= 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Selected range has no working days",
        });
      }

      const year = startDate.getUTCFullYear();

      // Prefer live employee id (session id may be stale after reseed)
      const actor =
        (await ctx.prisma.employee.findUnique({
          where: { id: ctx.session.user.id },
          select: { id: true },
        })) ??
        (await ctx.prisma.employee.findUnique({
          where: { email: ctx.session.user.email.toLowerCase() },
          select: { id: true },
        }));

      if (!actor) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message:
            "Your session is out of date. Sign out and sign in again, then retry.",
        });
      }

      const balance = await ctx.prisma.leaveBalance.findUnique({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId: actor.id,
            leaveTypeId: input.leaveTypeId,
            year,
          },
        },
      });

      const exceedsBalance = !balance || balance.remaining < numberOfDays;

      const created = await ctx.prisma.leaveRequest.create({
        data: {
          employeeId: actor.id,
          leaveTypeId: input.leaveTypeId,
          startDate,
          endDate,
          numberOfDays,
          reason:
            exceedsBalance
              ? `${input.reason}\n\n[Note: Request exceeds available balance]`
              : input.reason,
          status: leaveType.requiresApproval ? "PENDING" : "APPROVED",
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
        } catch (err) {
          console.error("[leave] apply email failed:", err);
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
      return ctx.prisma.leaveRequest.update({
        where: { id: input.id },
        data: { status: "CANCELLED", respondedAt: new Date() },
      });
    }),

  pendingApprovals: protectedProcedure.query(async ({ ctx }) => {
    const role = ctx.session.user.role as Role;
    if (!canApproveLeave(role)) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    const where: Record<string, unknown> = { status: "PENDING" };
    if (role === "MANAGER") {
      where.employee = { managerId: ctx.session.user.id };
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
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { appliedAt: "asc" },
    });
  }),

  respond: protectedProcedure
    .input(respondLeaveSchema)
    .mutation(async ({ ctx, input }) => {
      const role = ctx.session.user.role as Role;
      if (!canApproveLeave(role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Resolve approver from DB — session id can go stale after a reseed
      const approver =
        (await ctx.prisma.employee.findUnique({
          where: { id: ctx.session.user.id },
          select: { id: true },
        })) ??
        (ctx.session.user.email
          ? await ctx.prisma.employee.findUnique({
              where: { email: ctx.session.user.email.toLowerCase() },
              select: { id: true },
            })
          : null);

      if (!approver) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message:
            "Your session is out of date (database was reseeded). Sign out and sign in again, then retry.",
        });
      }

      const req = await ctx.prisma.leaveRequest.findUnique({
        where: { id: input.id },
        include: { employee: { select: { managerId: true } } },
      });
      if (!req) throw new TRPCError({ code: "NOT_FOUND" });
      if (req.status !== "PENDING") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Request is not pending",
        });
      }

      if (
        role === "MANAGER" &&
        req.employee.managerId !== approver.id
      ) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      if (input.action === "REJECT") {
        const rejected = await ctx.prisma.leaveRequest.update({
          where: { id: input.id },
          data: {
            status: "REJECTED",
            approvedById: approver.id,
            approverNote: input.approverNote || null,
            respondedAt: new Date(),
          },
          include: {
            leaveType: true,
            employee: {
              select: {
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        });

        void (async () => {
          try {
            const { notifyLeaveDecision } = await import("../lib/email");
            await notifyLeaveDecision({
              employeeName: `${rejected.employee.firstName} ${rejected.employee.lastName}`,
              employeeEmail: rejected.employee.email,
              leaveType: rejected.leaveType.name,
              startDate: rejected.startDate.toISOString().slice(0, 10),
              endDate: rejected.endDate.toISOString().slice(0, 10),
              days: rejected.numberOfDays,
              action: "REJECTED",
              note: input.approverNote,
            });
          } catch (err) {
            console.error("[leave] reject email failed:", err);
          }
        })();

        return rejected;
      }

      // APPROVE
      const approved = await ctx.prisma.$transaction(async (tx) => {
        const updated = await tx.leaveRequest.update({
          where: { id: input.id },
          data: {
            status: "APPROVED",
            approvedById: approver.id,
            approverNote: input.approverNote || null,
            respondedAt: new Date(),
          },
          include: {
            leaveType: true,
            employee: {
              select: {
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        });

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

        const days = listWeekdayDates(req.startDate, req.endDate);
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

        return updated;
      });

      void (async () => {
        try {
          const { notifyLeaveDecision } = await import("../lib/email");
          await notifyLeaveDecision({
            employeeName: `${approved.employee.firstName} ${approved.employee.lastName}`,
            employeeEmail: approved.employee.email,
            leaveType: approved.leaveType.name,
            startDate: approved.startDate.toISOString().slice(0, 10),
            endDate: approved.endDate.toISOString().slice(0, 10),
            days: approved.numberOfDays,
            action: "APPROVED",
            note: input.approverNote,
          });
        } catch (err) {
          console.error("[leave] approve email failed:", err);
        }
      })();

      return approved;
    }),

  forEmployee: protectedProcedure
    .input(z.object({ employeeId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertCanViewSensitive(ctx, input.employeeId);
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
