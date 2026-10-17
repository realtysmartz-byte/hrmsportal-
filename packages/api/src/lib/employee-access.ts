import { TRPCError } from "@trpc/server";
import {
  canManageEmployees,
  canViewSensitiveEmployeeData,
} from "@realty-smartz/shared";
import type { Role } from "@realty-smartz/shared";
import type { Context } from "../context";

/** Session already has id + role — avoid a DB round-trip on every call. */
export async function resolveActorId(ctx: Context) {
  const id = ctx.session?.user?.id;
  const role = ctx.session?.user?.role;
  if (id && role) {
    return { id, role };
  }

  throw new TRPCError({
    code: "UNAUTHORIZED",
    message: "Not signed in. Please sign in again.",
  });
}

export async function assertCanViewSensitive(
  ctx: Context,
  employeeId: string
) {
  const actor = await resolveActorId(ctx);
  const target = await ctx.prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, managerId: true },
  });
  if (!target) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Employee not found" });
  }

  const allowed = canViewSensitiveEmployeeData(
    { id: actor.id, role: actor.role as Role },
    target
  );
  if (!allowed) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have access to this employee's private data",
    });
  }

  return { actor, target };
}

export async function assertCanEditProfile(
  ctx: Context,
  employeeId: string
) {
  const actor = await resolveActorId(ctx);
  if (canManageEmployees(actor.role as Role)) {
    return { actor, fullEdit: true as const };
  }
  if (actor.id === employeeId) {
    return { actor, fullEdit: false as const };
  }
  throw new TRPCError({ code: "FORBIDDEN" });
}

export function profileCompletionPercent(emp: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  address: string | null;
  dateOfBirth: Date | null;
  profilePhotoUrl: string | null;
  gender: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  designationId: string | null;
  departmentId: string | null;
  dateOfJoining: Date | null;
}) {
  const checks = [
    !!emp.firstName,
    !!emp.lastName,
    !!emp.email,
    !!emp.phone,
    !!emp.address,
    !!emp.dateOfBirth,
    !!emp.profilePhotoUrl,
    !!emp.gender,
    !!emp.emergencyContactName,
    !!emp.emergencyContactPhone,
    !!emp.designationId,
    !!emp.departmentId,
    !!emp.dateOfJoining,
  ];
  const filled = checks.filter(Boolean).length;
  return Math.round((filled / checks.length) * 100);
}
