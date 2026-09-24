import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@realty-smartz/db";
import { canAccessAdminPortal, loginSchema } from "@realty-smartz/shared";
import type { Role } from "@realty-smartz/shared";

const googleConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_CLIENT_ID.length > 10 &&
    process.env.GOOGLE_CLIENT_SECRET.length > 5
);

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          const parsed = loginSchema.safeParse({
            email: credentials?.email?.toString().trim().toLowerCase(),
            password: credentials?.password?.toString() ?? "",
          });
          if (!parsed.success) return null;

          const employee = await prisma.employee.findUnique({
            where: { email: parsed.data.email },
          });

          if (!employee) {
            console.warn("[auth] no employee for", parsed.data.email);
            return null;
          }
          if (
            employee.status === "RESIGNED" ||
            employee.status === "TERMINATED"
          ) {
            return null;
          }

          const valid = await bcrypt.compare(
            parsed.data.password,
            employee.passwordHash
          );
          if (!valid) {
            console.warn("[auth] bad password for", parsed.data.email);
            return null;
          }

          return {
            id: employee.id,
            email: employee.email,
            name: `${employee.firstName} ${employee.lastName}`,
            role: employee.role,
            employeeCode: employee.employeeCode,
          };
        } catch (error) {
          console.error("[auth] authorize failed:", error);
          return null;
        }
      },
    }),
    ...(googleConfigured
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        const email = user.email?.toLowerCase().trim();
        if (!email) return false;

        const employee = await prisma.employee.findUnique({
          where: { email },
        });

        if (!employee) {
          return "/login?error=GoogleNotLinked&portal=employee";
        }
        if (
          employee.status === "RESIGNED" ||
          employee.status === "TERMINATED"
        ) {
          return "/login?error=AccountInactive&portal=employee";
        }
        if (canAccessAdminPortal(employee.role as Role)) {
          return "/login?error=GoogleEmployeeOnly&portal=employee";
        }
        return true;
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        if (account?.provider === "google" && user.email) {
          const employee = await prisma.employee.findUnique({
            where: { email: user.email.toLowerCase().trim() },
          });
          if (employee) {
            token.id = employee.id;
            token.role = employee.role;
            token.employeeCode = employee.employeeCode;
            token.email = employee.email;
          }
        } else {
          token.id = user.id;
          token.role = (user as { role: string }).role;
          token.employeeCode = (user as { employeeCode: string }).employeeCode;
          token.email = user.email;
        }
      }

      // Repair incomplete tokens (common after OAuth / env restarts)
      if ((!token.id || !token.role) && token.email) {
        const employee = await prisma.employee.findUnique({
          where: { email: String(token.email).toLowerCase().trim() },
        });
        if (employee) {
          token.id = employee.id;
          token.role = employee.role;
          token.employeeCode = employee.employeeCode;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.role = (token.role as string) || "EMPLOYEE";
        session.user.employeeCode = (token.employeeCode as string) || "";
        if (token.email) session.user.email = token.email as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
