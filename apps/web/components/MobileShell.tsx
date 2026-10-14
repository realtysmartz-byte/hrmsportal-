"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  Home,
  Clock,
  CalendarDays,
  User,
  LogOut,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";
import { canAccessAdminPortal } from "@realty-smartz/shared";
import type { Role } from "@realty-smartz/shared";

const tabs = [
  { href: "/app", label: "Home", icon: Home, exact: true },
  { href: "/app/attendance", label: "Attendance", icon: Clock },
  { href: "/app/leave", label: "Leave", icon: CalendarDays },
  { href: "/app/profile", label: "Profile", icon: User },
];

export function MobileShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = (session?.user?.role ?? "EMPLOYEE") as Role;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-brand-bg md:my-0 md:min-h-screen md:border-x md:border-border">
      <header className="sticky top-0 z-20 border-b bg-white/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <Logo className="scale-90 origin-left" />
          <div className="flex items-center gap-2">
            {canAccessAdminPortal(role) && (
              <Link
                href="/admin-portal/dashboard"
                className="rounded-md bg-brand-teal/10 px-2 py-1 text-[10px] font-semibold text-brand-teal"
              >
                Admin
              </Link>
            )}
            <button
              type="button"
              aria-label="Sign out"
              className="rounded-full p-2 text-muted-foreground hover:bg-muted"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {session?.user?.name} · Employee App
        </p>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 pb-24">{children}</main>

      <nav className="fixed bottom-0 left-1/2 z-20 w-full max-w-md -translate-x-1/2 border-t bg-white px-2 pb-[env(safe-area-inset-bottom)] pt-1">
        <ul className="grid grid-cols-4">
          {tabs.map((tab) => {
            const active = tab.exact
              ? pathname === tab.href
              : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            const Icon = tab.icon;
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  className={cn(
                    "flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium",
                    active ? "text-brand-teal" : "text-muted-foreground"
                  )}
                >
                  <Icon className={cn("h-5 w-5", active && "stroke-[2.5px]")} />
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
