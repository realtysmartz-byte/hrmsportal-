import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import type { NextRequest } from "next/server";

function getDynamicAuthOptions(req: NextRequest) {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto =
    req.headers.get("x-forwarded-proto") ||
    (host && !host.includes("localhost") && !host.startsWith("127.0.0.1") ? "https" : "http");

  if (host) {
    const origin = `${proto}://${host}`;
    process.env.NEXTAUTH_URL = origin;
  }
  return authOptions;
}

function clearStaleChunkCookies(req: NextRequest, res: Response): Response {
  const cookieHeader = req.headers.get("cookie") || "";
  if (!cookieHeader.includes("session-token.")) {
    return res;
  }
  for (let i = 0; i <= 35; i++) {
    const chunkName = `next-auth.session-token.${i}`;
    const secureChunkName = `__Secure-next-auth.session-token.${i}`;
    if (cookieHeader.includes(chunkName) || cookieHeader.includes(secureChunkName)) {
      try {
        res.headers.append(
          "Set-Cookie",
          `${chunkName}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax`
        );
        res.headers.append(
          "Set-Cookie",
          `${secureChunkName}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax; Secure`
        );
      } catch {
        // immutable headers fallback
      }
    }
  }
  return res;
}

export async function GET(req: NextRequest, ctx: any) {
  const res = await NextAuth(req, ctx, getDynamicAuthOptions(req));
  return clearStaleChunkCookies(req, res);
}

export async function POST(req: NextRequest, ctx: any) {
  const res = await NextAuth(req, ctx, getDynamicAuthOptions(req));
  return clearStaleChunkCookies(req, res);
}
