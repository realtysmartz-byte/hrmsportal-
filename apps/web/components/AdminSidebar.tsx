"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  Users,
  Building2,
  Briefcase,
  Clock,
  MapPin,
  Navigation,
  FileText,
  Target,
  BriefcaseBusiness,
  Banknote,
  Settings,
  FileSpreadsheet,
  Bot,
  ShieldCheck,
  Mail,
  Layers,
  PanelLeft,
  SlidersHorizontal,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

interface NavItemDef {
  href: string;
  label: string;
  icon: LucideIcon;
  permission?: string;
  adminOnly?: boolean;
  superAdminOnly?: boolean;
}

interface NavGroupDef {
  title: string;
  items: NavItemDef[];
}

const navGroups: NavGroupDef[] = [
  {
    title: "Overview",
    items: [
      { href: "/admin-portal/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard" },
    ],
  },
  {
    title: "People",
    items: [
      { href: "/admin-portal/employees", label: "Employees", icon: Users, permission: "employees" },
      { href: "/admin-portal/departments", label: "Departments", icon: Building2, permission: "departments" },
      { href: "/admin-portal/designations", label: "Designations", icon: Briefcase, permission: "departments" },
    ],
  },
  {
    title: "Attendance",
    items: [
      { href: "/admin-portal/attendance/team", label: "Team Attendance", icon: Clock, permission: "attendance" },
      { href: "/admin-portal/attendance/locations", label: "Location Tracing", icon: MapPin, permission: "attendance" },
      { href: "/admin-portal/attendance/allocate-locations", label: "Allocate Locations", icon: Navigation, permission: "attendance" },
    ],
  },
  {
    title: "Work",
    items: [
      { href: "/admin-portal/leave/approvals", label: "Leave Approvals", icon: FileText, permission: "leave" },
      { href: "/admin-portal/performance", label: "Performance", icon: Target, permission: "performance" },
      { href: "/admin-portal/recruitment", label: "Recruitment", icon: BriefcaseBusiness, permission: "recruitment" },
      { href: "/admin-portal/payroll", label: "Payroll", icon: Banknote, permission: "payroll" },
    ],
  },
  {
    title: "Settings",
    items: [
      { href: "/admin-portal/settings/company", label: "Company Settings", icon: Settings, permission: "settings" },
      { href: "/admin-portal/settings/google-sheets", label: "Google Sheets", icon: FileSpreadsheet, permission: "settings" },
      { href: "/admin-portal/settings/telegram", label: "Automations", icon: Bot, permission: "settings" },
      { href: "/admin-portal/settings/staff-permissions", label: "Staff & Permissions", icon: ShieldCheck, adminOnly: true },
      { href: "/admin-portal/settings/leave-types", label: "Leave Types", icon: FileText, permission: "settings" },
      { href: "/admin-portal/settings/email", label: "Email Service", icon: Mail, superAdminOnly: true },
      { href: "/admin-portal/organizations", label: "Multi-Tenant", icon: Layers, superAdminOnly: true },
    ],
  },
];

interface AdminSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onCloseMobile?: () => void;
  hideCollapse?: boolean;
}

