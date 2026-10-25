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

let designationListCache: { at: number; data: DesignationWithCount } | null = null;
const DESIGNATION_LIST_TTL_MS = 5 * 60 * 1000;

export const designationRouter = router({
  list: protectedProcedure.query(async ({ ctx }): Promise<DesignationWithCount> => {
    if (
      designationListCache &&
      Date.now() - designationListCache.at < DESIGNATION_LIST_TTL_MS
    ) {
      return designationListCache.data;
    }
    const data = await ctx.prisma.designation.findMany({
      include: { _count: { select: { employees: true } } },
      orderBy: { title: "asc" },
    });
    designationListCache = { at: Date.now(), data };
    return data;
  }),

  create: orgManageProcedure
    .input(createDesignationSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.designation.findUnique({
        where: { title: input.title },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Designation already exists",
        });
      }
      designationListCache = null;
      return ctx.prisma.designation.create({ data: { title: input.title } });
    }),

  update: orgManageProcedure
    .input(updateDesignationSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.designation.findUnique({
        where: { id: input.id },
      });
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Designation not found",
        });
      }

      const titleTaken = await ctx.prisma.designation.findFirst({
        where: { title: input.title, NOT: { id: input.id } },
      });
      if (titleTaken) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Designation title already exists",
        });
      }

      designationListCache = null;
      return ctx.prisma.designation.update({
        where: { id: input.id },
        data: { title: input.title },
      });
    }),

  delete: orgManageProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.designation.findUnique({
        where: { id: input.id },
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
      designationListCache = null;
      await ctx.prisma.designation.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
