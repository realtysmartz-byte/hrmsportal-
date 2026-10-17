import type { PrismaClient } from "@realty-smartz/db";
import type { Role } from "@realty-smartz/shared";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  employeeCode: string;
};

export type Session = {
  user: SessionUser;
} | null;

export type CreateContextOptions = {
  session: Session;
  prisma: PrismaClient;
  /** Client IP for rate limits only — never logged with secrets */
  ip?: string | null;
  afterResponse?: (task: () => void | Promise<void>) => void;
};

export function createContext({
  session,
  prisma,
  ip,
  afterResponse,
}: CreateContextOptions) {
  return { session, prisma, ip: ip ?? "unknown", afterResponse };
}

export type Context = ReturnType<typeof createContext>;
