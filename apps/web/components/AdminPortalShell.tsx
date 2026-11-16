"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Menu,
  LogOut,
  Search,
  Calendar,
  KeyRound,
} from "lucide-react";
import { AdminSidebar } from "@/components/AdminSidebar";
import { AdminNotificationBell } from "@/components/AdminNotificationBell";
import { AdminChangePasswordModal } from "@/components/AdminChangePasswordModal";
import { cn } from "@/lib/utils";

interface AdminPortalShellProps {
  children: React.ReactNode;
}

export function AdminPortalShell({ children }: AdminPortalShellProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated" || (session as any)?.error === "SessionExpired") {
      window.location.href = "/login?error=SessionExpired";
    }
  }, [status, session]);

  const router = useRouter();
  const [query, setQuery] = useState("");

  const collapsed = mounted ? isCollapsed : false;

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("realty_admin_sidebar_collapsed");
    if (saved !== null) {
      setIsCollapsed(saved === "true");
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setIsCollapsed((prev) => {
          const next = !prev;
          localStorage.setItem("realty_admin_sidebar_collapsed", String(next));
          return next;
        });
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const searchInput = document.getElementById("admin-global-search");
        if (searchInput) {
          searchInput.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function toggleCollapse() {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("realty_admin_sidebar_collapsed", String(next));
      return next;
    });
  }

  const formattedDate = new Date().toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const userInitial = (session?.user?.name?.[0] || "H").toUpperCase();

  return (
    <div className="relative min-h-screen w-full bg-[var(--bg)] text-[var(--ink)] antialiased font-sans">
      {/* Desktop: fixed sidebar — never scrolls with page */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden lg:block",
          collapsed ? "w-[72px]" : "w-[264px]"
        )}
      >
        <AdminSidebar
          isCollapsed={collapsed}
          onToggleCollapse={toggleCollapse}
        />
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileOpen(false)}
              className="fixed inset-0 z-50 bg-black/50 lg:hidden"
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="fixed inset-y-0 left-0 z-50 w-[264px] lg:hidden"
            >
              <AdminSidebar
                isCollapsed={false}
                onToggleCollapse={() => {}}
                onCloseMobile={() => setIsMobileOpen(false)}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main content offset for fixed sidebar */}
      <div
        className={cn(
          "flex min-h-screen min-w-0 flex-col transition-[padding] duration-200 ease-out",
          collapsed ? "lg:pl-[72px]" : "lg:pl-[264px]"
        )}
      >
        {/* Mobile Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--line)] bg-[var(--card)] px-3 py-2.5 pt-[max(0.6rem,env(safe-area-inset-top))] sm:px-4 sm:py-3 lg:hidden">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setIsMobileOpen(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-[var(--line)] bg-transparent text-[var(--ink)] hover:bg-[var(--soft)]"
              aria-label="Open menu"
              aria-haspopup="dialog"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <path d="M4 8h16M4 16h10" />
              </svg>
            </button>
            <div className="flex min-w-0 items-center gap-2">
              <svg
                width="24"
                height="24"
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
              <p className="truncate text-xs font-bold text-[var(--ink)]">Admin Console</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setShowChangePasswordModal(true)}
              className="flex h-8 items-center gap-1 rounded border border-[var(--line)] bg-[var(--field)] px-2 text-xs font-medium text-[var(--ink)] hover:bg-[var(--hover)]"
              title="Change Password"
            >
              <KeyRound className="h-3.5 w-3.5 text-[var(--accent)]" strokeWidth={1.8} />
              <span className="hidden sm:inline">Password</span>
            </button>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex h-8 items-center gap-1 rounded border border-[var(--line)] bg-[var(--field)] px-2 text-xs font-semibold text-[var(--danger)] hover:bg-[var(--hover)]"
            >
              <LogOut className="h-3.5 w-3.5 text-[var(--danger)]" strokeWidth={1.8} />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </header>

        {/* Desktop Header - Clean Light Bar */}
        <header className="sticky top-0 z-30 hidden h-16 items-center justify-between border-b border-[var(--line)] bg-[var(--card)] px-8 text-[var(--ink)] lg:flex">
          {/* Left: Global Search */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (query.trim()) {
                router.push(`/admin-portal/employees?q=${encodeURIComponent(query.trim())}`);
              }
            }}
            className="relative w-full max-w-md"
          >
            <div className="relative flex items-center">
              <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-[var(--muted)]" strokeWidth={1.8} />
              <input
                id="admin-global-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search employees, departments, requests..."
                className="h-10 w-full rounded border border-[var(--line)] bg-[var(--field)] pl-10 pr-14 text-xs font-medium text-[var(--ink)] placeholder:text-[var(--muted)] transition-colors focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/18"
              />
              <span className="pointer-events-none absolute right-2.5 inline-flex items-center rounded border border-[var(--line)] bg-[var(--card)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--muted)]">
                Ctrl K
              </span>
            </div>
          </form>

          {/* Right: Notification, Date, Profile */}
          <div className="flex items-center gap-3">
            {/* Dynamic Real-Time Notification Bell */}
            <AdminNotificationBell />

            {/* Date Indicator */}
            <div className="flex items-center gap-2 rounded border border-[var(--line)] bg-[var(--field)] px-3 py-1.5 text-xs font-medium text-[var(--muted)]">
              <Calendar className="h-3.5 w-3.5 text-[var(--accent)]" strokeWidth={1.8} />
              <span>{formattedDate}</span>
            </div>

            {/* Change Password Button */}
            <button
              type="button"
              onClick={() => setShowChangePasswordModal(true)}
              className="flex items-center gap-1.5 rounded border border-[var(--line)] bg-[var(--field)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--hover)] transition-colors"
              title="Change Password"
            >
              <KeyRound className="h-3.5 w-3.5 text-[var(--accent)]" strokeWidth={1.8} />
              <span>Change Password</span>
            </button>

            {/* User Profile */}
            <Link
              href="/admin-portal/settings/company"
              title={session?.user?.name ?? "HR Admin"}
              className="flex items-center gap-2 rounded p-1 hover:bg-[var(--hover)] transition-colors"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded bg-[var(--accent)] text-xs font-bold text-white">
                {session?.user?.image ? (
                  <img
                    src={session.user.image}
                    alt={session?.user?.name || "Admin"}
                    className="h-full w-full object-cover rounded"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  userInitial
                )}
              </div>
              <span className="text-xs font-bold text-[var(--ink)] hidden sm:inline truncate max-w-[120px]">
                {session?.user?.name ?? "Admin"}
              </span>
            </Link>
          </div>
        </header>

        <AdminChangePasswordModal
          isOpen={showChangePasswordModal}
          onClose={() => setShowChangePasswordModal(false)}
        />

        <main
          className="min-w-0 w-full max-w-full flex-1"
          style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom, 0px))" }}
        >
          <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
