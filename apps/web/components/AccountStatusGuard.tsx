"use client";

import { useEffect, useRef } from "react";
import { signOut, useSession } from "next-auth/react";
import { usePathname } from "next/navigation";

/**
 * Monitors session validity in real time:
 * 1. If admin password changed -> session.error === "SessionExpired" -> kick out immediately.
 * 2. If HR marks EXIT / TERMINATED / RESIGNED -> session.error === "AccountInactive" -> kick out.
 * 3. If an admin page is open and session is lost/unauthenticated -> redirect to /login.
 */
export function AccountStatusGuard() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const signingOut = useRef(false);

  useEffect(() => {
    if (status === "loading") return;

    // Check for explicit session errors
    if (session?.error === "SessionExpired") {
      if (signingOut.current) return;
      signingOut.current = true;
      void signOut({ callbackUrl: "/login?error=SessionExpired" });
      return;
    }

    if (session?.error === "AccountInactive") {
      if (signingOut.current) return;
      signingOut.current = true;
      void signOut({ callbackUrl: "/login?error=AccountInactive" });
      return;
    }

    // If on admin portal and user has no active session, force redirect to login
    if (status === "unauthenticated" && pathname?.startsWith("/admin-portal")) {
      if (signingOut.current) return;
      signingOut.current = true;
      window.location.href = "/login?error=SessionExpired";
    }
  }, [session?.error, status, pathname]);

  return null;
}
