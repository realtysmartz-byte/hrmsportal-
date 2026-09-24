import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const role = req.nextauth.token?.role as string | undefined;
    const path = req.nextUrl.pathname;

    if (path.startsWith("/admin-portal")) {
      if (role !== "ADMIN" && role !== "HR") {
        return NextResponse.redirect(
          new URL("/employee-portal/dashboard", req.url)
        );
      }
    }

    return NextResponse.next();
  },
  {
    pages: { signIn: "/login" },
  }
);

export const config = {
  matcher: ["/admin-portal/:path*", "/employee-portal/:path*"],
};
