import { getServerSession } from "next-auth";
import { createContext } from "@realty-smartz/api";
import { prisma } from "@realty-smartz/db";
import type { Role } from "@realty-smartz/shared";
import { authOptions } from "@/lib/auth";

export async function createTRPCContext() {
  const session = await getServerSession(authOptions);

  // Incomplete JWT or inactive account (EXIT / TERMINATED / RESIGNED)
  if (
    !session?.user?.id ||
    !session.user.email ||
    session.error === "AccountInactive"
  ) {
    return createContext({ prisma, session: null });
  }

  return createContext({
    prisma,
    session: {
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name ?? "",
        role: (session.user.role as Role) || "EMPLOYEE",
        employeeCode: session.user.employeeCode || "",
      },
    },
  });
}
