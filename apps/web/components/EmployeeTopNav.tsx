"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  Home,
  Clock,
  CalendarDays,
  User,
  LogOut,
  UsersRound,
  Shield,
  Award,
  Download,
  Menu,
  X,
  ChevronRight,
  IdCard,
  Briefcase,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { InstallGuideModal } from "@/components/InstallGuideModal";
import { canAccessAdminPortal, isManager } from "@realty-smartz/shared";
import type { Role } from "@realty-smartz/shared";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";

export function EmployeeTopNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const role = (session?.user?.role ?? "EMPLOYEE") as Role;

  const employeeId = session?.user?.id;
  const { data: profileHubData } = trpc.employee.profileHub.useQuery(
    { id: employeeId! },
    { enabled: Boolean(employeeId), staleTime: 10 * 60_000 }
  );
  const profilePhoto = profileHubData?.employee?.profilePhotoUrl || session?.user?.image || null;
  const displayName = profileHubData?.employee
    ? `${profileHubData.employee.firstName} ${profileHubData.employee.lastName}`.trim()
    : session?.user?.name || "Employee";

  const userInitials = profileHubData?.employee
    ? `${(profileHubData.employee.firstName?.[0] ?? "").toUpperCase()}${(profileHubData.employee.lastName?.[0] ?? "").toUpperCase()}`
    : (session?.user?.name
        ?.split(" ")
        .filter(Boolean)
        .map((s) => s[0])
        .slice(0, 2)
        .join("")
        .toUpperCase() || "RS");

  const links = [
    { href: "/employee-portal/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/employee-portal/attendance", label: "Attendance", icon: Clock },
    { href: "/employee-portal/leave", label: "Leave", icon: CalendarDays },
    { href: "/employee-portal/performance", label: "Performance", icon: Award },
    ...(isManager(role)
      ? [
          { href: "/employee-portal/my-team", label: "My Team", icon: UsersRound },
        ]
      : []),
    { href: "/employee-portal/id-card", label: "ID Card", icon: IdCard },
    { href: "/employee-portal/profile", label: "Profile", icon: User },
  ];

  // Mobile Bottom Tabs (4 Core Destinations without Team/Directory)
  const bottomTabs = [
    { href: "/employee-portal/dashboard", label: "HOME", icon: Home },
    { href: "/employee-portal/attendance", label: "ATTENDANCE", icon: Clock },
    { href: "/employee-portal/leave", label: "LEAVES", icon: Briefcase },
    { href: "/employee-portal/profile", label: "ME", icon: User },
  ];

  return (
    <>
      <header className="sticky top-0 z-30 bg-[#2A1167]">
        {/* Deep rich purple header with soft gradient - with safe area padding */}
        <div className="bg-gradient-to-r from-[#220B57] via-[#2A1167] to-[#3A178D] pt-[env(safe-area-inset-top)] text-white">
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
            {/* Left: Perfect Circular Profile Photo Avatar */}
            <Link
              href="/employee-portal/profile"
              className="flex shrink-0 items-center justify-center transition-transform active:scale-95"
              title={displayName || "My Profile"}
              style={{ width: 36, height: 36, minWidth: 36, minHeight: 36 }}
            >
              <div
                className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white/80 bg-gradient-to-tr from-[#6D28D9] via-[#7C3AED] to-[#8B5CF6] text-white shadow-md ring-1 ring-white/20 select-none aspect-square"
                style={{ width: 36, height: 36, minWidth: 36, minHeight: 36, borderRadius: "50%" }}
              >
                {profilePhoto ? (
                  <img
                    src={profilePhoto}
                    alt={displayName || "Profile"}
                    className="h-full w-full object-cover rounded-full aspect-square"
                    referrerPolicy="no-referrer"
                    style={{ width: "100%", height: "100%", borderRadius: "50%" }}
                  />
                ) : (
                  <span className="text-[11px] font-black tracking-normal leading-none text-white select-none">
                    {userInitials || "RS"}
                  </span>
                )}
              </div>
            </Link>

            {/* Center: Running Marquee with Smooth Edge Masking */}
            <div className="flex-1 overflow-hidden px-2 min-w-0 [mask-image:linear-gradient(to_right,transparent,black_10px,black_calc(100%-10px),transparent)]">
              <div className="animate-marquee-smooth flex items-center gap-6 text-xs font-semibold text-white/95 whitespace-nowrap">
                <span>Hey {displayName} • Welcome to Realty Smartz Private Limited</span>
                <span className="text-white/40">•</span>
                <span>Hey {displayName} • Welcome to Realty Smartz Private Limited</span>
                <span className="text-white/40">•</span>
                <span>Hey {displayName} • Welcome to Realty Smartz Private Limited</span>
                <span className="text-white/40">•</span>
              </div>
            </div>

            {/* Right: Desktop Actions & Mobile 3-line Menu */}
            <div className="flex shrink-0 items-center gap-2">
              <div className="hidden lg:flex items-center gap-4">
                {canAccessAdminPortal(role) && (
                  <Link
                    href="/admin-portal/dashboard"
                    title="Switch to Admin Console"
                    className="text-white/80 hover:text-white"
                  >
                    <Shield className="h-5 w-5" />
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => setShowInstallModal(true)}
                  title="Install Realty Smartz App"
                  className="text-white/80 hover:text-white"
                >
                  <Download className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  title="Log Out"
                  className="text-white/80 hover:text-white"
                >
                  <LogOut className="h-5 w-5" />
                </button>
                <Link
                  href="/employee-portal/profile"
                  title={displayName}
                  className="h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gradient-to-tr from-[#5145CD] to-[#7957FF] text-xs font-semibold text-white flex border border-white/20"
                >
                  {profilePhoto ? (
                    <img
                      src={profilePhoto}
                      alt={displayName}
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : displayName ? (
                    displayName.charAt(0).toUpperCase()
                  ) : (
                    "U"
                  )}
                </Link>
              </div>

              {/* Mobile: 3-line hamburger menu on right */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-white hover:bg-white/10 active:scale-95 transition-all lg:hidden"
                title="Open Navigation Menu"
              >
                <Menu className="h-6 w-6 text-white stroke-[2.2px]" />
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
                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-gradient-to-tr from-[#5145CD] to-[#7957FF] font-bold text-sm text-white shrink-0">
                    {profilePhoto ? (
                      <img
                        src={profilePhoto}
                        alt={displayName}
                        className="h-full w-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : displayName ? (
                      displayName.charAt(0).toUpperCase()
                    ) : (
                      "U"
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-display text-sm font-bold text-neutral-900 truncate">
                      {displayName}
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
        className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-white/95 backdrop-blur-md border-t border-[#ECE6F8] shadow-[0_-4px_24px_rgba(78,36,201,0.06)]"
        style={{ paddingBottom: "max(0.6rem, env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="grid grid-cols-4 max-w-md mx-auto px-2">
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
                  "flex flex-col items-center justify-center gap-1 pt-2.5 pb-1 min-h-[3.5rem] transition-all duration-150 relative group",
                  active ? "text-[#4E24C9]" : "text-[#8D83A8] hover:text-[#4E24C9]"
                )}
              >
                <div className={cn(
                  "flex items-center justify-center rounded-xl p-1 transition-all",
                  active && "scale-105"
                )}>
                  <Icon
                    className={cn(
                      "h-5 w-5 transition-transform",
                      active
                        ? "text-[#4E24C9] fill-[#4E24C9] stroke-[#4E24C9] drop-shadow-[0_2px_8px_rgba(78,36,201,0.3)]"
                        : "text-[#8D83A8] stroke-[1.8px] group-hover:text-[#4E24C9]"
                    )}
                  />
                </div>
                <span className={cn(
                  "text-[9px] tracking-wider",
                  active ? "font-bold text-[#4E24C9]" : "font-semibold text-[#8D83A8]"
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
