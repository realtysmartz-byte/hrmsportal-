"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  Home,
  Clock,
  CalendarDays,
  Users,
  Network,
  User,
  LogOut,
  UserPlus,
  UsersRound,
  Shield,
  Search,
  Award,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { canAccessAdminPortal, isManager } from "@realty-smartz/shared";
import type { Role } from "@realty-smartz/shared";

export function EmployeeTopNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = (session?.user?.role ?? "EMPLOYEE") as Role;

  const links = [
    { href: "/employee-portal/dashboard", label: "Home", icon: Home },
    { href: "/employee-portal/attendance", label: "Attendance", icon: Clock },
    { href: "/employee-portal/leave", label: "Leave", icon: CalendarDays },
    { href: "/employee-portal/directory", label: "Directory", icon: Users },
    { href: "/employee-portal/org-chart", label: "Org Chart", icon: Network },
    { href: "/employee-portal/refer", label: "Refer", icon: UserPlus },
    { href: "/employee-portal/performance", label: "Performance", icon: Award },
    ...(isManager(role)
      ? [
          { href: "/employee-portal/my-team", label: "My Team", icon: UsersRound },
          { href: "/employee-portal/performance/team-reviews", label: "Team Reviews", icon: UsersRound },
        ]
      : []),
    { href: "/employee-portal/profile", label: "Me", icon: User },
  ];

  return (
    <header className="sticky top-0 z-30 bg-teal-800 text-white shadow-sm pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <Link href="/employee-portal/dashboard" className="flex shrink-0 items-center gap-2">
            <Logo showText={false} />
            <span className="hidden font-display text-sm font-bold sm:inline">
              Realty Smartz
            </span>
          </Link>
          <div className="relative hidden max-w-md flex-1 md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-teal-200" />
            <Link
              href="/employee-portal/directory"
              className="block rounded-md bg-teal-900/50 py-1.5 pl-9 pr-3 text-caption text-teal-100 transition-colors hover:bg-teal-900/70"
            >
              Search employees by name, ID, department
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {canAccessAdminPortal(role) && (
            <Link href="/admin-portal/dashboard">
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 text-white hover:bg-teal-700 hover:text-white"
              >
                <Shield className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Admin</span>
              </Button>
            </Link>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="text-white hover:bg-teal-700 hover:text-white"
            aria-label="Sign out"
            onClick={() => signOut({ callbackUrl: "/login?portal=employee" })}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <nav className="border-t border-teal-700/60 bg-teal-800">
        <ul className="mx-auto flex max-w-7xl gap-0.5 overflow-x-auto px-2">
          {links.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-caption font-semibold transition-colors duration-150",
                    active
                      ? "border-white text-white"
                      : "border-transparent text-teal-100/80 hover:text-white"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