export function AdminSidebar({
  isCollapsed,
  onToggleCollapse,
  onCloseMobile,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();

  const userInitial = (session?.user?.name?.[0] || "H").toUpperCase();
  const userName = session?.user?.name || "HR Admin";
  const userRole = (session?.user?.role || "Admin").replace("_", " ");

  const { data: permData } = trpc.employee.getMyPermissions.useQuery(undefined, {
    staleTime: 60_000,
  });

  const isSuperAdmin = session?.user?.role === "ADMIN" || Boolean(permData?.isSuperAdmin);
  const isPlatformSuperAdmin =
    isSuperAdmin &&
    (session?.user?.organizationId === "org_default_realty" || !session?.user?.organizationId);
  const userPerms = permData?.permissions ?? ["dashboard", "attendance", "leave"];

  const filterItem = (item: NavItemDef) => {
    if (item.superAdminOnly) return isPlatformSuperAdmin;
    if (item.adminOnly) return isSuperAdmin;
    if (item.permission) {
      return isSuperAdmin || userPerms.includes("*") || userPerms.includes(item.permission);
    }
    return true;
  };

  return (
    <aside
      className={cn(
        "relative flex h-full max-h-[100dvh] shrink-0 flex-col select-none border-r border-[var(--line)] bg-[var(--side)] text-[var(--ink)] transition-all duration-200 ease-out",
        isCollapsed ? "w-[72px]" : "w-[264px]"
      )}
    >
      {/* Top Header: Logo 34px + Realty Smartz + HR Admin + Collapse Button */}
      <div
        className={cn(
          "flex items-center border-b border-[var(--line)] transition-all",
          isCollapsed ? "justify-center px-2 py-4 flex-col gap-2" : "justify-between px-4 py-3.5"
        )}
      >
        <Link
          href="/admin-portal/dashboard"
          onClick={onCloseMobile}
          className="flex items-center gap-3 overflow-hidden"
          title="Realty Smartz"
        >
          {/* Logo Mark: Hexagon with 3 vertical bars */}
          <div className="shrink-0 flex items-center justify-center">
            <svg
              width="34"
              height="34"
              viewBox="0 0 34 34"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="shrink-0"
            >
              <path
                d="M17 2.5L29.55 9.75V24.25L17 31.5L4.45 24.25V9.75L17 2.5Z"
                stroke="#2F7FB5"
                strokeWidth="2.6"
                strokeLinejoin="round"
              />
              <line x1="12" y1="12" x2="12" y2="22" stroke="#D6283A" strokeWidth="3.4" strokeLinecap="round" />
              <line x1="17" y1="9.5" x2="17" y2="24.5" stroke="#D6283A" strokeWidth="3.4" strokeLinecap="round" />
              <line x1="22" y1="12" x2="22" y2="22" stroke="#D6283A" strokeWidth="3.4" strokeLinecap="round" />
            </svg>
          </div>

          {!isCollapsed && (
            <div className="min-w-0">
              <span className="block truncate text-[15px] font-bold leading-tight tracking-[0.04em] text-[var(--ink)]">
                Realty Smartz
              </span>
              <span className="block truncate text-[12px] leading-tight text-[var(--muted)]">
                HR Admin
              </span>
            </div>
          )}
        </Link>

        {/* Collapse Button */}
        <button
          type="button"
          onClick={onToggleCollapse}
          title={isCollapsed ? "Expand sidebar (Ctrl+B)" : "Collapse sidebar (Ctrl+B)"}
          className="flex h-8 w-8 items-center justify-center text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--hover)] rounded transition-colors"
        >
          <PanelLeft className="h-[19px] w-[19px]" strokeWidth={1.8} />
        </button>
      </div>

      {/* Nav Groups */}
      <nav
        className={cn(
          "flex-1 overflow-y-auto overflow-x-hidden py-3 scrollbar-none space-y-4",
          isCollapsed ? "px-2" : "px-3"
        )}
      >
        {navGroups.map((group) => {
          const visibleItems = group.items.filter(filterItem);
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.title} className="space-y-1">
              {!isCollapsed && (
                <div className="px-3 pb-1 text-[12px] font-semibold text-[var(--muted)]">
                  {group.title}
                </div>
              )}

              {visibleItems.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/admin-portal/dashboard" && pathname.startsWith(`${item.href}/`));
                const Icon = item.icon;

                return (
                  <div key={item.href} className="relative group">
                    <Link
                      href={item.href}
                      onClick={onCloseMobile}
                      title={isCollapsed ? item.label : undefined}
                      className={cn(
                        "flex items-center text-[14px] font-medium h-[42px] transition-colors duration-150 rounded",
                        isCollapsed ? "justify-center px-0 w-[42px] mx-auto" : "px-3 gap-3",
                        active
                          ? "bg-[var(--active)] text-[var(--ink)] font-semibold border-l-[3px] border-[var(--accent)]"
                          : "text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--ink)]"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-[19px] w-[19px] shrink-0 transition-colors",
                          active ? "text-[var(--accent)]" : "text-[var(--muted)] group-hover:text-[var(--ink)]"
                        )}
                        strokeWidth={1.8}
                      />

                      {!isCollapsed && (
                        <span className="truncate">{item.label}</span>
                      )}
                    </Link>

                    {/* Collapsed Tooltip */}
                    {isCollapsed && (
                      <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 whitespace-nowrap rounded bg-[var(--ink)] px-2.5 py-1 text-xs font-medium text-[var(--card)] opacity-0 group-hover:opacity-100 transition-opacity shadow-md">
                        {item.label}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Bottom Profile Row */}
      <div
        className={cn(
          "border-t border-[var(--line)] bg-[var(--side)] shrink-0 transition-all",
          isCollapsed ? "p-2.5 flex flex-col items-center gap-3" : "px-4 py-3 flex items-center justify-between"
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Square Avatar 36px radius 4px with online dot */}
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded bg-[var(--accent)] text-white font-bold text-sm">
            {session?.user?.image ? (
              <img
                src={session.user.image}
                alt={userName}
                className="h-full w-full object-cover rounded"
                referrerPolicy="no-referrer"
              />
            ) : (
              userInitial
            )}
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[var(--ok)] ring-2 ring-[var(--side)]" />
          </div>

          {!isCollapsed && (
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-[var(--ink)] leading-tight">
                {userName}
              </p>
              <p className="truncate text-[12px] text-[var(--muted)] leading-tight capitalize">
                {userRole.toLowerCase()}
              </p>
            </div>
          )}
        </div>

        {/* Right utility buttons: Settings (34px) & Logout (34px) */}
        {!isCollapsed ? (
          <div className="flex items-center gap-1 shrink-0">
            <Link
              href="/admin-portal/settings/company"
              onClick={onCloseMobile}
              title="Settings"
              className="flex h-[34px] w-[34px] items-center justify-center rounded text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--hover)] transition-colors"
            >
              <SlidersHorizontal className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </Link>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              title="Sign out"
              className="flex h-[34px] w-[34px] items-center justify-center rounded text-[var(--muted)] hover:text-[var(--danger)] hover:bg-[var(--hover)] transition-colors"
            >
              <LogOut className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <Link
              href="/admin-portal/settings/company"
              onClick={onCloseMobile}
              title="Settings"
              className="flex h-[34px] w-[34px] items-center justify-center rounded text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--hover)] transition-colors"
            >
              <SlidersHorizontal className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </Link>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              title="Sign out"
              className="flex h-[34px] w-[34px] items-center justify-center rounded text-[var(--muted)] hover:text-[var(--danger)] hover:bg-[var(--hover)] transition-colors"
            >
              <LogOut className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
