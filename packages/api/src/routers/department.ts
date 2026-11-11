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

export const departmentRouter = router({
  list: protectedProcedure.query(async ({ ctx }): Promise<DepartmentWithCount> => {
    const orgId = ctx.session.user.organizationId || "org_default_realty";
    const data = await ctx.prisma.department.findMany({
      where: { organizationId: orgId },
      include: { _count: { select: { employees: true } } },
      orderBy: { name: "asc" },
    });
    return data;
  }),

  create: orgManageProcedure
    .input(createDepartmentSchema)
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId || "org_default_realty";
      const existing = await ctx.prisma.department.findFirst({
        where: { name: input.name, organizationId: orgId },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Department already exists in your company",
        });
      }
      return ctx.prisma.department.create({
        data: { name: input.name, organizationId: orgId },
      });
    }),

  update: orgManageProcedure
    .input(updateDepartmentSchema)
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId || "org_default_realty";
      const existing = await ctx.prisma.department.findFirst({
        where: { id: input.id, organizationId: orgId },
      });
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Department not found",
        });
      }

      const nameTaken = await ctx.prisma.department.findFirst({
        where: { name: input.name, organizationId: orgId, NOT: { id: input.id } },
      });
      if (nameTaken) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Department name already exists in your company",
        });
      }

      return ctx.prisma.department.update({
        where: { id: input.id },
        data: { name: input.name },
      });
    }),

  delete: orgManageProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId || "org_default_realty";
      const existing = await ctx.prisma.department.findFirst({
        where: { id: input.id, organizationId: orgId },
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
      await ctx.prisma.department.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
