"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCircle2,
  CalendarDays,
  MapPin,
  Clock,
  UserCheck,
  Briefcase,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

function formatRelativeTime(dateInput: Date | string | null | undefined): string {
  if (!dateInput) return "";
  const date = new Date(dateInput);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function AdminNotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const { data, isLoading } = trpc.employee.notifications.useQuery(undefined, {
    refetchInterval: 20000,
    refetchOnWindowFocus: true,
  });

  const unreadCount = data?.unreadCount ?? 0;
  const items = data?.items ?? [];

  // Close dropdown on click outside or escape key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const getIconForType = (type: string) => {
    switch (type) {
      case "LEAVE":
        return <CalendarDays className="h-4 w-4 text-purple-600" />;
      case "GEOFENCE":
        return <MapPin className="h-4 w-4 text-amber-600" />;
      case "LATE":
        return <Clock className="h-4 w-4 text-rose-600" />;
      case "CANDIDATE":
        return <Briefcase className="h-4 w-4 text-blue-600" />;
      default:
        return <Bell className="h-4 w-4 text-neutral-600" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Notification Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Toggle notifications menu"
        title={unreadCount > 0 ? `${unreadCount} Pending Notifications` : "Notifications"}
        className={cn(
          "relative flex h-9 w-9 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100 transition-colors cursor-pointer",
          isOpen && "bg-neutral-100 text-neutral-900"
        )}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-[#6D28D9] text-[9px] font-bold text-white ring-2 ring-white animate-in zoom-in-50 duration-200">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl border border-neutral-200 bg-white shadow-2xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3 bg-neutral-50/80">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-neutral-900">Notifications</span>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700">
                    {unreadCount} pending
                  </span>
                )}
              </div>
              <Link
                href="/admin-portal/leave/approvals"
                onClick={() => setIsOpen(false)}
                className="text-[11px] font-semibold text-[#5145CD] hover:underline"
              >
                Approvals
              </Link>
            </div>

            {/* Notification List Body */}
            <div className="max-h-[380px] overflow-y-auto divide-y divide-neutral-100">
              {isLoading ? (
                <div className="p-6 text-center text-xs text-neutral-500">
                  Loading notifications…
                </div>
              ) : items.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 mb-2.5">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-bold text-neutral-800">All caught up!</p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    No pending leave requests or attendance alerts right now.
                  </p>
                </div>
              ) : (
                items.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      setIsOpen(false);
                      router.push(item.href);
                    }}
                    className="flex items-start gap-3 p-3.5 hover:bg-neutral-50 transition-colors cursor-pointer group"
                  >
                    {/* Icon or Avatar */}
                    <div className="shrink-0 mt-0.5">
                      {item.avatar ? (
                        <img
                          src={item.avatar}
                          alt=""
                          className="h-8 w-8 rounded-full object-cover ring-1 ring-neutral-200"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100">
                          {getIconForType(item.type)}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs font-bold text-neutral-900 truncate">
                          {item.title}
                        </p>
                        <span className="text-[10px] text-neutral-400 shrink-0">
                          {formatRelativeTime(item.time)}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-600 line-clamp-2 mt-0.5 leading-snug">
                        {item.subtitle}
                      </p>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-semibold border",
                            item.badgeColor
                          )}
                        >
                          {item.badgeText}
                        </span>
                        <span className="text-[10px] text-neutral-400 group-hover:text-[#5145CD] font-medium flex items-center gap-0.5 ml-auto transition-colors">
                          Review <ChevronRight className="h-2.5 w-2.5" />
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-neutral-100 p-2.5 bg-neutral-50/50 flex items-center justify-between text-xs">
              <Link
                href="/admin-portal/leave/approvals"
                onClick={() => setIsOpen(false)}
                className="w-full text-center py-1 font-semibold text-[#5145CD] hover:text-[#4338CA] transition-colors"
              >
                View All Pending Leave Approvals →
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

