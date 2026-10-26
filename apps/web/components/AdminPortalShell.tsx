"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu,
  LogOut,
  Download,
  Search,
  ArrowLeftRight,
  Bell,
  Calendar,
  ChevronDown,
} from "lucide-react";
import { AdminSidebar } from "@/components/AdminSidebar";
import { InstallGuideModal } from "@/components/InstallGuideModal";
import { cn } from "@/lib/utils";

interface AdminPortalShellProps {
  children: React.ReactNode;
}

export function AdminPortalShell({ children }: AdminPortalShellProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { data: session } = useSession();
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

  // Format today's date like "Mon, 26 Oct 2026"
  const formattedDate = new Date().toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const userInitial = session?.user?.name?.[0] ?? "H";

  return (
    <div className="relative min-h-screen w-full bg-[#F5F6FC] antialiased">
      {/* Desktop: fixed sidebar — never scrolls with page */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden lg:block",
          collapsed ? "w-[76px]" : "w-[260px]"
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
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs lg:hidden"
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 280 }}
              className="fixed inset-y-0 left-0 z-50 w-[270px] lg:hidden"
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
          "flex min-h-screen min-w-0 flex-col transition-[padding] duration-300 ease-in-out",
          collapsed ? "lg:pl-[76px]" : "lg:pl-[260px]"
        )}
      >
        {/* Mobile Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#E6E9F3] bg-white/95 backdrop-blur-md px-3 py-2.5 pt-[max(0.6rem,env(safe-area-inset-top))] sm:px-4 sm:py-3 lg:hidden shadow-xs">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setIsMobileOpen(true)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-800 hover:bg-neutral-200 active:scale-95 sm:h-9 sm:w-9"
              title="Open Navigation Menu"
            >
              <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
            <div className="flex min-w-0 items-center gap-2">
              <img src="/logo.png" alt="Realty Smartz" className="h-6 w-6 shrink-0 object-contain" />
              <p className="truncate font-display text-xs font-bold text-neutral-900">Admin Console</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setShowInstallModal(true)}
              className="flex h-8 items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 sm:px-2.5"
            >
              <Download className="h-3.5 w-3.5 text-[#5145CD]" />
              <span className="hidden sm:inline">Install</span>
            </button>
            <Link
              href="/employee-portal/dashboard"
              className="flex h-8 items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 sm:px-2.5"
            >
              <ArrowLeftRight className="h-3.5 w-3.5 text-[#5145CD]" />
              <span className="hidden sm:inline">Employee View</span>
            </Link>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex h-8 items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 text-xs font-bold text-rose-700 hover:bg-rose-100 sm:px-2.5"
            >
              <LogOut className="h-3.5 w-3.5 text-rose-600" />
              <span className="hidden sm:inline">Log Out</span>
            </button>
          </div>
        </header>

        {/* Desktop Header - Enterprise White Bar as in reference */}
        <header className="sticky top-0 z-30 hidden h-16 items-center justify-between border-b border-[#E6E9F3] bg-white/90 backdrop-blur-md px-8 text-neutral-900 lg:flex shadow-xs">
          {/* Left: Global Search Pill */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (query.trim()) {
                router.push(`/admin-portal/employees?q=${encodeURIComponent(query.trim())}`);
              }
            }}
            className="relative w-full max-w-lg"
          >
            <div className="relative flex items-center">
              <Search className="pointer-events-none absolute left-4 h-4 w-4 text-neutral-400" />
              <input
                id="admin-global-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search employees, departments, requests..."
                className="h-10 w-full rounded-xl border border-[#E6E9F3] bg-neutral-50/70 pl-11 pr-16 text-xs font-medium text-neutral-800 placeholder:text-neutral-400 transition-all focus:border-[#6D28D9] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/15"
              />
              <span className="pointer-events-none absolute right-3 inline-flex items-center rounded border border-[#E6E9F3] bg-white px-1.5 py-0.5 text-[10px] font-semibold text-neutral-400 shadow-2xs">
                ⌘ K
              </span>
            </div>
          </form>

          {/* Right: Notification, Date, Profile */}
          <div className="flex items-center gap-4">
            {/* Notification Bell with number badge */}
            <Link
              href="/admin-portal/leave/approvals"
              title="Pending Notifications"
              className="relative flex h-9 w-9 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100 transition-colors"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#6D28D9] text-[9px] font-bold text-white ring-2 ring-white">
                4
              </span>
            </Link>

            {/* Date Indicator Pill */}
            <div className="flex items-center gap-2 rounded-full border border-[#E6E9F3] bg-neutral-50/70 px-3.5 py-1.5 text-xs font-medium text-neutral-700 shadow-2xs">
              <Calendar className="h-3.5 w-3.5 text-[#5145CD]" />
              <span>{formattedDate}</span>
            </div>

            {/* User Profile Pill */}
            <Link
              href="/admin-portal/settings/company"
              title={session?.user?.name ?? "HR Admin"}
              className="flex items-center gap-2 rounded-full p-1 hover:bg-neutral-100 transition-colors"
            >
              <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gradient-to-tr from-[#5145CD] to-[#7957FF] text-xs font-bold text-white shadow-sm">
                {session?.user?.image ? (
                  <img
                    src={session.user.image}
                    alt={session?.user?.name || "Admin"}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  userInitial
                )}
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-neutral-400" />
            </Link>
          </div>
        </header>

        <InstallGuideModal
          isOpen={showInstallModal}
          onClose={() => setShowInstallModal(false)}
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

