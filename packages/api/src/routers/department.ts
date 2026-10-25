import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createDepartmentSchema,
  updateDepartmentSchema,
} from "@realty-smartz/shared";
import { orgManageProcedure, protectedProcedure, router } from "../trpc";

type DepartmentWithCount = Array<{
  id: string;
  name: string;
  createdAt: Date;
  _count: { employees: number };
}>;

let departmentListCache: { at: number; data: DepartmentWithCount } | null = null;
const DEPARTMENT_LIST_TTL_MS = 5 * 60 * 1000;

export const departmentRouter = router({
  list: protectedProcedure.query(async ({ ctx }): Promise<DepartmentWithCount> => {
    if (
      departmentListCache &&
      Date.now() - departmentListCache.at < DEPARTMENT_LIST_TTL_MS
    ) {
      return departmentListCache.data;
    }
    const data = await ctx.prisma.department.findMany({
      include: { _count: { select: { employees: true } } },
      orderBy: { name: "asc" },
    });
    departmentListCache = { at: Date.now(), data };
    return data;
  }),

  create: orgManageProcedure
    .input(createDepartmentSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.department.findUnique({
        where: { name: input.name },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Department already exists",
        });
      }
      departmentListCache = null;
      return ctx.prisma.department.create({ data: { name: input.name } });
    }),

  update: orgManageProcedure
    .input(updateDepartmentSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.department.findUnique({
        where: { id: input.id },
      });
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Department not found",
        });
      }

      const nameTaken = await ctx.prisma.department.findFirst({
        where: { name: input.name, NOT: { id: input.id } },
      });
      if (nameTaken) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Department name already exists",
        });
      }

      departmentListCache = null;
      return ctx.prisma.department.update({
        where: { id: input.id },
        data: { name: input.name },
      });
    }),

  delete: orgManageProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.department.findUnique({
        where: { id: input.id },
        include: { _count: { select: { employees: true } } },
      });
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Department not found",
        });
      }
      if (existing._count.employees > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete department with assigned employees",
        });
      }
      departmentListCache = null;
      await ctx.prisma.department.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
