"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, LogOut, Download, Search, Settings, ArrowLeftRight } from "lucide-react";
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
    <div className="relative min-h-screen w-full bg-[#F4F5FA] antialiased">
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
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-neutral-200/80 bg-white px-3 py-2.5 pt-[max(0.6rem,env(safe-area-inset-top))] sm:px-4 sm:py-3 lg:hidden">
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
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
              <Download className="h-3.5 w-3.5 text-[#5D3EBC]" />
              <span className="hidden sm:inline">Install</span>
            </button>
            <Link
              href="/employee-portal/dashboard"
              className="flex h-8 items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 sm:px-2.5"
            >
              <ArrowLeftRight className="h-3.5 w-3.5 text-[#5D3EBC]" />
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
              className="h-9 w-full rounded-full bg-white pl-9 pr-4 text-sm text-neutral-800 outline-none placeholder:text-neutral-400"
            />
          </form>
          <div className="ml-auto flex items-center gap-4">
            <Link
              href="/admin-portal/settings/company"
              title="Company Settings"
              className="text-white/90 hover:text-white"
            >
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

        <main
          className="min-w-0 w-full max-w-full flex-1"
          style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom, 0px))" }}
        >
          <div className="mx-auto w-full max-w-[1600px] p-3 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
