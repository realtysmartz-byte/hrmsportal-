"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  Users,
  Network,
  Building2,
  Briefcase,
  LogOut,
  UserPlus,
  Clock,
  CalendarDays,
  Settings,
  FileText,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  canManageEmployees,
  canManageOrg,
  canViewTeamAttendance,
  canApproveLeave,
  canManageCompanySettings,
  canManageLeaveTypes,
} from "@realty-smartz/shared";
import type { Role } from "@realty-smartz/shared";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  visible: (role: Role) => boolean;
};

const navItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    visible: () => true,
  },
  {
    href: "/attendance",
    label: "Attendance",
    icon: Clock,
    visible: () => true,
  },
  {
    href: "/attendance/team",
    label: "Team Attendance",
    icon: Users,
    visible: canViewTeamAttendance,
  },
  {
    href: "/leave",
    label: "Leave",
    icon: CalendarDays,
    visible: () => true,
  },
  {
    href: "/leave/approvals",
    label: "Leave Approvals",
    icon: FileText,
    visible: canApproveLeave,
  },
  {
    href: "/employees",
    label: "Employees",
    icon: Users,
    visible: () => true,
  },
  {
    href: "/org-chart",
    label: "Org Chart",
    icon: Network,
    visible: () => true,
  },
  {
    href: "/departments",
    label: "Departments",
    icon: Building2,
    visible: canManageOrg,
  },
  {
    href: "/designations",
    label: "Designations",
    icon: Briefcase,
    visible: canManageOrg,
  },
  {
    href: "/settings/leave-types",
    label: "Leave Types",
    icon: FileText,
    visible: canManageLeaveTypes,
  },
  {
    href: "/settings/company",
    label: "Company Settings",
    icon: Settings,
    visible: canManageCompanySettings,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = (session?.user?.role ?? "EMPLOYEE") as Role;
  const canManage = canManageEmployees(role);

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-white">
      <div className="border-b px-4 py-5">
        <Logo />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems
          .filter((item) => item.visible(role))
          .map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/attendance" &&
                item.href !== "/leave" &&
                pathname.startsWith(`${item.href}/`)) ||
              (item.href === "/attendance" && pathname === "/attendance") ||
              (item.href === "/leave" && pathname === "/leave");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-brand-teal text-white"
                    : "text-brand-text/80 hover:bg-brand-teal/10 hover:text-brand-teal"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}

        {canManage && (
          <Link
            href="/admin-portal/employees/new"
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
              pathname === "/employees/new"
                ? "bg-brand-teal text-white"
                : "text-brand-text/80 hover:bg-brand-teal/10 hover:text-brand-teal"
            )}
          >
            <UserPlus className="h-4 w-4" />
            Add Employee
          </Link>
        )}
      </nav>

      <div className="border-t p-4">
        <Link
          href="/app"
          className="mb-3 flex items-center gap-2 rounded-md bg-brand-teal/10 px-3 py-2 text-xs font-semibold text-brand-teal"
        >
          Open Employee App
        </Link>
        <div className="mb-3">
          <p className="truncate text-sm font-medium">{session?.user?.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {session?.user?.employeeCode} · {role} · Admin Portal
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
