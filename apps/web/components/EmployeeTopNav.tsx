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
  UsersRound,
  Shield,
  Search,
  Award,
  Calendar,
  Download,
  Menu,
  X,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { InstallGuideModal } from "@/components/InstallGuideModal";
import { canAccessAdminPortal, isManager } from "@realty-smartz/shared";
import type { Role } from "@realty-smartz/shared";
import { cn } from "@/lib/utils";

export function EmployeeTopNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

  // Mobile Bottom Tabs (5 Core Destinations)
  const bottomTabs = [
    { href: "/employee-portal/dashboard", label: "Home", icon: LayoutDashboard },
    { href: "/employee-portal/attendance", label: "Punch", icon: Clock, isPunch: true },
    { href: "/employee-portal/leave", label: "Leaves", icon: CalendarDays },
    { href: "/employee-portal/directory", label: "Team", icon: Users },
    { href: "/employee-portal/profile", label: "Profile", icon: User },
  ];

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-neutral-200/80 bg-white/95 backdrop-blur-md pt-[max(0.5rem,env(safe-area-inset-top))] shadow-2xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 sm:gap-4 px-3 sm:px-4 py-2.5 sm:py-3">
          {/* Brand Logo */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Link href="/employee-portal/dashboard" className="flex items-center gap-2 group">
              <Logo showText={false} />
              <div>
                <span className="font-display text-sm font-bold tracking-tight text-neutral-900 group-hover:text-primary transition-colors">
                  Realty Smartz
                </span>
                <span className="block text-[9px] sm:text-[10px] font-medium uppercase tracking-wider text-neutral-400 -mt-0.5">
                  Private Limited
                </span>
              </div>
            </Link>
          </div>

          {/* Center Pill Segmented Navigation (Desktop) */}
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
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {/* Date Pill Badge (Desktop) */}
            <div className="hidden xl:flex items-center gap-1.5 rounded-full border border-neutral-200/80 bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-600">
              <Calendar className="h-3.5 w-3.5 text-neutral-400" />
              <span>{currentDateFormatted}</span>
            </div>

            {/* Search Button */}
            <Link
              href="/employee-portal/directory"
              className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full border border-neutral-200/80 bg-white text-neutral-600 hover:bg-neutral-50 transition-colors shadow-2xs"
              title="Search Directory"
            >
              <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Link>

            {/* Install App Quick Trigger */}
            <button
              type="button"
              onClick={() => setShowInstallModal(true)}
              className="flex h-8 sm:h-9 items-center gap-1 sm:gap-1.5 rounded-full border border-neutral-200/80 bg-white px-2 sm:px-3 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors shadow-2xs"
              title="Install Realty Smartz App"
            >
              <Download className="h-3.5 w-3.5 text-[#FF7A70]" />
              <span className="hidden sm:inline">Install</span>
            </button>

            {/* Admin Switcher (If Authorized) */}
            {canAccessAdminPortal(role) && (
              <Link href="/admin-portal/dashboard">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1 rounded-full border-neutral-200 text-[11px] sm:text-xs font-semibold text-primary hover:bg-rose-50 px-2 sm:px-3"
                  title="Switch to Admin Console"
                >
                  <Shield className="h-3.5 w-3.5 text-primary" />
                  <span className="hidden sm:inline">Admin Mode</span>
                </Button>
              </Link>
            )}

            {/* Mobile Hamburger / Extra Menu Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="flex lg:hidden h-8 w-8 items-center justify-center rounded-full border border-neutral-200/80 bg-white text-neutral-700 hover:bg-neutral-50"
              title="Open Navigation Menu"
            >
              <Menu className="h-4 w-4" />
            </button>

            {/* User Avatar + Sign Out (Desktop Only) */}
            <div className="hidden lg:flex items-center gap-2 pl-1 border-l border-neutral-200">
              <Link
                href="/employee-portal/profile"
                className="flex items-center gap-2 rounded-full p-1 hover:bg-neutral-100 transition-colors"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-[#FF7A70] to-[#FFA07A] font-bold text-xs text-white shadow-sm">
                  {session?.user?.name ? session.user.name.charAt(0).toUpperCase() : "U"}
                </div>
                <span className="text-xs font-semibold text-neutral-800">
                  {session?.user?.name?.split(" ")[0]}
                </span>
              </Link>

              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100 active:scale-95 transition-all shadow-2xs"
                title="Log Out of Employee Portal"
              >
                <LogOut className="h-3.5 w-3.5 text-rose-600" />
                <span>Log Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* MOBILE SLIDE-OVER DRAWER FOR ALL LINKS */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs lg:hidden"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 280 }}
              className="fixed inset-y-0 right-0 z-50 w-[290px] max-w-[85vw] bg-white shadow-2xl flex flex-col pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:hidden"
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between px-5 pb-4 border-b border-neutral-100">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-[#FF7A70] to-[#FFA07A] font-bold text-sm text-white shadow-sm">
                    {session?.user?.name ? session.user.name.charAt(0).toUpperCase() : "U"}
                  </div>
                  <div className="min-w-0">
                    <p className="font-display text-sm font-bold text-neutral-900 truncate">
                      {session?.user?.name || "Employee"}
                    </p>
                    <p className="text-[11px] text-neutral-400 font-medium truncate">
                      {session?.user?.email}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Navigation Items in Drawer */}
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
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
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-colors",
                        active
                          ? "bg-gradient-to-r from-[#FF7A70] to-[#FFA07A] text-white shadow-sm"
                          : "text-neutral-700 hover:bg-neutral-50"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </div>
                      <ChevronRight className={cn("h-3.5 w-3.5", active ? "text-white" : "text-neutral-300")} />
                    </Link>
                  );
                })}

                {/* Switch to Admin Mode if Role allows */}
                {canAccessAdminPortal(role) && (
                  <div className="pt-2">
                    <Link
                      href="/admin-portal/dashboard"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-bold bg-indigo-50 text-indigo-900 hover:bg-indigo-100 transition-colors border border-indigo-200/60"
                    >
                      <div className="flex items-center gap-3">
                        <Shield className="h-4 w-4 text-primary" />
                        <span>Admin Console Mode</span>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-indigo-400" />
                    </Link>
                  </div>
                )}
              </div>

              {/* Drawer Footer Actions */}
              <div className="px-4 pt-3 border-t border-neutral-100 space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setShowInstallModal(true);
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 py-2.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-100 transition-colors"
                >
                  <Download className="h-3.5 w-3.5 text-[#FF7A70]" />
                  <span>Install App on Phone</span>
                </button>

                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors shadow-2xs"
                >
                  <LogOut className="h-3.5 w-3.5 text-rose-600" />
                  <span>Sign Out</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* NATIVE MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-white/95 backdrop-blur-md border-t border-neutral-200/80 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] px-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-1.5">
        <div className="grid grid-cols-5 items-center max-w-md mx-auto">
          {bottomTabs.map((tab) => {
            const active =
              pathname === tab.href ||
              (tab.href !== "/employee-portal/dashboard" &&
                pathname.startsWith(`${tab.href}/`));
            const Icon = tab.icon;

            if (tab.isPunch) {
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className="flex flex-col items-center justify-center group -mt-5"
                >
                  <div className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-full shadow-[0_4px_16px_rgba(255,122,112,0.4)] transition-transform active:scale-95",
                    active
                      ? "bg-gradient-to-tr from-[#FF7A70] to-[#FFA07A] text-white ring-4 ring-white"
                      : "bg-[#181C26] text-white hover:bg-black ring-4 ring-white"
                  )}>
                    <Clock className="h-5 w-5" />
                  </div>
                  <span className={cn(
                    "text-[10px] font-bold mt-1 tracking-tight",
                    active ? "text-primary" : "text-neutral-700"
                  )}>
                    Punch In
                  </span>
                </Link>
              );
            }

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex flex-col items-center justify-center py-1 transition-colors active:scale-95",
                  active ? "text-primary" : "text-neutral-500 hover:text-neutral-800"
                )}
              >
                <div className="relative">
                  <Icon className={cn("h-5 w-5", active && "stroke-[2.4px]")} />
                  {active && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary" />
                  )}
                </div>
                <span className={cn(
                  "text-[10px] mt-1 font-medium",
                  active && "font-bold text-primary"
                )}>
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      <InstallGuideModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
      />
    </>
  );
}
