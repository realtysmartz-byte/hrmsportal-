import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

function isLocalHost(hostname: string) {
  return ["localhost", "127.0.0.1", "::1"].includes(hostname.toLowerCase());
}

export async function middleware(req: NextRequest) {
  const forwardedProtos = req.headers.get("x-forwarded-proto")?.split(",");
  const forwardedProto = forwardedProtos?.[forwardedProtos.length - 1]
    ?.trim()
    .toLowerCase();
  const protocol = forwardedProto || req.nextUrl.protocol.replace(":", "");
  if (
    process.env.NODE_ENV === "production" &&
    !isLocalHost(req.nextUrl.hostname) &&
    protocol !== "https"
  ) {
    const secureUrl = req.nextUrl.clone();
    secureUrl.protocol = "https:";
    return NextResponse.redirect(secureUrl, 308);
  }

  const path = req.nextUrl.pathname;
  const isAdminPage = path.startsWith("/admin-portal");
  const isEmployeePage = path.startsWith("/employee-portal");
  if (!isAdminPage && !isEmployeePage) return NextResponse.next();

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });
  if (!token) {
    const signInUrl = new URL("/login", req.url);
    signInUrl.searchParams.set("callbackUrl", req.nextUrl.href);
    return NextResponse.redirect(signInUrl);
  }

  const role = token.role as string | undefined;
  if (isAdminPage && role !== "ADMIN" && role !== "HR") {
    return NextResponse.redirect(
      new URL("/employee-portal/dashboard", req.url)
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
