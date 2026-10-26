"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { PlaneTakeoff, ClipboardCheck, IdCard, CalendarDays } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { CheckInOutCard } from "@/components/CheckInOutCard";
import { NotificationPrompt } from "@/components/NotificationPrompt";

const quickActions = [
  { href: "/employee-portal/leave", label: "Apply Leave", icon: PlaneTakeoff },
  { href: "/employee-portal/leave", label: "Leave Balance", icon: ClipboardCheck },
  { href: "/employee-portal/id-card", label: "ID Card", icon: IdCard },
];

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

  // Fetch actual employee profile data to retrieve real profile photo
  const { data: profileHubData } = trpc.employee.profileHub.useQuery(
    { id: employeeId! },
    { enabled: Boolean(employeeId), staleTime: 10 * 60_000 }
  );

  const profilePhoto = profileHubData?.employee?.profilePhotoUrl || session?.user?.image || null;
  const userName = profileHubData?.employee
    ? `${profileHubData.employee.firstName} ${profileHubData.employee.lastName}`.trim()
    : session?.user?.name ?? "Employee";
  const userInitials = profileHubData?.employee
    ? getInitials(profileHubData.employee.firstName, profileHubData.employee.lastName)
    : getInitials(userName);

  const { data: upcomingHolidays, isLoading: holidaysLoading } =
    trpc.holiday.upcoming.useQuery({ limit: 6 }, { staleTime: 15 * 60_000 });
  const { data: birthdays, isLoading: birthdaysLoading } =
    trpc.employee.getUpcomingBirthdays.useQuery(undefined, {
      staleTime: 15 * 60_000,
    });

  return (
    <div className="-mx-3 sm:-mx-5 md:-mx-6 -mt-4 sm:-mt-6 md:-mt-8 pb-4">
      {/* 1. Seamless Deep Purple Quick Actions Ribbon (Avatar moved to top navbar) */}
      <div className="bg-gradient-to-b from-[#2A1167] via-[#3E1A96] to-[#5523BE] pt-2 pb-6 px-3">
        <div className="mx-auto max-w-lg">
          {/* Three White Circular Quick Action Buttons on Purple Background */}
          <div className="flex justify-center items-center gap-7 sm:gap-9 py-1">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.label}
                  href={action.href}
                  className="group flex flex-col items-center gap-1 text-center transition-transform active:scale-95"
                >
                  <div className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-white text-[#5225C5] shadow-[0_4px_14px_rgba(20,5,55,0.22)] group-hover:scale-105 transition-all">
                    <Icon className="h-5 w-5 stroke-[2.2px]" />
                  </div>
                  <span className="text-[10px] font-semibold text-white tracking-tight">
                    {action.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Content Body with Overlapping Check-In Card */}
      <div className="mx-auto max-w-lg px-3 sm:px-4 space-y-2.5 -mt-5 relative z-10">
        {/* Main Elevated Attendance Check-In Card */}
        <CheckInOutCard />

        <NotificationPrompt />

        {/* 3. "Wish them" Birthday Section (Compact for Mobile) */}
        <div className="rounded-2xl bg-white border border-[#EAE4F8] p-3 sm:p-3.5 shadow-[0_4px_20px_rgba(78,36,201,0.04)]">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-1.5">
            <h2 className="text-xs font-bold text-[#1C113B]">Wish them</h2>
            <span className="text-[10px] font-medium text-[#7A6E9B]">Next 30 Days</span>
          </div>

          {birthdaysLoading ? (
            <p className="py-2 text-center text-[11px] text-neutral-400">Loading birthdays...</p>
          ) : birthdays && birthdays.length > 0 ? (
            <div className="mt-2.5 flex items-center gap-3.5 overflow-x-auto pb-1.5 scrollbar-none">
              {birthdays.map((b) => (
                <div
                  key={b.id}
                  className="flex w-18 shrink-0 flex-col items-center text-center select-none"
                >
                  {/* Expanded, Clearly Visible Circular Avatar */}
                  <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 border-[#8B5CF6]/40 bg-[#F5F2FC] p-0.5 shadow-2xs">
                    {b.profilePhotoUrl ? (
                      <img
                        src={b.profilePhotoUrl}
                        alt={b.name}
                        className="h-full w-full rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-tr from-[#7C3AED] to-[#A855F7] text-white font-bold text-xs tracking-tight">
                        {getInitials(b.firstName, b.lastName)}
                      </div>
                    )}
                  </div>

                  {/* Small B'Day Tag positioned below image (does not obstruct face) */}
                  <span className="mt-1 inline-flex items-center rounded-full bg-[#F3EAFD] border border-[#E9D5FF] px-1.5 py-px text-[7.5px] font-extrabold text-[#7C3AED] tracking-wider uppercase">
                    B&apos;DAY
                  </span>

                  {/* Colleague Name & Birthday */}
                  <p className="mt-1 w-full truncate text-[11px] font-semibold text-[#1C113B] leading-tight">
                    {b.name}
                  </p>
                  <p className="text-[9.5px] font-medium text-[#7D7398] leading-none mt-0.5">
                    {b.isToday ? "Today" : b.birthdayDate}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-2 text-xs text-neutral-400 text-center">
              No birthdays in the next 30 days.
            </p>
          )}
        </div>

        {/* 4. Upcoming Holidays Section (Compact for Mobile) */}
        <div className="rounded-2xl bg-white border border-[#EAE4F8] p-3 sm:p-3.5 shadow-[0_4px_20px_rgba(78,36,201,0.04)]">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-1.5">
            <div className="flex items-center gap-1.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#F3EAFD] text-[#5225C5]">
                <CalendarDays className="h-3.5 w-3.5" />
              </div>
              <h2 className="text-xs font-bold text-[#1C113B]">Upcoming Holidays</h2>
            </div>
            <span className="rounded-full bg-[#F3EAFD] px-2 py-0.5 text-[9px] font-bold text-[#5225C5]">
              {upcomingHolidays?.length ?? 0} Listed
            </span>
          </div>

          {holidaysLoading ? (
            <div className="py-3 text-center text-[11px] text-neutral-400">
              Loading holidays...
            </div>
          ) : upcomingHolidays && upcomingHolidays.length > 0 ? (
            <div className="mt-1 divide-y divide-neutral-100 max-h-56 overflow-y-auto pr-0.5 scrollbar-thin">
              {upcomingHolidays.map((h) => {
                const { month, day } = formatHolidayDate(h.date);
                const daysUntil = getDaysUntil(h.date);
                return (
                  <div
                    key={h.id}
                    className="flex items-center justify-between gap-2.5 py-1.5 hover:bg-neutral-50/70 rounded-xl px-1 -mx-1 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Date Badge */}
                      <div className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-xl border border-[#E9E1F7] bg-gradient-to-b from-[#FBF9FE] to-[#F2EDFD] shadow-2xs">
                        <span className="text-[7px] font-extrabold text-[#5225C5] tracking-wider uppercase leading-none">
                          {month}
                        </span>
                        <span className="text-xs font-black text-[#1C113B] leading-tight">
                          {day}
                        </span>
                      </div>

                      {/* Holiday Name & Details */}
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-bold text-[#1C113B] leading-tight">
                          {h.name}
                        </p>
                        <p className="text-[10px] font-medium text-[#7A6E9B] truncate leading-none mt-0.5">
                          {h.dayName}
                          {h.type === "PUBLIC" ? " • Public Off" : " • Company Off"}
                        </p>
                      </div>
                    </div>

                    {/* Countdown Pill */}
                    <div className="shrink-0">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[9px] font-bold shadow-2xs",
                          daysUntil === "Today" || daysUntil === "Tomorrow"
                            ? "bg-amber-100 text-amber-800 border border-amber-200"
                            : "bg-[#F3EAFD] text-[#5225C5] border border-[#E7DBFA]"
                        )}
                      >
                        {daysUntil}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-2 text-[11px] text-neutral-400 text-center">
              No upcoming holidays scheduled at this time.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
