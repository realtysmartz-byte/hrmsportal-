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
  Briefcase,
  Target,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { sendDevicePushNotification } from "@/lib/client-notifications";

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
  const prevUnreadRef = useRef<number | null>(null);

  useEffect(() => {
    if (prevUnreadRef.current !== null && unreadCount > prevUnreadRef.current) {
      const latest = items[0];
      if (latest) {
        void sendDevicePushNotification({
          title: latest.title || "HRMS Admin Notification",
          body: latest.subtitle || "",
          url: latest.href,
        });
      }
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount, items]);

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
        return <CalendarDays className="h-4 w-4 text-[var(--accent)]" strokeWidth={1.8} />;
      case "GEOFENCE":
        return <MapPin className="h-4 w-4 text-[var(--warn)]" strokeWidth={1.8} />;
      case "LATE":
        return <Clock className="h-4 w-4 text-[var(--danger)]" strokeWidth={1.8} />;
      case "CANDIDATE":
        return <Briefcase className="h-4 w-4 text-[var(--info)]" strokeWidth={1.8} />;
      case "TARGET":
        return <Target className="h-4 w-4 text-[var(--accent)]" strokeWidth={1.8} />;
      default:
        return <Bell className="h-4 w-4 text-[var(--muted)]" strokeWidth={1.8} />;
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
          "relative flex h-9 w-9 items-center justify-center rounded text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--hover)] transition-colors cursor-pointer",
          isOpen && "bg-[var(--hover)] text-[var(--ink)]"
        )}
      >
        <Bell className="h-[19px] w-[19px]" strokeWidth={1.8} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-[var(--accent)] text-[9px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded border border-[var(--line)] bg-[var(--card)] shadow-lg z-50 overflow-hidden text-[var(--ink)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3 bg-[var(--field)]">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-[var(--ink)]">Notifications</span>
                {unreadCount > 0 && (
                  <span className="rounded px-2 py-0.5 text-[10px] font-semibold bg-[var(--accent)]/14 text-[var(--accent)]">
                    {unreadCount} pending
                  </span>
                )}
              </div>
              <Link
                href="/admin-portal/leave/approvals"
                onClick={() => setIsOpen(false)}
                className="text-[11px] font-semibold text-[var(--accent)] hover:underline"
              >
                Approvals
              </Link>
            </div>

            {/* Notification List Body */}
            <div className="max-h-[380px] overflow-y-auto divide-y divide-[var(--line)]">
              {isLoading ? (
                <div className="p-6 text-center text-xs text-[var(--muted)]">
                  Loading notifications…
                </div>
              ) : items.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded bg-[var(--ok)]/14 text-[var(--ok)] mb-2.5">
                    <CheckCircle2 className="h-5 w-5" strokeWidth={1.8} />
                  </div>
                  <p className="text-sm font-semibold text-[var(--ink)]">All caught up</p>
                  <p className="text-xs text-[var(--muted)] mt-0.5">
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
                    className="flex items-start gap-3 p-3.5 hover:bg-[var(--hover)] transition-colors cursor-pointer group"
                  >
                    {/* Icon or Avatar */}
                    <div className="shrink-0 mt-0.5">
                      {item.avatar ? (
                        <img
                          src={item.avatar}
                          alt=""
                          className="h-8 w-8 rounded object-cover border border-[var(--line)]"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-[var(--field)]">
                          {getIconForType(item.type)}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-[var(--ink)] truncate">
                          {item.title}
                        </p>
                        <span className="text-[10px] text-[var(--muted)] shrink-0">
                          {formatRelativeTime(item.time)}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--muted)] line-clamp-2 mt-0.5">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
