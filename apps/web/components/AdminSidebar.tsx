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
  FileText,
  Settings,
  BriefcaseBusiness,
  ArrowLeftRight,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin-portal/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin-portal/employees", label: "Employees", icon: Users },
  { href: "/admin-portal/org-chart", label: "Org Chart", icon: Network },
  { href: "/admin-portal/departments", label: "Departments", icon: Building2 },
  { href: "/admin-portal/designations", label: "Designations", icon: Briefcase },
  { href: "/admin-portal/attendance/team", label: "Team Attendance", icon: Clock },
  { href: "/admin-portal/leave/approvals", label: "Leave Approvals", icon: FileText },
  { href: "/admin-portal/performance", label: "Performance", icon: Briefcase },
  { href: "/admin-portal/recruitment", label: "Recruitment", icon: BriefcaseBusiness },
  { href: "/admin-portal/settings/leave-types", label: "Leave Types", icon: FileText },
  { href: "/admin-portal/settings/company", label: "Company Settings", icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-neutral-200 bg-white pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="border-b border-neutral-200 px-4 py-5">
        <Logo />
        <p className="mt-2 text-caption font-semibold uppercase tracking-wide text-teal-700">
          Admin Portal
        </p>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {navItems.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-teal-600 text-white"
                  : "text-neutral-700 hover:bg-teal-50 hover:text-teal-800"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
        <Link
          href="/admin-portal/employees/new"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
            pathname === "/admin-portal/employees/new"
              ? "bg-teal-600 text-white"
              : "text-neutral-700 hover:bg-teal-50 hover:text-teal-800"
          )}
        >
          <UserPlus className="h-4 w-4" />
          Add Employee
        </Link>
      </nav>

      <div className="space-y-2 border-t border-neutral-200 p-4">
        <Link
          href="/employee-portal/dashboard"
          className="flex items-center gap-2 rounded-lg bg-teal-50 px-3 py-2 text-caption font-semibold text-teal-800"
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
          View My Employee Portal
        </Link>
        <div>
          <p className="truncate text-sm font-medium">{session?.user?.name}</p>
          <p className="truncate text-caption text-neutral-500">
            {session?.user?.employeeCode} · {session?.user?.role}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={() => signOut({ callbackUrl: "/login?portal=admin" })}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
