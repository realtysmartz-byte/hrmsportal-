"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ArrowLeftRight, LogOut, Download } from "lucide-react";
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
    <div className="relative flex min-h-screen w-full max-w-full overflow-x-hidden bg-[#F6F8FB] antialiased">
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
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-neutral-200/80 bg-white/95 backdrop-blur-md px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:hidden shadow-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-100 text-neutral-800 hover:bg-neutral-200 active:scale-95 transition-all"
              title="Open Navigation Menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <img
                src="/logo.png"
                alt="Realty Smartz"
                className="h-6 w-6 object-contain"
              />
              <div>
                <p className="font-display text-xs font-bold text-neutral-900 leading-tight">
                  Admin Console
                </p>
                <p className="text-[10px] text-neutral-400 font-medium leading-none">
                  Realty Smartz Private Limited
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setShowInstallModal(true)}
              className="flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition-colors"
              title="Install Realty Smartz App"
            >
              <Download className="h-3 w-3 text-[#FF7A70]" />
              <span className="hidden sm:inline">Install</span>
            </button>

            <Link
              href="/employee-portal/dashboard"
              className="flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition-colors"
            >
              <ArrowLeftRight className="h-3 w-3 text-[#FF7A70]" />
              <span className="hidden sm:inline">Employee View</span>
            </Link>

            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100 active:scale-95 transition-all shadow-2xs"
              title="Log Out of Admin Console"
            >
              <LogOut className="h-3.5 w-3.5 text-rose-600" />
              <span>Log Out</span>
            </button>
          </div>
        </header>

        <InstallGuideModal
          isOpen={showInstallModal}
          onClose={() => setShowInstallModal(false)}
        />

        {/* Dashboard Main Content */}
        <main className="flex-1 w-full max-w-full overflow-x-hidden">
          <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8 overflow-hidden">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
