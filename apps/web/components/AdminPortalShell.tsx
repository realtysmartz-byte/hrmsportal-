"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ArrowLeftRight, LogOut, Download, Search, Settings } from "lucide-react";
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

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("realty_admin_sidebar_collapsed");
    if (saved !== null) {
      setIsCollapsed(saved === "true");
    }

    // Keyboard shortcut: Ctrl + B to toggle sidebar
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setIsCollapsed((prev) => {
          const next = !prev;
          localStorage.setItem("realty_admin_sidebar_collapsed", String(next));
          return next;
        });
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

  return (
    <div className="relative flex min-h-screen w-full max-w-full overflow-x-clip bg-[#F4F5FA] antialiased">
      {/* 1. DESKTOP STRETCHABLE SIDEBAR */}
      <div className="hidden lg:block sticky top-0 h-screen shrink-0 z-40">
        <AdminSidebar
          isCollapsed={mounted ? isCollapsed : false}
          onToggleCollapse={toggleCollapse}
        />
      </div>

      {/* 2. MOBILE SLIDE-OVER DRAWER */}
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

      {/* 3. MAIN CONTENT CONTAINER */}
      <div className="flex min-h-screen flex-1 flex-col transition-all duration-300 ease-in-out min-w-0 w-full max-w-full overflow-x-hidden">
        {/* Mobile Header Bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-neutral-200/80 bg-white px-3 sm:px-4 py-2.5 sm:py-3 pt-[max(0.6rem,env(safe-area-inset-top))] lg:hidden">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setIsMobileOpen(true)}
              className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-800 hover:bg-neutral-200 active:scale-95 transition-all"
              title="Open Navigation Menu"
            >
              <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <img
                src="/logo.png"
                alt="Realty Smartz"
                className="h-6 w-6 shrink-0 object-contain"
              />
              <div className="min-w-0">
                <p className="font-display text-xs font-bold text-neutral-900 leading-tight truncate">
                  Admin Console
                </p>
                <p className="text-[9px] sm:text-[10px] text-neutral-400 font-medium leading-none truncate hidden xs:block">
                  Realty Smartz
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowInstallModal(true)}
              className="flex h-8 items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2 sm:px-2.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition-colors"
              title="Install Realty Smartz App"
            >
              <Download className="h-3.5 w-3.5 text-[#5D3EBC]" />
              <span className="hidden sm:inline">Install</span>
            </button>

            <Link
              href="/employee-portal/dashboard"
              className="flex h-8 items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2 sm:px-2.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition-colors"
              title="Switch to Employee View"
            >
              <ArrowLeftRight className="h-3.5 w-3.5 text-[#5D3EBC]" />
              <span className="hidden sm:inline">Employee View</span>
            </Link>

            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex h-8 items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 sm:px-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100 active:scale-95 transition-all"
              title="Log Out of Admin Console"
            >
              <LogOut className="h-3.5 w-3.5 text-rose-600" />
              <span className="hidden sm:inline">Log Out</span>
            </button>
          </div>
        </header>

        <header className="sticky top-0 z-30 hidden h-14 items-center gap-6 bg-[#5D3EBC] px-6 text-white lg:flex">
          <p className="shrink-0 text-sm font-semibold">Realty Smartz</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              router.push(`/admin-portal/employees?q=${encodeURIComponent(query.trim())}`);
            }}
            className="relative w-full max-w-md"
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search employees"
              className="h-9 w-full rounded-full bg-white pl-9 pr-4 text-sm text-neutral-800 placeholder:text-neutral-400 outline-none"
            />
          </form>
          <div className="ml-auto flex items-center gap-4">
            <Link href="/admin-portal/settings/company" title="Company Settings" className="text-white/90 hover:text-white">
              <Settings className="h-5 w-5" />
            </Link>
            <div
              title={session?.user?.name ?? "Administrator"}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-400 text-xs font-semibold text-white"
            >
              {session?.user?.name?.[0] ?? "A"}
            </div>
          </div>
        </header>

        <InstallGuideModal
          isOpen={showInstallModal}
          onClose={() => setShowInstallModal(false)}
        />

        {/* Dashboard Main Content */}
        <main className="flex-1 w-full max-w-full min-w-0">
          <div className="mx-auto w-full max-w-[1600px] p-3 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
