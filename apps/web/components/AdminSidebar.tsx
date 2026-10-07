"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
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
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  Award,
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
  MapPin,
  Navigation,
  Download,
  FileSpreadsheet,
  Mail,
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

  const userInitial = session?.user?.name?.[0] ?? "A";
  const userName = session?.user?.name ?? "Administrator";
  const userRole = (session?.user?.role ?? "ADMIN").replace("_", " ");

  return (
    <aside
      className={cn(
        "relative flex h-full max-h-screen shrink-0 flex-col bg-[#11121A] text-white border-r border-white/10 shadow-2xl transition-all duration-300 ease-in-out select-none overflow-x-hidden",
        isCollapsed ? "w-[76px]" : "w-[260px]"
      )}
    >
      {/* Brand & Stretch/Collapse Header */}
      <div
        className={cn(
          "flex items-center border-b border-white/10 transition-all",
          isCollapsed ? "flex-col gap-2 py-3 px-2 justify-center" : "justify-between px-4 py-4"
        )}
      >
        <Link
          href="/admin-portal/dashboard"
          onClick={onCloseMobile}
          className="flex items-center gap-3 overflow-hidden group"
          title="Realty Smartz Private Limited"
        >
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#181926] border border-white/10 shadow-md group-hover:border-[#FF7A70]/50 transition-colors">
            <img
              src="/logo.png"
              alt="Realty Smartz"
              width={26}
              height={26}
              className="h-6 w-6 object-contain drop-shadow"
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
              <span className="font-display text-sm font-bold tracking-tight text-white block truncate">
                Realty Smartz
              </span>
              <span className="text-[10px] font-medium text-neutral-400 block truncate -mt-0.5">
                Private Limited · Admin
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
            "hidden lg:flex items-center justify-center rounded-xl bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white transition-all active:scale-95 border border-white/5",
            isCollapsed ? "h-7 w-7" : "h-8 w-8"
          )}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="h-4 w-4 text-[#FF7A70]" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Main Navigation Items */}
      <nav
        className={cn(
          "flex-1 overflow-y-auto overflow-x-hidden py-3 overscroll-contain scrollbar-none",
          isCollapsed ? "px-2 space-y-3" : "px-3 space-y-6"
        )}
        style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}
      >
        {/* Section: Core Operations */}
        <div className="space-y-1">
          {!isCollapsed && (
            <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Core Operations
            </div>
          )}

          {coreNavItems.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <div key={item.href} className="relative group">
                <Link
                  href={item.href}
                  onClick={onCloseMobile}
                  className={cn(
                    "flex items-center rounded-2xl text-xs font-semibold transition-all duration-200",
                    isCollapsed ? "justify-center px-0 h-10 w-10 mx-auto" : "gap-3 px-3 py-2.5",
                    active
                      ? "bg-gradient-to-r from-[#FF7A70] to-[#FFA07A] text-white shadow-[0_4px_20px_rgba(255,122,112,0.35)]"
                      : "text-neutral-400 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-transform group-hover:scale-105",
                      active ? "text-white" : "text-neutral-400 group-hover:text-white"
                    )}
                  />

                  {!isCollapsed && (
                    <span className="truncate">{item.label}</span>
                  )}

                  {!isCollapsed && active && (
                    <div className="ml-auto h-1.5 w-1.5 rounded-full bg-white shadow-xs" />
                  )}
                </Link>

                {/* Floating Tooltip in Collapsed Dock Mode */}
                {isCollapsed && (
                  <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 whitespace-nowrap rounded-xl bg-[#1E202E] border border-white/10 px-3 py-1.5 text-xs font-semibold text-white shadow-xl opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150">
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
            <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
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
                    "flex items-center rounded-2xl text-xs font-semibold transition-all duration-200",
                    isCollapsed ? "justify-center px-0 h-10 w-10 mx-auto" : "gap-3 px-3 py-2.5",
                    active
                      ? "bg-gradient-to-r from-[#FF7A70] to-[#FFA07A] text-white shadow-[0_4px_20px_rgba(255,122,112,0.35)]"
                      : "text-neutral-400 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-transform group-hover:scale-105",
                      active ? "text-white" : "text-neutral-400 group-hover:text-white"
                    )}
                  />

                  {!isCollapsed && (
                    <span className="truncate">{item.label}</span>
                  )}
                </Link>

                {/* Tooltip for collapsed dock mode */}
                {isCollapsed && (
                  <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 whitespace-nowrap rounded-xl bg-[#1E202E] border border-white/10 px-3 py-1.5 text-xs font-semibold text-white shadow-xl opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150">
                    {item.label}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Quick Add Employee Action */}
        {!isCollapsed && (
          <div className="pt-2">
            <Link
              href="/admin-portal/employees/new"
              onClick={onCloseMobile}
              className="flex items-center justify-between rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-3.5 py-2.5 text-xs font-semibold text-neutral-300 hover:border-[#FF7A70]/60 hover:text-white hover:bg-[#FF7A70]/10 transition-all group"
            >
              <span className="flex items-center gap-2">
                <UserPlus className="h-3.5 w-3.5 text-[#FF7A70] group-hover:scale-110 transition-transform" />
                Add Employee
              </span>
              <span className="text-[10px] font-bold text-[#FFA07A] bg-[#FFA07A]/15 px-2 py-0.5 rounded-full">
                +New
              </span>
            </Link>
          </div>
        )}
      </nav>

      {/* Dock Stretch Trigger Button (When Collapsed) */}
      {isCollapsed && (
        <div className="p-2 border-t border-white/10 flex justify-center shrink-0">
          <button
            type="button"
            onClick={onToggleCollapse}
            title="Expand sidebar (Ctrl+B)"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-[#FF7A70] hover:bg-[#FF7A70]/10 hover:text-white transition-all active:scale-95 border border-white/5"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Footer Profile & Portal Switcher */}
      <div className={cn("border-t border-white/10 space-y-2 bg-[#0E0F16] shrink-0", isCollapsed ? "p-2" : "p-3")}>
        {/* Install App Button */}
        <button
          type="button"
          onClick={() => setShowInstallModal(true)}
          className={cn(
            "flex w-full items-center rounded-2xl border border-white/10 bg-white/5 text-xs font-semibold text-neutral-300 hover:bg-white/10 hover:text-white transition-all shadow-sm",
            isCollapsed ? "justify-center px-0 h-10 w-10 mx-auto" : "justify-between px-3 py-2"
          )}
          title="Install Realty Smartz App (Mobile & Desktop)"
        >
          <span className="flex items-center gap-2">
            <Download className="h-3.5 w-3.5 text-[#FFA07A]" />
            {!isCollapsed && <span>Install App</span>}
          </span>
          {!isCollapsed && (
            <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-bold text-[#FFA07A]">
              PWA
            </span>
          )}
        </button>

        {/* Switch to Employee Portal Button */}
        <Link
          href="/employee-portal/dashboard"
          onClick={onCloseMobile}
          className={cn(
            "flex items-center rounded-2xl border border-white/10 bg-white/5 text-xs font-semibold text-neutral-300 hover:bg-white/10 hover:text-white transition-all shadow-sm",
            isCollapsed ? "justify-center px-0 h-10 w-10 mx-auto" : "justify-between px-3 py-2"
          )}
          title="Switch to Employee Portal"
        >
          <span className="flex items-center gap-2">
            <ArrowLeftRight className="h-3.5 w-3.5 text-[#FF7A70]" />
            {!isCollapsed && <span>Employee Portal</span>}
          </span>
          {!isCollapsed && <ChevronRight className="h-3.5 w-3.5 text-neutral-500" />}
        </Link>

        {/* User Card */}
        <div
          className={cn(
            "flex items-center rounded-2xl bg-white/[0.04] border border-white/10 transition-all",
            isCollapsed ? "flex-col gap-1.5 p-1.5" : "justify-between p-2.5"
          )}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[#FF7A70] to-[#FFA07A] text-xs font-bold text-white shadow-sm">
              {userInitial}
              <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-[#0E0F16]" />
            </div>

            {!isCollapsed && (
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-white">
                  {userName}
                </p>
                <p className="truncate text-[10px] text-neutral-400 capitalize">
                  {userRole}
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            title="Sign out of Realty Smartz"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className={cn(
              "flex items-center justify-center rounded-xl text-neutral-400 hover:bg-rose-500/20 hover:text-rose-400 transition-colors",
              isCollapsed ? "h-7 w-7 text-rose-400 bg-rose-500/10" : "h-7 w-7"
            )}
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <InstallGuideModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
      />
    </aside>
  );
}
