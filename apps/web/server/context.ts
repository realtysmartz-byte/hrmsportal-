import { getServerSession } from "next-auth";
import { createContext } from "@realty-smartz/api";
import { prisma } from "@realty-smartz/db";
import type { Role } from "@realty-smartz/shared";
import { authOptions } from "@/lib/auth";

function clientIp(req?: Request | null) {
  const forwarded = req?.headers.get("x-forwarded-for");
  const values = forwarded?.split(",");
  const last = values?.[values.length - 1]?.trim();
  return last || req?.headers.get("x-real-ip") || "unknown";
}

export async function createTRPCContext(opts?: {
  req?: Request;
  afterResponse?: (task: () => void | Promise<void>) => void;
}) {
  const session = await getServerSession(authOptions);
  const ip = clientIp(opts?.req);

  // Incomplete JWT, session expired (e.g. password changed), or inactive account
  if (
    !session?.user?.id ||
    !session.user.email ||
    session.error === "AccountInactive" ||
    session.error === "SessionExpired"
  ) {
    return createContext({ prisma, session: null, ip, afterResponse: opts?.afterResponse });
  }

  // ALWAYS fetch the employee's authoritative organizationId and role from the DB.
  // Never trust a stale token or session fallback for multi-tenant isolation.
  const emp = await prisma.employee.findUnique({
    where: { id: session.user.id },
    select: { organizationId: true, role: true, employeeCode: true, status: true },
  });

  if (!emp || emp.status === "EXIT" || emp.status === "TERMINATED") {
    return createContext({ prisma, session: null, ip, afterResponse: opts?.afterResponse });
  }

  const organizationId = emp.organizationId || "org_default_realty";

  return createContext({
    prisma,
    ip,
    afterResponse: opts?.afterResponse,
    session: {
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name ?? "",
        role: (emp.role as Role) || (session.user.role as Role) || "EMPLOYEE",
        employeeCode: emp.employeeCode || session.user.employeeCode || "",
        organizationId,
      },
    },
  });
}
