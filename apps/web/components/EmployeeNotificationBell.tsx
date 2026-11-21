"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  CalendarDays,
  Target,
  CheckCircle2,
  Clock,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
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

function getNotificationBadgeClass(badgeText?: string, rawBadgeColor?: string) {
  if (!badgeText) return "";
  const lower = badgeText.toLowerCase();
  if (lower.includes("approved") || lower.includes("present")) return "chip-ok";
  if (lower.includes("reject")) return "chip-danger";
  if (
    lower.includes("pending") ||
    lower.includes("late") ||
    lower.includes("breach") ||
    lower.includes("approval") ||
    lower.includes("waiting")
  ) {
    return "chip-warn";
  }
  return rawBadgeColor || "bg-[var(--soft)] text-[var(--ink)] border border-[var(--line)]";
}

export function EmployeeNotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const { data, refetch } = trpc.employee.notifications.useQuery(undefined, {
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });

  const savePush = trpc.attendance.savePushSubscription.useMutation();

  const unreadCount = data?.unreadCount ?? 0;
  const items = data?.items ?? [];
  const prevUnreadRef = useRef<number | null>(null);

  useEffect(() => {
    if (prevUnreadRef.current !== null && unreadCount > prevUnreadRef.current) {
      const latest = items[0];
      if (latest) {
        void sendDevicePushNotification({
          title: latest.title || "HRMS Notification",
          body: latest.subtitle || "",
          url: latest.href,
        });
      }
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount, items]);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator) {
      setPushSupported(true);
      if (Notification.permission === "granted") {
        setPushSubscribed(true);
      }
    }
  }, []);

  const handleEnablePush = async () => {
    try {
      if (!("Notification" in window)) return;
      const perm = await Notification.requestPermission();
      if (perm === "granted") {
        setPushSubscribed(true);
        if ("serviceWorker" in navigator) {
          const reg = await navigator.serviceWorker.ready;
          const pubKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
          if (pubKey) {
            const padding = "=".repeat((4 - (pubKey.length % 4)) % 4);
            const raw = atob((pubKey + padding).replace(/-/g, "+").replace(/_/g, "/"));
            const appServerKey = Uint8Array.from(raw, (c) => c.charCodeAt(0));
            const sub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: appServerKey,
            });
            const json = sub.toJSON();
            if (json.endpoint && json.keys?.p256dh && json.keys?.auth) {
              await savePush.mutateAsync({
                endpoint: json.endpoint,
                p256dh: json.keys.p256dh,
                auth: json.keys.auth,
              });
            }
          }
        }
      }
    } catch (e) {
      console.warn("[Push] Error enabling push:", e);
    }
  };

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

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Notifications"
        title="Notifications"
        style={{
          backgroundColor: isOpen ? "var(--soft)" : "var(--card)",
          borderColor: "var(--line)",
          color: "var(--ink)",
        }}
        className={cn(
          "relative flex h-8 w-8 items-center justify-center rounded-[4px] border bg-[var(--card)] text-[var(--ink)] hover:bg-[var(--soft)] transition-colors cursor-pointer",
          isOpen && "bg-[var(--soft)]"
        )}
      >
        <Bell className="h-4 w-4 text-[var(--ink)]" strokeWidth={1.8} />

        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[9px] font-bold text-[var(--accent-ink)] shadow-sm">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Dropdown Panel */}
      {isOpen && (
        <div className="notification-dropdown-panel fixed sm:absolute right-3 sm:right-0 top-16 sm:top-10 z-50 w-[calc(100vw-24px)] sm:w-96 max-w-sm rounded-[4px] border border-[var(--line)] bg-[var(--card)] text-[var(--ink)] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3 bg-[var(--soft)]/50">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="rounded-[2px] bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--accent-ink)]">
                  {unreadCount}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => void refetch()}
              className="text-[11px] font-semibold text-[var(--accent)] hover:underline"
            >
              Refresh
            </button>
          </div>

          {/* Web Push Prompt if not subscribed */}
          {pushSupported && !pushSubscribed && (
            <div className="border-b border-[var(--line)] bg-[var(--active)] p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-[var(--accent)]">
                  Enable Push Notifications
                </p>
                <p className="text-[10px] text-[var(--muted)]">
                  Receive instant alerts for leave approvals and attendance
                </p>
              </div>
              <button
                type="button"
                onClick={handleEnablePush}
                className="shrink-0 rounded-[2px] bg-[var(--accent)] px-2.5 py-1 text-[10px] font-bold text-[var(--accent-ink)] hover:brightness-110 transition-all cursor-pointer"
              >
                Enable
              </button>
            </div>
          )}

          {/* Notification List */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-[var(--line)]">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <CheckCircle2 className="h-8 w-8 text-[var(--muted)]/40 mb-2" strokeWidth={1.5} />
                <p className="text-xs font-semibold text-[var(--ink)]">All caught up</p>
                <p className="text-[11px] text-[var(--muted)] mt-0.5">
                  No new notifications right now
                </p>
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    setIsOpen(false);
                    if (item.href) router.push(item.href);
                  }}
                  className="flex items-start gap-3 p-3.5 hover:bg-[var(--soft)] transition-colors cursor-pointer"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] bg-[var(--soft)] border border-[var(--line)] text-[var(--accent)]">
                    {item.type === "LEAVE" ? (
                      <CalendarDays className="h-4 w-4 text-[var(--accent)]" strokeWidth={1.8} />
                    ) : item.type === "TARGET" ? (
                      <Target className="h-4 w-4 text-[var(--ok)]" strokeWidth={1.8} />
                    ) : (
                      <Clock className="h-4 w-4 text-[var(--warn)]" strokeWidth={1.8} />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-[var(--ink)] truncate">
                        {item.title}
                      </p>
                      <span className="text-[10px] text-[var(--muted)] shrink-0">
                        {formatRelativeTime(item.time)}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--muted)] mt-0.5 line-clamp-2">
                      {item.subtitle}
                    </p>
                    {item.badgeText && (
                      <span
                        className={cn(
                          "mt-1.5 inline-block text-[9px] font-bold px-2 py-0.5 rounded-[2px] border",
                          getNotificationBadgeClass(item.badgeText, item.badgeColor)
                        )}
                      >
                        {item.badgeText}
                      </span>
                    )}
                  </div>

                  <ChevronRight className="h-3.5 w-3.5 text-[var(--muted)] shrink-0 self-center" strokeWidth={1.8} />
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
