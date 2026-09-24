import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createPerformanceCycleSchema,
  updatePerformanceCycleSchema,
  createGoalSchema,
  updateGoalSchema,
  createKeyResultSchema,
  updateKeyResultSchema,
  submitReviewSchema,
  canManageEmployees,
  canViewSensitiveEmployeeData,
  isManager,
} from "@realty-smartz/shared";
import type { Role } from "@realty-smartz/shared";
import { hrAdminProcedure, protectedProcedure, router } from "../trpc";
import { assertCanViewSensitive, resolveActorId } from "../lib/employee-access";

export const performanceRouter = router({
  // -------------------------------------------------------------
  // Cycle Management
  // -------------------------------------------------------------

  cycleList: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.performanceCycle.findMany({
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        _count: {
          select: { goals: true, reviews: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  activeCycle: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.performanceCycle.findFirst({
      where: { status: "ACTIVE" },
      include: {
        _count: {
          select: { goals: true, reviews: true },
        },
      },
      orderBy: { startDate: "desc" },
    });
  }),

  cycleById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const cycle = await ctx.prisma.performanceCycle.findUnique({
        where: { id: input.id },
        include: {
          createdBy: {
            select: { id: true, firstName: true, lastName: true },
          },
          _count: {
            select: { goals: true, reviews: true },
          },
        },
      });

      if (!cycle) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Performance cycle not found" });
      }

      return cycle;
    }),

  createCycle: hrAdminProcedure
    .input(createPerformanceCycleSchema)
    .mutation(async ({ ctx, input }) => {
      const actor = await resolveActorId(ctx);
      if (input.endDate < input.startDate) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "End date must be on or after start date",
        });
      }

      return ctx.prisma.performanceCycle.create({
        data: {
          name: input.name.trim(),
          cycleType: input.cycleType,
          startDate: input.startDate,
          endDate: input.endDate,
          status: "DRAFT",
          createdById: actor.id,
        },
      });
    }),

  updateCycle: hrAdminProcedure
    .input(updatePerformanceCycleSchema)
    .mutation(async ({ ctx, input }) => {
      const cycle = await ctx.prisma.performanceCycle.findUnique({
        where: { id: input.id },
      });
      if (!cycle) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cycle not found" });
      }

      const startDate = input.startDate ?? cycle.startDate;
      const endDate = input.endDate ?? cycle.endDate;
      if (endDate < startDate) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "End date must be on or after start date",
        });
      }

      return ctx.prisma.performanceCycle.update({
        where: { id: input.id },
        data: {
          ...(input.name ? { name: input.name.trim() } : {}),
          ...(input.startDate ? { startDate: input.startDate } : {}),
          ...(input.endDate ? { endDate: input.endDate } : {}),
        },
      });
    }),

  activateCycle: hrAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const cycle = await ctx.prisma.performanceCycle.findUnique({
        where: { id: input.id },
      });
      if (!cycle) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cycle not found" });
      }
      if (cycle.status === "CLOSED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Closed cycles cannot be reactivated",
        });
      }

      return ctx.prisma.performanceCycle.update({
        where: { id: input.id },
        data: { status: "ACTIVE" },
      });
    }),

  closeCycle: hrAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const cycle = await ctx.prisma.performanceCycle.findUnique({
        where: { id: input.id },
      });
      if (!cycle) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cycle not found" });
      }

      return ctx.prisma.performanceCycle.update({
        where: { id: input.id },
        data: { status: "CLOSED" },
      });
    }),

  // -------------------------------------------------------------
  // Goal Management
  // -------------------------------------------------------------

  myGoals: protectedProcedure
    .input(z.object({ cycleId: z.string() }))
    .query(async ({ ctx, input }) => {
      const actor = await resolveActorId(ctx);
      return ctx.prisma.goal.findMany({
        where: {
          cycleId: input.cycleId,
          employeeId: actor.id,
        },
        include: {
          keyResults: {
            orderBy: { id: "asc" },
          },
        },
        orderBy: { createdAt: "asc" },
      });
    }),

  employeeGoals: protectedProcedure
    .input(
      z.object({
        cycleId: z.string(),
        employeeId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      await assertCanViewSensitive(ctx, input.employeeId);

      return ctx.prisma.goal.findMany({
        where: {
          cycleId: input.cycleId,
          employeeId: input.employeeId,
        },
        include: {
          keyResults: {
            orderBy: { id: "asc" },
          },
        },
        orderBy: { createdAt: "asc" },
      });
    }),

  createGoal: protectedProcedure
    .input(createGoalSchema)
    .mutation(async ({ ctx, input }) => {
      const actor = await resolveActorId(ctx);
      const cycle = await ctx.prisma.performanceCycle.findUnique({
        where: { id: input.cycleId },
      });

      if (!cycle) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cycle not found" });
      }
      if (cycle.status !== "ACTIVE") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Goals can only be added during an ACTIVE cycle",
        });
      }

      return ctx.prisma.goal.create({
        data: {
          cycleId: input.cycleId,
          employeeId: actor.id,
          title: input.title.trim(),
          description: input.description?.trim() || null,
          category: input.category,
          targetValue: input.targetValue?.trim() || null,
          status: "NOT_STARTED",
          progressPercent: 0,
          keyResults: input.keyResults?.length
            ? {
                create: input.keyResults.map((kr) => ({
                  description: kr.description.trim(),
                  progressPercent: 0,
                  completed: false,
                })),
              }
            : undefined,
        },
        include: { keyResults: true },
      });
    }),

  updateGoal: protectedProcedure
    .input(updateGoalSchema)
    .mutation(async ({ ctx, input }) => {
      const actor = await resolveActorId(ctx);
      const goal = await ctx.prisma.goal.findUnique({
        where: { id: input.id },
        include: { cycle: true },
      });

      if (!goal) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Goal not found" });
      }

      if (goal.cycle.status === "CLOSED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot modify goals in a closed cycle",
        });
      }

      const isOwner = goal.employeeId === actor.id;
      const canManage = canManageEmployees(actor.role as Role);
      if (!isOwner && !canManage) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only edit your own goals",
        });
      }

      let newStatus = input.status ?? goal.status;
      if (input.progressPercent != null) {
        if (input.progressPercent === 100 && newStatus !== "MISSED") {
          newStatus = "COMPLETED";
        } else if (input.progressPercent > 0 && newStatus === "NOT_STARTED") {
          newStatus = "IN_PROGRESS";
        }
      }

      return ctx.prisma.goal.update({
        where: { id: input.id },
        data: {
          ...(input.title ? { title: input.title.trim() } : {}),
          ...(input.description !== undefined
            ? { description: input.description?.trim() || null }
            : {}),
          ...(input.category ? { category: input.category } : {}),
          ...(input.targetValue !== undefined
            ? { targetValue: input.targetValue?.trim() || null }
            : {}),
          ...(input.progressPercent != null
            ? { progressPercent: input.progressPercent }
            : {}),
          status: newStatus,
        },
        include: { keyResults: true },
      });
    }),

  deleteGoal: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const actor = await resolveActorId(ctx);
      const goal = await ctx.prisma.goal.findUnique({
        where: { id: input.id },
        include: { cycle: true },
      });

      if (!goal) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Goal not found" });
      }

      if (goal.cycle.status === "CLOSED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete goals from a closed cycle",
        });
      }

      const isOwner = goal.employeeId === actor.id;
      const canManage = canManageEmployees(actor.role as Role);
      if (!isOwner && !canManage) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await ctx.prisma.goal.delete({ where: { id: input.id } });
      return { success: true };
    }),

  // -------------------------------------------------------------
  // Key Results (for OKR cycles)
  // -------------------------------------------------------------

  createKeyResult: protectedProcedure
    .input(createKeyResultSchema)
    .mutation(async ({ ctx, input }) => {
      const actor = await resolveActorId(ctx);
      const goal = await ctx.prisma.goal.findUnique({
        where: { id: input.goalId },
        include: { cycle: true },
      });

      if (!goal) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Goal not found" });
      }
      if (goal.cycle.status !== "ACTIVE") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cycle is not active",
        });
      }
      if (goal.employeeId !== actor.id && !canManageEmployees(actor.role as Role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return ctx.prisma.keyResult.create({
        data: {
          goalId: input.goalId,
          description: input.description.trim(),
          progressPercent: 0,
          completed: false,
        },
      });
    }),

  updateKeyResult: protectedProcedure
    .input(updateKeyResultSchema)
    .mutation(async ({ ctx, input }) => {
      const actor = await resolveActorId(ctx);
      const kr = await ctx.prisma.keyResult.findUnique({
        where: { id: input.id },
        include: { goal: { include: { cycle: true } } },
      });

      if (!kr) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Key result not found" });
      }
      if (kr.goal.cycle.status === "CLOSED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot edit key results in a closed cycle",
        });
      }
      if (kr.goal.employeeId !== actor.id && !canManageEmployees(actor.role as Role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const completed =
        input.completed !== undefined
          ? input.completed
          : input.progressPercent === 100;

      const updatedKr = await ctx.prisma.keyResult.update({
        where: { id: input.id },
        data: {
          ...(input.description ? { description: input.description.trim() } : {}),
          ...(input.progressPercent != null
            ? { progressPercent: input.progressPercent }
            : {}),
          completed,
        },
      });

      // Recalculate average progress for parent goal
      const allKrs = await ctx.prisma.keyResult.findMany({
        where: { goalId: kr.goalId },
      });
      if (allKrs.length > 0) {
        const avg = Math.round(
          allKrs.reduce((sum, item) => sum + item.progressPercent, 0) /
            allKrs.length
        );
        let goalStatus = kr.goal.status;
        if (avg === 100) goalStatus = "COMPLETED";
        else if (avg > 0 && goalStatus === "NOT_STARTED") goalStatus = "IN_PROGRESS";

        await ctx.prisma.goal.update({
          where: { id: kr.goalId },
          data: { progressPercent: avg, status: goalStatus },
        });
      }

      return updatedKr;
    }),

  deleteKeyResult: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const actor = await resolveActorId(ctx);
      const kr = await ctx.prisma.keyResult.findUnique({
        where: { id: input.id },
        include: { goal: { include: { cycle: true } } },
      });

      if (!kr) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (kr.goal.cycle.status === "CLOSED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete key results in a closed cycle",
        });
      }
      if (kr.goal.employeeId !== actor.id && !canManageEmployees(actor.role as Role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await ctx.prisma.keyResult.delete({ where: { id: input.id } });
      return { success: true };
    }),

  // -------------------------------------------------------------
  // Reviews (Self & Manager)
  // -------------------------------------------------------------

  myReviews: protectedProcedure
    .input(z.object({ cycleId: z.string() }))
    .query(async ({ ctx, input }) => {
      const actor = await resolveActorId(ctx);

      const [selfReview, managerReview] = await Promise.all([
        ctx.prisma.review.findFirst({
          where: {
            cycleId: input.cycleId,
            employeeId: actor.id,
            reviewType: "SELF",
          },
        }),
        ctx.prisma.review.findFirst({
          where: {
            cycleId: input.cycleId,
            employeeId: actor.id,
            reviewType: "MANAGER",
            status: "SUBMITTED", // only visible once submitted
          },
          include: {
            reviewer: {
              select: { firstName: true, lastName: true, employeeCode: true },
            },
          },
        }),
      ]);

      return { selfReview, managerReview };
    }),

  teamReviewsForCycle: protectedProcedure
    .input(z.object({ cycleId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const actor = await resolveActorId(ctx);
      const role = actor.role as Role;
      if (!isManager(role) && !canManageEmployees(role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Manager or HR/Admin role required",
        });
      }

      let cycleId = input.cycleId;
      if (!cycleId) {
        const active = await ctx.prisma.performanceCycle.findFirst({
          where: { status: "ACTIVE" },
          orderBy: { startDate: "desc" },
        });
        cycleId = active?.id;
      }

      if (!cycleId) return { cycle: null, team: [] };

      const cycle = await ctx.prisma.performanceCycle.findUnique({
        where: { id: cycleId },
      });
      if (!cycle) return { cycle: null, team: [] };

      // Direct reports for manager, or all employees for admin/HR
      const whereClause: Record<string, unknown> = {
        status: { in: ["ACTIVE", "ON_LEAVE"] },
      };
      if (role === "MANAGER") {
        whereClause.managerId = actor.id;
      }

      const teamMembers = await ctx.prisma.employee.findMany({
        where: whereClause,
        include: {
          department: { select: { id: true, name: true } },
          designation: { select: { id: true, title: true } },
        },
        orderBy: { firstName: "asc" },
      });

      const memberIds = teamMembers.map((m) => m.id);

      const [goals, reviews] = await Promise.all([
        ctx.prisma.goal.findMany({
          where: {
            cycleId,
            employeeId: { in: memberIds },
          },
          select: { employeeId: true, id: true, progressPercent: true },
        }),
        ctx.prisma.review.findMany({
          where: {
            cycleId,
            employeeId: { in: memberIds },
          },
        }),
      ]);

      const goalsByEmp = new Map<string, typeof goals>();
      for (const g of goals) {
        const list = goalsByEmp.get(g.employeeId) ?? [];
        list.push(g);
        goalsByEmp.set(g.employeeId, list);
      }

      const reviewsByEmp = new Map<string, { self?: (typeof reviews)[0]; manager?: (typeof reviews)[0] }>();
      for (const r of reviews) {
        const entry = reviewsByEmp.get(r.employeeId) ?? {};
        if (r.reviewType === "SELF") entry.self = r;
        if (r.reviewType === "MANAGER") entry.manager = r;
        reviewsByEmp.set(r.employeeId, entry);
      }

      const team = teamMembers.map((emp) => {
        const empGoals = goalsByEmp.get(emp.id) ?? [];
        const empReviews = reviewsByEmp.get(emp.id) ?? {};
        const avgProgress =
          empGoals.length > 0
            ? Math.round(
                empGoals.reduce((s, g) => s + g.progressPercent, 0) /
                  empGoals.length
              )
            : 0;

        return {
          employee: emp,
          goalsCount: empGoals.length,
          averageGoalProgress: avgProgress,
          selfReview: empReviews.self ?? null,
          managerReview: empReviews.manager ?? null,
        };
      });

      return { cycle, team };
    }),

  employeeReviewDetail: protectedProcedure
    .input(
      z.object({
        cycleId: z.string(),
        employeeId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const actor = await resolveActorId(ctx);
      const role = actor.role as Role;

      const employee = await ctx.prisma.employee.findUnique({
        where: { id: input.employeeId },
        include: {
          department: { select: { id: true, name: true } },
          designation: { select: { id: true, title: true } },
          manager: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });

      if (!employee) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Employee not found" });
      }

      const isSelf = actor.id === employee.id;
      const isManagerOfEmp = employee.managerId === actor.id;
      const canManage = canManageEmployees(role);

      if (!isSelf && !isManagerOfEmp && !canManage) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to view this review detail",
        });
      }

      const [cycle, goals, reviews] = await Promise.all([
        ctx.prisma.performanceCycle.findUnique({
          where: { id: input.cycleId },
        }),
        ctx.prisma.goal.findMany({
          where: {
            cycleId: input.cycleId,
            employeeId: input.employeeId,
          },
          include: {
            keyResults: true,
          },
          orderBy: { createdAt: "asc" },
        }),
        ctx.prisma.review.findMany({
          where: {
            cycleId: input.cycleId,
            employeeId: input.employeeId,
          },
          include: {
            reviewer: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        }),
      ]);

      if (!cycle) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cycle not found" });
      }

      const selfReview = reviews.find((r) => r.reviewType === "SELF") ?? null;
      let managerReview = reviews.find((r) => r.reviewType === "MANAGER") ?? null;

      // If user is employee viewing their own, manager review is only visible if SUBMITTED
      if (isSelf && !canManage && !isManagerOfEmp) {
        if (managerReview && managerReview.status !== "SUBMITTED") {
          managerReview = null;
        }
      }

      return {
        cycle,
        employee,
        goals,
        selfReview,
        managerReview,
        canEditManagerReview: (isManagerOfEmp || canManage) && cycle.status === "ACTIVE",
        canEditSelfReview: isSelf && cycle.status === "ACTIVE",
      };
    }),

  submitSelfReview: protectedProcedure
    .input(
      z.object({
        cycleId: z.string(),
        rating: z.number().int().min(1).max(5).optional().nullable(),
        strengths: z.string().optional().nullable(),
        improvements: z.string().optional().nullable(),
        comments: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const actor = await resolveActorId(ctx);
      const cycle = await ctx.prisma.performanceCycle.findUnique({
        where: { id: input.cycleId },
      });

      if (!cycle) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cycle not found" });
      }
      if (cycle.status !== "ACTIVE") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Reviews can only be submitted during an ACTIVE cycle",
        });
      }

      return ctx.prisma.review.upsert({
        where: {
          cycleId_employeeId_reviewerId_reviewType: {
            cycleId: input.cycleId,
            employeeId: actor.id,
            reviewerId: actor.id,
            reviewType: "SELF",
          },
        },
        create: {
          cycleId: input.cycleId,
          employeeId: actor.id,
          reviewerId: actor.id,
          reviewType: "SELF",
          rating: input.rating ?? null,
          strengths: input.strengths?.trim() || null,
          improvements: input.improvements?.trim() || null,
          comments: input.comments?.trim() || null,
          status: "SUBMITTED",
          submittedAt: new Date(),
        },
        update: {
          rating: input.rating ?? null,
          strengths: input.strengths?.trim() || null,
          improvements: input.improvements?.trim() || null,
          comments: input.comments?.trim() || null,
          status: "SUBMITTED",
          submittedAt: new Date(),
        },
      });
    }),

  submitManagerReview: protectedProcedure
    .input(
      z.object({
        cycleId: z.string(),
        employeeId: z.string(),
        rating: z.number().int().min(1).max(5).optional().nullable(),
        strengths: z.string().optional().nullable(),
        improvements: z.string().optional().nullable(),
        comments: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const actor = await resolveActorId(ctx);
      const cycle = await ctx.prisma.performanceCycle.findUnique({
        where: { id: input.cycleId },
      });

      if (!cycle) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cycle not found" });
      }
      if (cycle.status !== "ACTIVE") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Reviews can only be submitted during an ACTIVE cycle",
        });
      }

      const targetEmp = await ctx.prisma.employee.findUnique({
        where: { id: input.employeeId },
        select: { id: true, managerId: true },
      });

      if (!targetEmp) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Employee not found" });
      }

      const isDirectManager = targetEmp.managerId === actor.id;
      const canManage = canManageEmployees(actor.role as Role);

      if (!isDirectManager && !canManage) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only submit manager reviews for your direct reports",
        });
      }

      return ctx.prisma.review.upsert({
        where: {
          cycleId_employeeId_reviewerId_reviewType: {
            cycleId: input.cycleId,
            employeeId: input.employeeId,
            reviewerId: actor.id,
            reviewType: "MANAGER",
          },
        },
        create: {
          cycleId: input.cycleId,
          employeeId: input.employeeId,
          reviewerId: actor.id,
          reviewType: "MANAGER",
          rating: input.rating ?? null,
          strengths: input.strengths?.trim() || null,
          improvements: input.improvements?.trim() || null,
          comments: input.comments?.trim() || null,
          status: "SUBMITTED",
          submittedAt: new Date(),
        },
        update: {
          rating: input.rating ?? null,
          strengths: input.strengths?.trim() || null,
          improvements: input.improvements?.trim() || null,
          comments: input.comments?.trim() || null,
          status: "SUBMITTED",
          submittedAt: new Date(),
        },
      });
    }),

  // -------------------------------------------------------------
  // Cycle Detail Tracking View (Admin/HR)
  // -------------------------------------------------------------

  cycleTracking: hrAdminProcedure
    .input(z.object({ cycleId: z.string() }))
    .query(async ({ ctx, input }) => {
      const cycle = await ctx.prisma.performanceCycle.findUnique({
        where: { id: input.cycleId },
        include: {
          createdBy: {
            select: { firstName: true, lastName: true },
          },
        },
      });

      if (!cycle) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cycle not found" });
      }

      const employees = await ctx.prisma.employee.findMany({
        where: {
          status: { in: ["ACTIVE", "ON_LEAVE"] },
        },
        include: {
          department: { select: { id: true, name: true } },
          designation: { select: { id: true, title: true } },
          manager: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { firstName: "asc" },
      });

      const empIds = employees.map((e) => e.id);

      const [goals, reviews] = await Promise.all([
        ctx.prisma.goal.findMany({
          where: {
            cycleId: input.cycleId,
            employeeId: { in: empIds },
          },
          select: { employeeId: true, id: true, progressPercent: true },
        }),
        ctx.prisma.review.findMany({
          where: {
            cycleId: input.cycleId,
            employeeId: { in: empIds },
          },
          include: {
            reviewer: {
              select: { firstName: true, lastName: true },
            },
          },
        }),
      ]);

      const goalsByEmp = new Map<string, typeof goals>();
      for (const g of goals) {
        const list = goalsByEmp.get(g.employeeId) ?? [];
        list.push(g);
        goalsByEmp.set(g.employeeId, list);
      }

      const reviewsByEmp = new Map<
        string,
        {
          self?: (typeof reviews)[0];
          manager?: (typeof reviews)[0];
        }
      >();
      for (const r of reviews) {
        const current = reviewsByEmp.get(r.employeeId) ?? {};
        if (r.reviewType === "SELF") current.self = r;
        if (r.reviewType === "MANAGER") current.manager = r;
        reviewsByEmp.set(r.employeeId, current);
      }

      let selfSubmittedCount = 0;
      let managerSubmittedCount = 0;
      let ratingSum = 0;
      let ratingCount = 0;

      const rows = employees.map((emp) => {
        const empGoals = goalsByEmp.get(emp.id) ?? [];
        const empReviews = reviewsByEmp.get(emp.id) ?? {};

        const selfSub = empReviews.self?.status === "SUBMITTED";
        const mgrSub = empReviews.manager?.status === "SUBMITTED";

        if (selfSub) selfSubmittedCount++;
        if (mgrSub) managerSubmittedCount++;

        let avgRating: number | null = null;
        if (empReviews.self?.rating && empReviews.manager?.rating) {
          avgRating = (empReviews.self.rating + empReviews.manager.rating) / 2;
        } else if (empReviews.manager?.rating) {
          avgRating = empReviews.manager.rating;
        } else if (empReviews.self?.rating) {
          avgRating = empReviews.self.rating;
        }

        if (avgRating != null) {
          ratingSum += avgRating;
          ratingCount++;
        }

        return {
          employee: emp,
          goalsCount: empGoals.length,
          selfReview: empReviews.self
            ? {
                id: empReviews.self.id,
                status: empReviews.self.status,
                rating: empReviews.self.rating,
                submittedAt: empReviews.self.submittedAt,
              }
            : null,
          managerReview: empReviews.manager
            ? {
                id: empReviews.manager.id,
                status: empReviews.manager.status,
                rating: empReviews.manager.rating,
                submittedAt: empReviews.manager.submittedAt,
                reviewerName: empReviews.manager.reviewer
                  ? `${empReviews.manager.reviewer.firstName} ${empReviews.manager.reviewer.lastName}`
                  : null,
              }
            : null,
          averageRating: avgRating != null ? Math.round(avgRating * 10) / 10 : null,
        };
      });

      return {
        cycle,
        totalEmployees: employees.length,
        selfSubmittedCount,
        managerSubmittedCount,
        overallAverageRating:
          ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 10) / 10 : null,
        rows,
      };
    }),

  // -------------------------------------------------------------
  // Employee History Across Closed Cycles (For Employee Profile Hub)
  // -------------------------------------------------------------

  employeeHistory: protectedProcedure
    .input(z.object({ employeeId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { actor, target } = await assertCanViewSensitive(ctx, input.employeeId);
      const isSelf = actor.id === target.id;
      const isDirectManager = target.managerId === actor.id;
      const canManage = canManageEmployees(actor.role as Role);

      // Fetch cycles (all closed or active where employee participated)
      const cycles = await ctx.prisma.performanceCycle.findMany({
        where: {
          OR: [
            { status: "CLOSED" },
            { status: "ACTIVE" },
          ],
        },
        orderBy: { endDate: "desc" },
      });

      const cycleIds = cycles.map((c) => c.id);

      const [goals, reviews] = await Promise.all([
        ctx.prisma.goal.findMany({
          where: {
            cycleId: { in: cycleIds },
            employeeId: input.employeeId,
          },
          include: {
            keyResults: true,
          },
          orderBy: { createdAt: "asc" },
        }),
        ctx.prisma.review.findMany({
          where: {
            cycleId: { in: cycleIds },
            employeeId: input.employeeId,
          },
          include: {
            reviewer: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        }),
      ]);

      const goalsByCycle = new Map<string, typeof goals>();
      for (const g of goals) {
        const list = goalsByCycle.get(g.cycleId) ?? [];
        list.push(g);
        goalsByCycle.set(g.cycleId, list);
      }

      const reviewsByCycle = new Map<
        string,
        { self?: (typeof reviews)[0]; manager?: (typeof reviews)[0] }
      >();
      for (const r of reviews) {
        const current = reviewsByCycle.get(r.cycleId) ?? {};
        if (r.reviewType === "SELF") current.self = r;
        if (r.reviewType === "MANAGER") current.manager = r;
        reviewsByCycle.set(r.cycleId, current);
      }

      return cycles.map((cycle) => {
        const cycleGoals = goalsByCycle.get(cycle.id) ?? [];
        const cycleReviews = reviewsByCycle.get(cycle.id) ?? {};

        const selfReview = cycleReviews.self ?? null;
        let managerReview = cycleReviews.manager ?? null;

        // Hide manager draft review from employee until submitted
        if (isSelf && !canManage && !isDirectManager) {
          if (managerReview && managerReview.status !== "SUBMITTED") {
            managerReview = null;
          }
        }

        let finalRating: number | null = null;
        if (selfReview?.rating && managerReview?.rating) {
          finalRating = (selfReview.rating + managerReview.rating) / 2;
        } else if (managerReview?.rating) {
          finalRating = managerReview.rating;
        } else if (selfReview?.rating) {
          finalRating = selfReview.rating;
        }

        return {
          cycle,
          goals: cycleGoals,
          selfReview,
          managerReview,
          finalRating: finalRating != null ? Math.round(finalRating * 10) / 10 : null,
        };
      });
    }),
});
