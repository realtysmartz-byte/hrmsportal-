"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  Network,
  Building2,
  Briefcase,
  UserPlus,
  Clock,
  FileText,
  Settings,
  BriefcaseBusiness,
  ArrowLeftRight,
  ChevronRight,
  Award,
  PanelLeftClose,
  PanelLeftOpen,
  MapPin,
  Navigation,
  Download,
  FileSpreadsheet,
  Mail,
  Bot,
  Power,
} from "lucide-react";
import { InstallGuideModal } from "@/components/InstallGuideModal";
import { cn } from "@/lib/utils";

const coreNavItems = [
  { href: "/admin-portal/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin-portal/employees", label: "Employees", icon: Users },
  { href: "/admin-portal/org-chart", label: "Org Chart", icon: Network },
  { href: "/admin-portal/departments", label: "Departments", icon: Building2 },
  { href: "/admin-portal/designations", label: "Designations", icon: Briefcase },
  { href: "/admin-portal/attendance/team", label: "Team Attendance", icon: Clock },
  { href: "/admin-portal/attendance/locations", label: "Location Tracing", icon: MapPin },
  { href: "/admin-portal/attendance/allocate-locations", label: "Allocate Locations", icon: Navigation },
  { href: "/admin-portal/leave/approvals", label: "Leave Approvals", icon: FileText },
  { href: "/admin-portal/performance", label: "Performance", icon: Award },
  { href: "/admin-portal/recruitment", label: "Recruitment", icon: BriefcaseBusiness },
];

const settingsNavItems = [
  { href: "/admin-portal/settings/leave-types", label: "Leave Types", icon: FileText },
  { href: "/admin-portal/settings/company", label: "Company Settings", icon: Settings },
  { href: "/admin-portal/settings/google-sheets", label: "Google Sheets Sync", icon: FileSpreadsheet },
  { href: "/admin-portal/settings/email", label: "Email Service", icon: Mail },
  { href: "/admin-portal/settings/telegram", label: "Automations", icon: Bot },
];

interface AdminSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onCloseMobile?: () => void;
}

