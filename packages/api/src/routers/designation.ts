import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createDesignationSchema,
  updateDesignationSchema,
} from "@realty-smartz/shared";
import { orgManageProcedure, protectedProcedure, router } from "../trpc";

type DesignationWithCount = Array<{
  id: string;
  title: string;
  createdAt: Date;
  _count: { employees: number };
}>;

export const designationRouter = router({
  list: protectedProcedure.query(async ({ ctx }): Promise<DesignationWithCount> => {
    const orgId = ctx.session.user.organizationId || "org_default_realty";
    const data = await ctx.prisma.designation.findMany({
      where: { organizationId: orgId },
      include: { _count: { select: { employees: true } } },
      orderBy: { title: "asc" },
    });
    return data;
  }),

  create: orgManageProcedure
    .input(createDesignationSchema)
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId || "org_default_realty";
      const existing = await ctx.prisma.designation.findFirst({
        where: { title: input.title, organizationId: orgId },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Designation already exists in your company",
        });
      }
      return ctx.prisma.designation.create({
        data: { title: input.title, organizationId: orgId },
      });
    }),

  update: orgManageProcedure
    .input(updateDesignationSchema)
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId || "org_default_realty";
      const existing = await ctx.prisma.designation.findFirst({
        where: { id: input.id, organizationId: orgId },
      });
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Designation not found",
        });
      }

      const titleTaken = await ctx.prisma.designation.findFirst({
        where: { title: input.title, organizationId: orgId, NOT: { id: input.id } },
      });
      if (titleTaken) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Designation title already exists in your company",
        });
      }

      return ctx.prisma.designation.update({
        where: { id: input.id },
        data: { title: input.title },
      });
    }),

  delete: orgManageProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId || "org_default_realty";
      const existing = await ctx.prisma.designation.findFirst({
        where: { id: input.id, organizationId: orgId },
        include: { _count: { select: { employees: true } } },
      });
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Designation not found",
        });
      }
      if (existing._count.employees > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete designation with assigned employees",
        });
      }
      await ctx.prisma.designation.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
