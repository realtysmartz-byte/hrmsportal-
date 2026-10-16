"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  Home,
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
  Download,
  Menu,
  X,
  ChevronRight,
  IdCard,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Logo } from "@/components/Logo";
import { InstallGuideModal } from "@/components/InstallGuideModal";
import { canAccessAdminPortal, isManager } from "@realty-smartz/shared";
import type { Role } from "@realty-smartz/shared";
import { cn } from "@/lib/utils";

export function EmployeeTopNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();
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
    { href: "/employee-portal/id-card", label: "ID Card", icon: IdCard },
  ];


  // Mobile Bottom Tabs (5 Core Destinations)
  const bottomTabs = [
    { href: "/employee-portal/dashboard", label: "Home", icon: Home },
    { href: "/employee-portal/attendance", label: "Attendance", icon: Clock },
    { href: "/employee-portal/leave", label: "Leaves", icon: CalendarDays },
    { href: "/employee-portal/directory", label: "Team", icon: Users },
    { href: "/employee-portal/profile", label: "Me", icon: User },
  ];

  return (
    <>
      <header className="sticky top-0 z-30 bg-white">
        <div className="bg-[#5D3EBC] pt-[env(safe-area-inset-top)] text-white">
          <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-3 sm:px-4 lg:gap-6">
            <Link href="/employee-portal/dashboard" className="flex shrink-0 items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white">
                <Logo showText={false} size={26} />
              </span>
              <span className="text-sm font-semibold">RS HRMS</span>
            </Link>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                router.push(`/employee-portal/directory?q=${encodeURIComponent(query.trim())}`);
              }}
              className="relative hidden w-full max-w-md lg:block"
            >
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search employees"
                className="h-9 w-full rounded-full bg-white pl-9 pr-4 text-sm text-neutral-800 placeholder:text-neutral-400 outline-none"
              />
            </form>

            <div className="ml-auto flex items-center gap-3">
              {canAccessAdminPortal(role) && (
                <Link
                  href="/admin-portal/dashboard"
                  title="Switch to Admin Console"
                  className="hidden text-white/90 hover:text-white lg:block"
                >
                  <Shield className="h-5 w-5" />
                </Link>
              )}
              <button
                type="button"
                onClick={() => setShowInstallModal(true)}
                title="Install Realty Smartz App"
                className="hidden text-white/90 hover:text-white lg:block"
              >
                <Download className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
                title="Log Out"
                className="hidden text-white/90 hover:text-white lg:block"
              >
                <LogOut className="h-5 w-5" />
              </button>
              <Link
                href="/employee-portal/profile"
                title={session?.user?.name ?? "Profile"}
                className="hidden h-8 w-8 items-center justify-center rounded-full bg-emerald-400 text-xs font-semibold text-white lg:flex"
              >
                {session?.user?.name ? session.user.name.charAt(0).toUpperCase() : "U"}
              </Link>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-white lg:hidden"
                title="Open Navigation Menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        <nav className="hidden border-b border-neutral-200 lg:block">
          <div className="mx-auto flex max-w-7xl gap-7 px-4">
            {links.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/employee-portal/dashboard" &&
                  pathname.startsWith(`${item.href}/`));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "border-b-2 py-2.5 text-xs font-medium uppercase tracking-wide",
                    active
                      ? "border-[#5D3EBC] text-[#5D3EBC]"
                      : "border-transparent text-neutral-600 hover:text-neutral-900"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
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
              className="fixed inset-y-0 right-0 z-50 w-[290px] max-w-[85vw] bg-white flex flex-col pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:hidden"
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between px-5 pb-4 border-b border-neutral-100">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#5D3EBC] font-bold text-sm text-white">
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
                          ? "bg-[#5D3EBC] text-white"
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
                  <Download className="h-3.5 w-3.5 text-[#5D3EBC]" />
                  <span>Install App on Phone</span>
                </button>

                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5 text-rose-600" />
                  <span>Sign Out</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <nav
        className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-white border-t border-neutral-200"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="grid grid-cols-5 max-w-md mx-auto">
          {bottomTabs.map((tab) => {
            const active =
              pathname === tab.href ||
              (tab.href !== "/employee-portal/dashboard" &&
                pathname.startsWith(`${tab.href}/`));
            const Icon = tab.icon;

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 pt-2.5 pb-1.5 min-h-[3.25rem]",
                  active ? "text-[#5D3EBC]" : "text-neutral-500"
                )}
              >
                <Icon className={cn("h-5 w-5", active && "fill-[#5D3EBC]/15 stroke-[2.2px]")} />
                <span className={cn("text-[10px] uppercase", active ? "font-bold" : "font-medium")}>
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
