"use client";

import { useEffect, useRef } from "react";
import { signOut, useSession } from "next-auth/react";

/**
 * When HR marks EXIT / TERMINATED / RESIGNED, JWT status check sets
 * session.error — force sign-out so the employee cannot stay in the portal.
 */
export function AccountStatusGuard() {
  const { data: session, status } = useSession();
  const signingOut = useRef(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (session?.error !== "AccountInactive") return;
    if (signingOut.current) return;
    signingOut.current = true;
    void signOut({ callbackUrl: "/login?error=AccountInactive" });
  }, [session?.error, status]);

  return null;
}
