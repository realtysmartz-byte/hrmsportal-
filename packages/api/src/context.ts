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
};

export function createContext({ session, prisma }: CreateContextOptions) {
  return { session, prisma };
}

export type Context = ReturnType<typeof createContext>;
