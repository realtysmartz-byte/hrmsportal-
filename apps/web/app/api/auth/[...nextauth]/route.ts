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

export async function GET(req: NextRequest, ctx: any) {
  return NextAuth(req, ctx, getDynamicAuthOptions(req));
}

export async function POST(req: NextRequest, ctx: any) {
  return NextAuth(req, ctx, getDynamicAuthOptions(req));
}
