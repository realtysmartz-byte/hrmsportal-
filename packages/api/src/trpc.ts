import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { Role } from "@realty-smartz/shared";
import { canManageEmployees, canManageOrg } from "@realty-smartz/shared";
import type { Context } from "./context";

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      session: { ...ctx.session, user: ctx.session.user },
    },
  });
});

export const protectedProcedure = t.procedure.use(isAuthed);

export const hrAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  const role = ctx.session.user.role as Role;
  if (!canManageEmployees(role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin or HR role required",
    });
  }
  return next({ ctx });
});

export const orgManageProcedure = protectedProcedure.use(({ ctx, next }) => {
  const role = ctx.session.user.role as Role;
  if (!canManageOrg(role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin or HR role required",
    });
  }
  return next({ ctx });
});
