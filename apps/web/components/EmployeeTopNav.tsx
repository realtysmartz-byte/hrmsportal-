"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  Home,
  Clock,
  User,
  LogOut,
  X,
  MapPin,
  Navigation,
  FileText,
  Target,
  Building2,
  Briefcase,
  Users,
  Settings,
} from "lucide-react";
import { InstallGuideModal } from "@/components/InstallGuideModal";
import { EmployeeNotificationBell } from "@/components/EmployeeNotificationBell";
import { canAccessAdminPortal } from "@realty-smartz/shared";
import type { Role } from "@realty-smartz/shared";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { Capacitor } from "@capacitor/core";

export function EmployeeTopNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isNativeApp, setIsNativeApp] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
        const isStrictNative =
          Capacitor.isNativePlatform() &&
          Capacitor.getPlatform() !== "web";

        if (isStrictNative) {
          setIsNativeApp(true);
          document.documentElement.classList.add("is-native-app");
          document.body.classList.add("is-native-app");
        } else {
          setIsNativeApp(false);
          document.documentElement.classList.remove("is-native-app");
          document.body.classList.remove("is-native-app");
          try {
            sessionStorage.removeItem("is_native_app");
          } catch { }
        }
      }
    }, []);

  const role = (session?.user?.role ?? "EMPLOYEE") as Role;
  const isAdmin = canAccessAdminPortal(role);

  const employeeId = session?.user?.id;
  const { data: profileHubData } = trpc.employee.profileHub.useQuery(
    { id: employeeId! },
    { enabled: Boolean(employeeId), staleTime: 10 * 60_000 }
  );
  const { data: teamPendingCount = 0 } = trpc.leave.myTeamPendingCount.useQuery(undefined, {
    staleTime: 20_000,
  });
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
      .toUpperCase() || "HA");

  const roleLabel = isAdmin ? "Admin" : "Employee";

  // Lock body scroll on drawer open with scroll restoration
  const scrollYRef = useRef(0);
  useEffect(() => {
    if (mobileMenuOpen) {
      scrollYRef.current = window.scrollY;
      const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollYRef.current}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.overflow = "hidden";
      if (scrollBarWidth > 0) {
        document.body.style.paddingRight = `${scrollBarWidth}px`;
      }
    } else {
      const top = document.body.style.top;
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
      if (top) {
        window.scrollTo(0, scrollYRef.current);
      }
    }
    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
    };
  }, [mobileMenuOpen]);

  // Close drawer on ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  // Drawer Nav Groups matching sample-2-sidebar-open.png
  const drawerGroups = isAdmin
    ? [
      {
        title: "Overview",
        items: [
          { href: "/admin-portal/dashboard", label: "Dashboard", icon: LayoutDashboard },
        ],
      },
      {
        title: "People",
        items: [
          { href: "/admin-portal/employees", label: "Employees", icon: Users },
          { href: "/admin-portal/departments", label: "Departments", icon: Building2 },
          { href: "/admin-portal/designations", label: "Designations", icon: Briefcase },
        ],
      },
      {
        title: "Attendance",
        items: [
          { href: "/admin-portal/attendance/team", label: "Team Attendance", icon: Clock },
          { href: "/admin-portal/attendance/locations", label: "Location Tracing", icon: MapPin },
          { href: "/admin-portal/attendance/allocate-locations", label: "Allocate Locations", icon: Navigation },
        ],
      },
      {
        title: "Work",
        items: [
          { href: "/admin-portal/leave/approvals", label: "Leave Approvals", icon: FileText },
          { href: "/admin-portal/performance", label: "Performance", icon: Target },
        ],
      },
    ]
    : [
      {
        title: "Overview",
        items: [
          { href: "/employee-portal/dashboard", label: "Dashboard", icon: LayoutDashboard },
        ],
      },
      {
        title: "Attendance",
        items: [
          { href: "/employee-portal/attendance", label: "Attendance", icon: Clock },
        ],
      },
      {
        title: "Work",
        items: [
          { href: "/employee-portal/leave", label: "Leave Requests", icon: FileText },
          ...(teamPendingCount > 0 || (profileHubData?.employee?.directReports && profileHubData.employee.directReports.length > 0) || role === "MANAGER"
            ? [{ href: "/employee-portal/leave/approvals", label: "Team Leave Approvals", icon: FileText }]
            : []),
          { href: "/employee-portal/performance", label: "Performance", icon: Target },
          { href: "/employee-portal/id-card", label: "ID Card", icon: Briefcase },
          { href: "/employee-portal/payslips", label: "My Payslips", icon: FileText },
        ],
      },
    ];

  // Mobile Bottom Tabs matching reference (Home, Attendance, Leaves, Me)
  const bottomTabs = [
    { href: "/employee-portal/dashboard", label: "Home", icon: Home },
    { href: "/employee-portal/attendance", label: "Attendance", icon: Clock },
    { href: "/employee-portal/leave", label: "Leaves", icon: Briefcase },
    { href: "/employee-portal/profile", label: "Me", icon: User },
  ];

  return (
    <>
      {/* 1. Header: Avatar + Company Marquee + Sidebar Button */}
      <header
        className={cn(
          "employee-top-nav-header sticky top-0 z-30 flex items-center gap-2.5 px-3 sm:px-4 border-b border-[var(--line)] bg-[var(--bg)] text-[var(--ink)]",
          isNativeApp ? "pt-[30px] pb-3 h-[calc(4rem+30px)] items-end" : "h-16"
        )}
      >
        {/* Avatar: Square 32x32 with rounded 4px and accent background */}
        <Link
          href="/employee-portal/profile"
          className="w-8 h-8 flex-none rounded-[4px] bg-[var(--accent)] text-white flex items-center justify-center font-bold text-xs select-none overflow-hidden"
          title="My Profile"
        >
          {profilePhoto ? (
            <img
              src={profilePhoto}
              alt={displayName}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span>{userInitials}</span>
          )}
        </Link>

        {/* Marquee: Seamless infinite running text */}
        <div
          className="flex-1 min-w-0 overflow-hidden"
          aria-label={`Hey ${displayName} • Welcome to Realty Smartz Private Limited`}
        >
          <div className="animate-run-header">
            <div className="flex flex-none items-center gap-8 pr-8">
              <span className="flex items-center gap-8 text-sm font-semibold whitespace-nowrap text-[var(--ink)]">
                Hey {displayName} • Welcome to Realty Smartz Private Limited
                <span className="w-[5px] h-[5px] bg-[var(--accent)] rotate-45 inline-block shrink-0" />
              </span>
              <span className="flex items-center gap-8 text-sm font-semibold whitespace-nowrap text-[var(--ink)]">
                Hey {displayName} • Welcome to Realty Smartz Private Limited
                <span className="w-[5px] h-[5px] bg-[var(--accent)] rotate-45 inline-block shrink-0" />
              </span>
              <span className="flex items-center gap-8 text-sm font-semibold whitespace-nowrap text-[var(--ink)]">
                Hey {displayName} • Welcome to Realty Smartz Private Limited
                <span className="w-[5px] h-[5px] bg-[var(--accent)] rotate-45 inline-block shrink-0" />
              </span>
              <span className="flex items-center gap-8 text-sm font-semibold whitespace-nowrap text-[var(--ink)]">
                Hey {displayName} • Welcome to Realty Smartz Private Limited
                <span className="w-[5px] h-[5px] bg-[var(--accent)] rotate-45 inline-block shrink-0" />
              </span>
            </div>
            <div className="flex flex-none items-center gap-8 pr-8">
              <span className="flex items-center gap-8 text-sm font-semibold whitespace-nowrap text-[var(--ink)]">
                Hey {displayName} • Welcome to Realty Smartz Private Limited
                <span className="w-[5px] h-[5px] bg-[var(--accent)] rotate-45 inline-block shrink-0" />
              </span>
              <span className="flex items-center gap-8 text-sm font-semibold whitespace-nowrap text-[var(--ink)]">
                Hey {displayName} • Welcome to Realty Smartz Private Limited
                <span className="w-[5px] h-[5px] bg-[var(--accent)] rotate-45 inline-block shrink-0" />
              </span>
              <span className="flex items-center gap-8 text-sm font-semibold whitespace-nowrap text-[var(--ink)]">
                Hey {displayName} • Welcome to Realty Smartz Private Limited
                <span className="w-[5px] h-[5px] bg-[var(--accent)] rotate-45 inline-block shrink-0" />
              </span>
              <span className="flex items-center gap-8 text-sm font-semibold whitespace-nowrap text-[var(--ink)]">
                Hey {displayName} • Welcome to Realty Smartz Private Limited
                <span className="w-[5px] h-[5px] bg-[var(--accent)] rotate-45 inline-block shrink-0" />
              </span>
            </div>
          </div>
        </div>

        {/* Notification Bell */}
        <EmployeeNotificationBell />

        {/* Menu Button: Minimal two-line icon */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="w-8 h-8 flex-none grid place-items-center rounded-[4px] hover:bg-[var(--soft)] text-[var(--ink)] transition-colors"
          aria-label="Open menu"
          aria-haspopup="dialog"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-[18px] h-[18px]"
          >
            <path d="M4 8h16M4 16h10" />
          </svg>
        </button>
      </header>

      {/* 2. Slide-in Sidebar Drawer with Scrim */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-[rgba(17,19,24,0.45)] transition-opacity duration-200",
          mobileMenuOpen ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"
        )}
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden="true"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className={cn(
          "fixed top-0 bottom-0 right-0 z-50 w-[min(86vw,336px)] bg-[var(--bg)] border-l border-[var(--line)] flex flex-col transition-transform duration-240 ease-out pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]",
          mobileMenuOpen ? "translate-x-0 visible" : "translate-x-full invisible pointer-events-none"
        )}
      >
        {/* Drawer Header (.dh): Logo + Title + Close Button */}
        <div className="flex items-center gap-3 h-[72px] px-3 sm:px-4 border-b border-[var(--line)] flex-none">
          {/* Logo Mark: Hexagon with 3 lines */}
          <svg
            className="w-[34px] h-[34px] shrink-0"
            viewBox="0 0 34 34"
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path
              d="M17 2.5L29.55 9.75V24.25L17 31.5L4.45 24.25V9.75L17 2.5Z"
              stroke="#2F7FB5"
              strokeWidth="2.6"
            />
            <line x1="12" y1="12" x2="12" y2="22" stroke="#D6283A" strokeWidth="3.4" strokeLinecap="round" />
            <line x1="17" y1="9.5" x2="17" y2="24.5" stroke="#D6283A" strokeWidth="3.4" strokeLinecap="round" />
            <line x1="22" y1="12" x2="22" y2="22" stroke="#D6283A" strokeWidth="3.4" strokeLinecap="round" />
          </svg>

          <div className="flex-1 min-w-0">
            <span className="block truncate text-[15px] font-bold tracking-[0.03em] text-[var(--ink)]">
              Realty Smartz
            </span>
            <small className="block truncate text-[12px] text-[var(--muted)] mt-0.5">
              {roleLabel}
            </small>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="w-10 h-10 flex-none grid place-items-center rounded-[4px] hover:bg-[var(--soft)] text-[var(--ink)] transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5 stroke-[1.8]" />
          </button>
        </div>

        {/* Drawer Navigation (.dn): Grouped links */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-2 space-y-4">
          {drawerGroups.map((group) => (
            <div key={group.title}>
              <div className="px-3 py-1.5 text-[12px] font-semibold text-[var(--muted)]">
                {group.title}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active =
                    pathname === item.href ||
                    (item.href !== "/admin-portal/dashboard" &&
                      item.href !== "/employee-portal/dashboard" &&
                      pathname.startsWith(`${item.href}/`));
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "relative flex items-center gap-3.5 w-full h-[46px] px-3 rounded-[4px] text-[15px] font-medium transition-colors text-left",
                        active
                          ? "bg-[var(--active)] text-[var(--ink)] font-semibold before:content-[''] before:absolute before:left-0 before:top-[9px] before:bottom-[9px] before:w-[3px] before:bg-[var(--accent)]"
                          : "text-[var(--muted)] hover:bg-[var(--soft)] hover:text-[var(--ink)]"
                      )}
                    >
                      <Icon
                        className={cn(
                          "w-5 h-5 stroke-[1.8]",
                          active ? "text-[var(--accent)]" : "text-inherit"
                        )}
                      />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Switch Portal Button if Admin */}
          {isAdmin && (
            <div className="pt-2 px-1">
              <Link
                href={pathname.startsWith("/admin-portal") ? "/employee-portal/dashboard" : "/admin-portal/dashboard"}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 w-full h-10 rounded-[4px] border border-[var(--line)] text-xs font-semibold text-[var(--ink)] hover:bg-[var(--soft)]"
              >
                {pathname.startsWith("/admin-portal") ? "Switch to Employee Portal" : "Switch to Admin Portal"}
              </Link>
            </div>
          )}
        </div>

        {/* Drawer Footer (.df): HA avatar with online indicator + HR Admin + Settings + Log out */}
        <div className="flex items-center gap-3 p-3.5 border-t border-[var(--line)] flex-none">
          <div className="relative w-10 h-10 flex-none rounded-[4px] bg-[var(--accent)] text-white flex items-center justify-center font-bold text-sm select-none">
            {userInitials}
            <i className="absolute -right-0.5 -bottom-0.5 w-2.5 h-2.5 rounded-full bg-[var(--ok)] border-2 border-[var(--bg)]" />
          </div>

          <div className="flex-1 min-w-0">
            <span className="block truncate text-sm font-semibold text-[var(--ink)]">
              {displayName}
            </span>
            <small className="block truncate text-xs text-[var(--muted)]">
              {roleLabel}
            </small>
          </div>

          <Link
            href="/employee-portal/profile"
            onClick={() => setMobileMenuOpen(false)}
            className="w-10 h-10 flex-none grid place-items-center rounded-[4px] hover:bg-[var(--soft)] text-[var(--ink)] transition-colors"
            aria-label="Settings"
          >
            <Settings className="w-5 h-5 stroke-[1.8]" />
          </Link>

          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-10 h-10 flex-none grid place-items-center rounded-[4px] hover:bg-[var(--soft)] text-[var(--ink)] transition-colors"
            aria-label="Log out"
          >
            <LogOut className="w-5 h-5 stroke-[1.8]" />
          </button>
        </div>
      </aside>

      {/* 3. Bottom Navigation: Home, Attendance, Leaves, Me */}
      <nav
        aria-label="Main"
        className="fixed bottom-0 left-0 right-0 max-w-[430px] mx-auto grid grid-cols-4 bg-[var(--bg)] border-t border-[var(--line)] z-40 pb-[env(safe-area-inset-bottom,0px)]"
      >
        {bottomTabs.map((tab) => {
          const active =
            pathname === tab.href ||
            (tab.href !== "/employee-portal/dashboard" && pathname.startsWith(`${tab.href}/`));
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "relative h-16 flex flex-col items-center justify-center gap-1 text-[12px] font-semibold transition-colors",
                active
                  ? "text-[var(--accent)] before:content-[''] before:absolute before:-top-[1px] before:left-1/4 before:right-1/4 before:h-[2px] before:bg-[var(--accent)]"
                  : "text-[var(--muted)] hover:text-[var(--ink)]"
              )}
            >
              <Icon className="w-[22px] h-[22px] stroke-[1.8]" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>

      <InstallGuideModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
      />
    </>
  );
}