export function AdminSidebar({
  isCollapsed,
  onToggleCollapse,
  onCloseMobile,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [showInstallModal, setShowInstallModal] = useState(false);

  const userInitial = session?.user?.name?.[0] ?? "H";
  const userName = session?.user?.name ?? "HR Admin";
  const userRole = (session?.user?.role ?? "ADMIN").replace("_", " ");

  return (
    <aside
      className={cn(
        "relative flex h-full max-h-[100dvh] w-full shrink-0 flex-col select-none overflow-x-hidden border-r border-white/[0.08] bg-[#0B1024] text-white transition-all duration-300 ease-in-out shadow-2xl",
        isCollapsed ? "w-[76px]" : "w-[260px]"
      )}
    >
      {/* Brand & Stretch/Collapse Header */}
      <div
        className={cn(
          "flex items-center border-b border-white/[0.08] transition-all",
          isCollapsed ? "flex-col gap-2 py-3 px-2 justify-center" : "justify-between px-4 py-4"
        )}
      >
        <Link
          href="/admin-portal/dashboard"
          onClick={onCloseMobile}
          className="flex items-center gap-3 overflow-hidden group"
          title="Realty Smartz Private Limited"
        >
          {/* Logo container without any white box or white background */}
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center transition-transform group-hover:scale-105">
            <img
              src="/logo.png"
              alt="Realty Smartz"
              width={34}
              height={34}
              className="h-8 w-8 object-contain drop-shadow-md"
            />
          </div>

          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2 }}
              className="min-w-0"
            >
              <span className="font-display text-[15px] font-bold tracking-tight text-white block truncate leading-tight">
                Realty Smartz
              </span>
              <span className="text-[10px] font-medium text-[#8E9BB5] block truncate tracking-wider mt-0.5">
                People • Process • Progress
              </span>
            </motion.div>
          )}
        </Link>

        {/* Stretch / Collapse Action Button (Desktop Only) */}
        <button
          type="button"
          onClick={onToggleCollapse}
          title={isCollapsed ? "Expand sidebar (Ctrl+B)" : "Collapse sidebar (Ctrl+B)"}
          className={cn(
            "hidden lg:flex items-center justify-center rounded-xl bg-white/[0.04] text-neutral-400 hover:bg-white/[0.08] hover:text-white transition-all active:scale-95 border border-white/[0.06]",
            isCollapsed ? "h-7 w-7" : "h-8 w-8"
          )}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="h-4 w-4 text-[#7957FF]" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Main Navigation Items */}
      <nav
        className={cn(
          "flex-1 overflow-y-auto overflow-x-hidden py-3 overscroll-contain scrollbar-none",
          isCollapsed ? "px-2 space-y-2.5" : "px-3 space-y-5"
        )}
        style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}
      >
        {/* Section: Core Operations */}
        <div className="space-y-1">
          {!isCollapsed && (
            <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#636B83]">
              Navigation
            </div>
          )}

          {coreNavItems.map((item) => {
            const active =
              pathname === item.href || (item.href !== "/admin-portal/dashboard" && pathname.startsWith(`${item.href}/`));
            const Icon = item.icon;

            return (
              <div key={item.href} className="relative group">
                <Link
                  href={item.href}
                  onClick={onCloseMobile}
                  className={cn(
                    "flex items-center rounded-xl text-xs font-medium transition-all duration-200",
                    isCollapsed ? "justify-center px-0 h-10 w-10 mx-auto" : "gap-3 px-3.5 py-2.5",
                    active
                      ? "bg-[#6D28D9] text-white font-semibold shadow-[0_4px_16px_rgba(109,40,217,0.35)]"
                      : "text-[#9AA5BE] hover:bg-white/[0.06] hover:text-white"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-transform group-hover:scale-105",
                      active ? "text-white" : "text-[#7B87A0] group-hover:text-white"
                    )}
                  />

                  {!isCollapsed && (
                    <span className="truncate">{item.label}</span>
                  )}

                  {!isCollapsed && active && (
                    <ChevronRight className="ml-auto h-3.5 w-3.5 text-white/80 shrink-0" />
                  )}
                </Link>

                {/* Floating Tooltip in Collapsed Dock Mode */}
                {isCollapsed && (
                  <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 whitespace-nowrap rounded-xl bg-[#111936] border border-white/10 px-3 py-1.5 text-xs font-semibold text-white opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 shadow-lg">
                    {item.label}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Section: Management & Settings */}
        <div className="space-y-1">
          {!isCollapsed && (
            <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#636B83]">
              Settings & Portal
            </div>
          )}

          {settingsNavItems.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <div key={item.href} className="relative group">
                <Link
                  href={item.href}
                  onClick={onCloseMobile}
                  className={cn(
                    "flex items-center rounded-xl text-xs font-medium transition-all duration-200",
                    isCollapsed ? "justify-center px-0 h-10 w-10 mx-auto" : "gap-3 px-3.5 py-2.5",
                    active
                      ? "bg-[#6D28D9] text-white font-semibold shadow-[0_4px_16px_rgba(109,40,217,0.35)]"
                      : "text-[#9AA5BE] hover:bg-white/[0.06] hover:text-white"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-transform group-hover:scale-105",
                      active ? "text-white" : "text-[#7B87A0] group-hover:text-white"
                    )}
                  />

                  {!isCollapsed && (
                    <span className="truncate">{item.label}</span>
                  )}
                </Link>

                {/* Tooltip for collapsed dock mode */}
                {isCollapsed && (
                  <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 whitespace-nowrap rounded-xl bg-[#111936] border border-white/10 px-3 py-1.5 text-xs font-semibold text-white opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 shadow-lg">
                    {item.label}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Quick Add Employee Action */}
        {!isCollapsed && (
          <div className="pt-1">
            <Link
              href="/admin-portal/employees/new"
              onClick={onCloseMobile}
              className="flex items-center justify-between rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-3.5 py-2.5 text-xs font-medium text-neutral-300 hover:border-[#7957FF]/60 hover:text-white hover:bg-[#7957FF]/10 transition-all group"
            >
              <span className="flex items-center gap-2">
                <UserPlus className="h-3.5 w-3.5 text-[#7957FF] group-hover:scale-110 transition-transform" />
                Add Employee
              </span>
              <span className="text-[10px] font-bold text-[#A78BFA] bg-[#7957FF]/15 px-2 py-0.5 rounded-full">
                +New
              </span>
            </Link>
          </div>
        )}

        {/* Motivational skyscraper card as in reference design */}
        {!isCollapsed && (
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#121833] to-[#0A0E20] p-3.5 shadow-md">
            <div className="relative z-10 max-w-[130px]">
              <p className="text-xs font-bold leading-snug text-white">
                Better People
              </p>
              <p className="text-xs font-bold leading-snug text-white/90">
                Build Better
              </p>
              <p className="text-xs font-bold leading-snug text-[#7957FF]">
                Tomorrow
              </p>
            </div>
            {/* Background skyscraper graphic */}
            <div className="absolute right-0 top-0 bottom-0 w-[95px] overflow-hidden opacity-45 pointer-events-none">
              <img
                src="/skyscraper-hero.jpg"
                alt=""
                className="h-full w-full object-cover object-left mix-blend-luminosity"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#121833] via-transparent to-transparent" />
            </div>
          </div>
        )}
      </nav>

      {/* Dock Stretch Trigger Button (When Collapsed) */}
      {isCollapsed && (
        <div className="p-2 border-t border-white/[0.08] flex justify-center shrink-0">
          <button
            type="button"
            onClick={onToggleCollapse}
            title="Expand sidebar (Ctrl+B)"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04] text-[#7957FF] hover:bg-[#7957FF]/10 hover:text-white transition-all active:scale-95 border border-white/[0.06]"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Footer Profile & Portal Switcher */}
      <div className={cn("border-t border-white/[0.08] space-y-2 bg-[#080D1D] shrink-0", isCollapsed ? "p-2" : "p-3")}>
        {/* Install App Button */}
        <button
          type="button"
          onClick={() => setShowInstallModal(true)}
          className={cn(
            "flex w-full items-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-xs font-medium text-neutral-300 hover:bg-white/[0.07] hover:text-white transition-all",
            isCollapsed ? "justify-center px-0 h-10 w-10 mx-auto" : "justify-between px-3 py-2"
          )}
          title="Install Realty Smartz App (Mobile & Desktop)"
        >
          <span className="flex items-center gap-2">
            <Download className="h-3.5 w-3.5 text-[#A78BFA]" />
            {!isCollapsed && <span>Install App</span>}
          </span>
          {!isCollapsed && (
            <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/90">
              Install
            </span>
          )}
        </button>

        {/* Switch to Employee Portal Button */}
        <Link
          href="/employee-portal/dashboard"
          onClick={onCloseMobile}
          className={cn(
            "flex items-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-xs font-medium text-neutral-300 hover:bg-white/[0.07] hover:text-white transition-all",
            isCollapsed ? "justify-center px-0 h-10 w-10 mx-auto" : "justify-between px-3 py-2"
          )}
          title="Switch to Employee Portal"
        >
          <span className="flex items-center gap-2">
            <ArrowLeftRight className="h-3.5 w-3.5 text-[#7957FF]" />
            {!isCollapsed && <span>Employee Portal</span>}
          </span>
          {!isCollapsed && <ChevronRight className="h-3.5 w-3.5 text-neutral-500" />}
        </Link>

        {/* User Card as in reference design */}
        <div
          className={cn(
            "flex items-center rounded-xl bg-white/[0.03] border border-white/[0.08] transition-all",
            isCollapsed ? "flex-col gap-1.5 p-1.5" : "justify-between p-2.5"
          )}
        >
          <Link
            href="/admin-portal/settings/company"
            onClick={onCloseMobile}
            className="flex items-center gap-2.5 min-w-0 flex-1 hover:opacity-90 transition-opacity"
          >
            <div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#6D28D9] text-xs font-bold text-white shadow-md">
              {session?.user?.image ? (
                <img
                  src={session.user.image}
                  alt={userName}
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                userInitial
              )}
              <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-[#0B1024]" />
            </div>

            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-white">
                  {userName}
                </p>
                <p className="truncate text-[10px] text-[#8E9BB5] uppercase tracking-wider">
                  {userRole}
                </p>
              </div>
            )}
          </Link>

          {!isCollapsed && (
            <ChevronRight className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
          )}
        </div>

        {/* Bottom utility bar: Settings & Sign out */}
        {!isCollapsed && (
          <div className="flex items-center justify-between px-1 pt-1 text-xs text-[#8E9BB5]">
            <Link
              href="/admin-portal/settings/company"
              onClick={onCloseMobile}
              className="flex items-center gap-1.5 hover:text-white transition-colors"
            >
              <Settings className="h-3.5 w-3.5" />
              <span>Settings</span>
            </Link>
            <button
              type="button"
              title="Sign out of Realty Smartz"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex items-center justify-center h-6 w-6 rounded-lg text-neutral-400 hover:bg-rose-500/20 hover:text-rose-400 transition-colors"
            >
              <Power className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      <InstallGuideModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
      />
    </aside>
  );
}

