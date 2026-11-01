import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      employeeCode: string;
    } & DefaultSession["user"];
    error?: "AccountInactive" | "SessionExpired";
  }

  interface User {
    role: string;
    employeeCode: string;
    pwdSig?: string;
    loginAt?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    employeeCode?: string;
    picture?: string | null;
    status?: string;
    statusCheckedAt?: number;
    pwdSig?: string;
    loginAt?: number;
    error?: "AccountInactive" | "SessionExpired";
  }
}
