"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
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
  Bell,
  Calendar,
  Download,
} from "lucide-react";
import { motion } from "framer-motion";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { InstallGuideModal } from "@/components/InstallGuideModal";
import { canAccessAdminPortal, isManager } from "@realty-smartz/shared";
import type { Role } from "@realty-smartz/shared";

export function EmployeeTopNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [showInstallModal, setShowInstallModal] = useState(false);
  const role = (session?.user?.role ?? "EMPLOYEE") as Role;

  const links = [
    { href: "/employee-portal/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/employee-portal/attendance", label: "Attendance", icon: Clock },
    { href: "/employee-portal/leave", label: "Leave", icon: CalendarDays },
    { href: "/employee-portal/directory", label: "Directory", icon: Users },
    { href: "/employee-portal/org-chart", label: "Org Chart", icon: Network },
    { href: "/employee-portal/performance", label: "Performance", icon: Award },
    ...(isManager(role)
      ? [
          { href: "/employee-portal/my-team", label: "My Team", icon: UsersRound },
        ]
      : []),
    { href: "/employee-portal/profile", label: "Profile", icon: User },
  ];

  const currentDateFormatted = new Date().toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200/80 bg-white/95 backdrop-blur-md pt-[env(safe-area-inset-top)] shadow-2xs">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        {/* Brand Logo */}
        <div className="flex shrink-0 items-center gap-3">
          <Link href="/employee-portal/dashboard" className="flex items-center gap-2 group">
            <Logo showText={false} />
            <div className="hidden sm:block">
              <span className="font-display text-sm font-bold tracking-tight text-neutral-900 group-hover:text-primary transition-colors">
                Realty Smartz
              </span>
              <span className="block text-[10px] font-medium uppercase tracking-wider text-neutral-400 -mt-0.5">
                Private Limited
              </span>
            </div>
          </Link>
        </div>

        {/* Center Pill Segmented Navigation (Matching Image 1 & 2) */}
        <nav className="hidden lg:flex items-center rounded-full bg-neutral-100/90 p-1 border border-neutral-200/70 shadow-inner">
          {links.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/employee-portal/dashboard" &&
                pathname.startsWith(`${item.href}/`));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative px-3.5 py-1.5 text-xs font-semibold rounded-full transition-colors flex items-center gap-1.5"
              >
                {active && (
                  <motion.div
                    layoutId="active-pill-emp"
                    className="absolute inset-0 rounded-full bg-gradient-to-r from-[#FF7A70] to-[#FFA07A] shadow-[0_2px_12px_rgba(255,122,112,0.35)]"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span
                  className={`relative z-10 flex items-center gap-1.5 transition-colors ${
                    active ? "text-white font-bold" : "text-neutral-600 hover:text-neutral-900"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Right Actions & User Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Date Pill Badge */}
          <div className="hidden md:flex items-center gap-1.5 rounded-full border border-neutral-200/80 bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-600">
            <Calendar className="h-3.5 w-3.5 text-neutral-400" />
            <span>{currentDateFormatted}</span>
          </div>

          {/* Search Button */}
          <Link
            href="/employee-portal/directory"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200/80 bg-white text-neutral-600 hover:bg-neutral-50 transition-colors shadow-2xs"
            title="Search Directory"
          >
            <Search className="h-4 w-4" />
          </Link>

          {/* Install App Quick Trigger */}
          <button
            type="button"
            onClick={() => setShowInstallModal(true)}
            className="flex h-9 items-center gap-1.5 rounded-full border border-neutral-200/80 bg-white px-3 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors shadow-2xs"
            title="Install Realty Smartz App (Mobile / Desktop)"
          >
            <Download className="h-3.5 w-3.5 text-[#FF7A70]" />
            <span className="hidden sm:inline">Install App</span>
          </button>

          {/* Admin Switcher (If Authorized) */}
          {canAccessAdminPortal(role) && (
            <Link href="/admin-portal/dashboard">
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 rounded-full border-neutral-200 text-xs font-medium text-primary hover:bg-indigo-50"
              >
                <Shield className="h-3.5 w-3.5 text-primary" />
                <span className="hidden sm:inline">Admin Mode</span>
              </Button>
            </Link>
          )}

          {/* User Avatar + Sign Out */}
          <div className="flex items-center gap-2 pl-1 border-l border-neutral-200">
            <Link
              href="/employee-portal/profile"
              className="flex items-center gap-2 rounded-full p-1 hover:bg-neutral-100 transition-colors"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-[#FF7A70] to-[#FFA07A] font-bold text-xs text-white shadow-sm">
                {session?.user?.name ? session.user.name.charAt(0).toUpperCase() : "U"}
              </div>
              <span className="hidden xl:inline text-xs font-semibold text-neutral-800">
                {session?.user?.name?.split(" ")[0]}
              </span>
            </Link>

            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login?portal=employee" })}
              className="flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100 active:scale-95 transition-all shadow-2xs"
              title="Log Out of Employee Portal"
            >
              <LogOut className="h-3.5 w-3.5 text-rose-600" />
              <span className="hidden sm:inline">Log Out</span>
            </button>
          </div>
        </div>
      </div>

      <InstallGuideModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
      />

      {/* Mobile Scrollable Horizontal Pill Bar */}
      <div className="lg:hidden border-t border-neutral-100 px-3 py-2 overflow-x-auto bg-neutral-50/80">
        <div className="flex items-center gap-1.5 min-w-max">
          {links.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/employee-portal/dashboard" &&
                pathname.startsWith(`${item.href}/`));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "bg-gradient-to-r from-[#FF7A70] to-[#FFA07A] text-white shadow-xs font-semibold"
                    : "bg-white text-neutral-600 border border-neutral-200/80 hover:bg-neutral-100"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
}
