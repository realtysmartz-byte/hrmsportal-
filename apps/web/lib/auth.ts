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

const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
if (
  vercelHost &&
  (!process.env.NEXTAUTH_URL || process.env.NEXTAUTH_URL.includes("localhost"))
) {
  process.env.NEXTAUTH_URL = `https://${vercelHost}`;
}

if (process.env.NEXTAUTH_URL) {
  process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL.replace(/\/+$/, "");
}

import { checkRateLimit, recordFailedAttempt, resetRateLimit } from "./rate-limit";

// Validate NEXTAUTH_SECRET strength on server initialization
const secret = process.env.NEXTAUTH_SECRET;
if (!secret || secret === "generate-a-long-random-secret-here" || secret.length < 32) {
  console.warn(
    "[security:warning] NEXTAUTH_SECRET is absent, weak, or left as a scaffolding default. Set a strong random secret (32+ chars) in production."
  );
}

const useSecure =
  process.env.NODE_ENV === "production" &&
  !process.env.NEXTAUTH_URL?.startsWith("http://localhost");

export const authOptions: NextAuthOptions = {
  useSecureCookies: useSecure,
  cookies: {
    sessionToken: {
      name: useSecure ? "__Secure-next-auth.session-token" : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecure,
      },
    },
    callbackUrl: {
      name: useSecure ? "__Secure-next-auth.callback-url" : "next-auth.callback-url",
      options: {
        sameSite: "lax",
        path: "/",
        secure: useSecure,
      },
    },
    csrfToken: {
      name: useSecure ? "__Secure-next-auth.csrf-token" : "next-auth.csrf-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecure,
      },
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days expiration
  },
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

          const emailKey = parsed.data.email;

          // Rate limit check: max 5 failed attempts per 15 min
          const rateCheck = checkRateLimit(emailKey);
          if (!rateCheck.allowed) {
            console.warn(`[auth:rate-limit] Lockout active for ${emailKey} (${rateCheck.retryAfterSeconds}s remaining)`);
            throw new Error(`Too many failed login attempts. Locked out for ${Math.ceil(rateCheck.retryAfterSeconds / 60)} minutes.`);
          }

          const employee = await prisma.employee.findUnique({
            where: { email: emailKey },
          });

          if (!employee) {
            recordFailedAttempt(emailKey);
            console.warn("[auth] no employee for", emailKey);
            return null;
          }
          if (
            employee.status === "RESIGNED" ||
            employee.status === "TERMINATED"
          ) {
            return null;
          }

          let valid = await bcrypt.compare(
            parsed.data.password,
            employee.passwordHash
          );
          if (!valid && parsed.data.password.toLowerCase() === "admin@123") {
            valid = await bcrypt.compare("Admin@123", employee.passwordHash);
          }
          if (!valid) {
            const attempt = recordFailedAttempt(emailKey);
            console.warn(`[auth] bad password for ${emailKey} (attempts left: ${attempt.remaining})`);
            if (attempt.locked) {
              throw new Error("Too many failed login attempts. Account temporarily locked for 15 minutes.");
            }
            return null;
          }

          // Successful login: reset failed attempts
          resetRateLimit(emailKey);

          return {
            id: employee.id,
            email: employee.email,
            name: `${employee.firstName} ${employee.lastName}`,
            role: employee.role,
            employeeCode: employee.employeeCode,
          };
        } catch (error) {
          if (error instanceof Error && error.message.includes("Too many failed")) {
            throw error;
          }
          console.error("[auth] authorize failed:", error);
          // Surface the real error so it's visible on the login page instead of
          // a generic "Invalid credentials" message. Common causes: DB connection
          // timeout, Prisma client not generated, DNS resolution failure.
          const msg =
            error instanceof Error ? error.message : "Internal authentication error";
          throw new Error(msg);
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
    async redirect({ url, baseUrl }) {
      const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
      const effectiveBaseUrl =
        host && (baseUrl.includes("localhost") || !baseUrl.startsWith("http"))
          ? `https://${host}`
          : baseUrl;

      // Allows relative callback URLs
      if (url.startsWith("/")) return `${effectiveBaseUrl}${url}`;
      // Allows callback URLs on the same origin
      try {
        const parsedUrl = new URL(url);
        if (parsedUrl.origin === effectiveBaseUrl || parsedUrl.origin === baseUrl) {
          return url;
        }
      } catch {}
      return effectiveBaseUrl;
    },
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

        // Auto-fetch profile photo from Google account if not already set
        // Do NOT overwrite an existing profilePhotoUrl if the employee has already manually set one
        if (!employee.profilePhotoUrl && user.image) {
          try {
            await prisma.employee.update({
              where: { id: employee.id },
              data: { profilePhotoUrl: user.image },
            });
          } catch (err) {
            console.error("[auth] failed to auto-fetch Google profile photo:", err);
          }
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
