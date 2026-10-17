import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      employeeCode: string;
    } & DefaultSession["user"];
    error?: "AccountInactive";
  }

  interface User {
    role: string;
    employeeCode: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    employeeCode?: string;
    status?: string;
    statusCheckedAt?: number;
    error?: "AccountInactive";
  }
}
