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

  // Incomplete JWT or inactive account (EXIT / TERMINATED / RESIGNED)
  if (
    !session?.user?.id ||
    !session.user.email ||
    session.error === "AccountInactive"
  ) {
    return createContext({ prisma, session: null, ip, afterResponse: opts?.afterResponse });
  }

  return createContext({
    prisma,
    ip,
    afterResponse: opts?.afterResponse,
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
