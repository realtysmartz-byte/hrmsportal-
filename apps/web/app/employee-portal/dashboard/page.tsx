"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { CheckInOutCard } from "@/components/CheckInOutCard";

function getInitials(firstOrFull?: string | null, last?: string | null): string {
  if (!firstOrFull && !last) return "U";
  if (firstOrFull && last) {
    return `${firstOrFull.charAt(0)}${last.charAt(0)}`.toUpperCase();
  }
  const parts = (firstOrFull || "").trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
  }
  return (parts[0] || "U").slice(0, 2).toUpperCase();
}

function getDaysUntil(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays > 1 && diffDays <= 30) return `In ${diffDays} days`;
  if (diffDays > 30) {
    const months = Math.floor(diffDays / 30);
    return `In ~${months} mo`;
  }
  if (diffDays < 0 && diffDays >= -35) {
    return `${Math.abs(diffDays)}d ago`;
  }
  return "Past";
}

function formatHolidayDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const month = dt.toLocaleString("en-US", { month: "short", timeZone: "UTC" }).toUpperCase();
  const day = String(d).padStart(2, "0");
  return { month, day };
}

export default function EmployeeDashboardPage() {
  const { data: session } = useSession();
  const employeeId = session?.user?.id;

  const { data: rawUpcomingHolidays, isLoading: holidaysLoading } =
    trpc.holiday.upcoming.useQuery({ limit: 8 }, { staleTime: 30_000, refetchOnWindowFocus: true });

  const upcomingHolidays = useMemo(() => {
    if (!rawUpcomingHolidays) return [];
    const todayIST = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    return (rawUpcomingHolidays as Array<{ id: string; name: string; date: string; dayName?: string; type?: string; description?: string | null }>).filter(
      (h) => h.date >= todayIST
    );
  }, [rawUpcomingHolidays]);

  const { data: birthdays, isLoading: birthdaysLoading } =
    trpc.employee.getUpcomingBirthdays.useQuery(undefined, {
      staleTime: 5 * 60_000,
      refetchOnWindowFocus: true,
    });

  const displayBirthdays = birthdays ?? [];

  return (
    <div className="w-full text-[var(--ink)]">
      {/* 1. Clock Card (White) */}
      <CheckInOutCard />

      {/* 2. Quick Actions (4-Column Grid) */}
      <div className="grid grid-cols-4 gap-2 my-[18px] mb-[22px]">
        {/* Apply Leave */}
        <Link
          href="/employee-portal/leave"
          className="flex flex-col items-center gap-1.5 border-0 bg-transparent cursor-pointer text-[11px] font-semibold text-center leading-[1.2] text-[var(--ink)] select-none group"
        >
          <i className="w-12 h-12 grid place-items-center bg-[var(--active)] rounded-[4px] text-[var(--accent)] group-hover:brightness-95 transition-all">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[22px] h-[22px]">
              <rect width="18" height="18" x="3" y="4" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4" />
            </svg>
          </i>
          Apply Leave
        </Link>

        {/* Leave Balance */}
        <Link
          href="/employee-portal/leave"
          className="flex flex-col items-center gap-1.5 border-0 bg-transparent cursor-pointer text-[11px] font-semibold text-center leading-[1.2] text-[var(--ink)] select-none group"
        >
          <i className="w-12 h-12 grid place-items-center bg-[var(--active)] rounded-[4px] text-[var(--accent)] group-hover:brightness-95 transition-all">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[22px] h-[22px]">
              <rect width="8" height="4" x="8" y="2" rx="1" />
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 14l2 2 4-4" />
            </svg>
          </i>
          Leave Balance
        </Link>

        {/* ID Card */}
        <Link
          href="/employee-portal/id-card"
          className="flex flex-col items-center gap-1.5 border-0 bg-transparent cursor-pointer text-[11px] font-semibold text-center leading-[1.2] text-[var(--ink)] select-none group"
        >
          <i className="w-12 h-12 grid place-items-center bg-[var(--active)] rounded-[4px] text-[var(--accent)] group-hover:brightness-95 transition-all">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[22px] h-[22px]">
              <rect width="20" height="14" x="2" y="5" rx="2" />
              <circle cx="8" cy="11" r="2" />
              <path d="M5 16c.5-1.5 1.7-2 3-2s2.5.5 3 2M14 9h4M14 13h4" />
            </svg>
          </i>
          ID Card
        </Link>

        {/* Performance */}
        <Link
          href="/employee-portal/performance"
          className="flex flex-col items-center gap-1.5 border-0 bg-transparent cursor-pointer text-[11px] font-semibold text-center leading-[1.2] text-[var(--ink)] select-none group"
        >
          <i className="w-12 h-12 grid place-items-center bg-[var(--active)] rounded-[4px] text-[var(--accent)] group-hover:brightness-95 transition-all">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[22px] h-[22px]">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="6" />
              <circle cx="12" cy="12" r="2" />
            </svg>
          </i>
          Performance
        </Link>
      </div>

      {/* 3. Birthdays Section: Stationary horizontally scrollable compact cards */}
      <div className="flex justify-between items-baseline mb-2.5">
        <h2 className="text-[15px] font-bold text-[var(--ink)] m-0">Wish them</h2>
        <span className="text-[11px] text-[var(--muted)]">Next 30 Days</span>
      </div>
      <div className="-mx-4 px-4 overflow-x-auto scrollbar-none mb-[20px]">
        {birthdaysLoading ? (
          <div className="flex gap-2.5 pb-1">
            {[0, 1, 2, 3].map((n) => (
              <div
                key={n}
                className="w-[86px] flex-none text-center p-[10px_6px_8px] border border-[var(--line)] rounded-[4px] bg-[var(--bg)] animate-pulse"
              >
                <div className="w-[44px] h-[44px] mx-auto rounded-full bg-[var(--active)]" />
                <div className="mt-2 h-2.5 w-14 mx-auto rounded bg-[var(--active)]" />
                <div className="mt-1 h-2 w-10 mx-auto rounded bg-[var(--active)]" />
              </div>
            ))}
          </div>
        ) : displayBirthdays.length > 0 ? (
          <div className="flex gap-2.5 pb-1">
            {displayBirthdays.map((b, idx) => (
              <div
                key={b.id || idx}
                className={cn(
                  "w-[86px] flex-none text-center p-[10px_6px_8px] border border-[var(--line)] rounded-[4px] bg-[var(--bg)] select-none",
                  b.isToday && "ring-1 ring-[var(--accent)] border-[var(--accent)]"
                )}
              >
                <div
                  className={cn(
                    "w-[44px] h-[44px] mx-auto rounded-full bg-[var(--active)] grid place-items-center overflow-hidden text-[var(--accent)] text-sm font-bold",
                    b.isToday && "outline outline-2 outline-[var(--accent)] outline-offset-[2px]"
                  )}
                >
                  {b.profilePhotoUrl ? (
                    <img src={b.profilePhotoUrl} alt={b.name} className="w-full h-full object-cover block" />
                  ) : (
                    <span>{getInitials(b.firstName, b.lastName)}</span>
                  )}
                </div>
                <b className="block mt-1.5 text-[11px] font-semibold text-[var(--ink)] whitespace-nowrap overflow-hidden text-ellipsis">
                  {b.name}
                </b>
                <small className={cn("block mt-0.5 text-[10px]", b.isToday ? "text-[var(--accent)] font-bold" : "text-[var(--muted)]")}>
                  {b.isToday ? "Today" : b.birthdayDate}
                </small>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[4px] border border-[var(--line)] bg-[var(--bg)] p-3.5 text-[12px] text-[var(--muted)]">
            No upcoming birthdays in the next 30 days.
          </div>
        )}
      </div>

      {/* 4. Upcoming Holidays */}
      <div className="flex justify-between items-baseline mb-3">
        <h2 className="text-[16px] font-bold text-[var(--ink)] m-0">Upcoming Holidays</h2>
        <span className="text-[12px] text-[var(--muted)]">{upcomingHolidays?.length ?? 0} Listed</span>
      </div>
      <div className="rounded-[4px] border border-[var(--line)] bg-[var(--bg)]">
        {upcomingHolidays && upcomingHolidays.length > 0 ? (
          <div className="divide-y divide-[var(--line)]">
            {upcomingHolidays.map((h) => {
              const { month, day } = formatHolidayDate(h.date);
              const daysUntil = getDaysUntil(h.date);
              return (
                <div key={h.id} className="flex items-center justify-between p-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-[4px] bg-[var(--active)] flex flex-col items-center justify-center shrink-0">
                      <span className="text-[9px] font-bold text-[var(--accent)] uppercase">{month}</span>
                      <span className="text-[13px] font-extrabold text-[var(--ink)] leading-tight">{day}</span>
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-[var(--ink)]">{h.name}</p>
                      <p className="text-[12px] text-[var(--muted)]">{h.dayName}</p>
                    </div>
                  </div>
                  <span className="text-[12px] font-semibold text-[var(--muted)]">{daysUntil}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-4 text-[13px] text-[var(--muted)]">
            No upcoming holidays scheduled at this time.
          </div>
        )}
      </div>
    </div>
  );
}
