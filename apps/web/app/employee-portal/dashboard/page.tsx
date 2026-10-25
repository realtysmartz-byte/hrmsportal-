"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Search, PlaneTakeoff, ListChecks, ChevronRight, IdCard } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn, initials } from "@/lib/utils";
import { CheckInOutCard } from "@/components/CheckInOutCard";
import { NotificationPrompt } from "@/components/NotificationPrompt";
import { formatTimeIST } from "@realty-smartz/shared";

const quickActions = [
  { href: "/employee-portal/leave", label: "Apply Leave", icon: PlaneTakeoff },
  { href: "/employee-portal/leave", label: "Leave Balance", icon: ListChecks },
  { href: "/employee-portal/id-card", label: "ID Card", icon: IdCard },
];

export default function EmployeeDashboardPage() {
  const { data: session } = useSession();
  const userName = session?.user?.name ?? "";
  const [first = "", last = ""] = userName.split(" ");

  const { data: recentWeek } = trpc.attendance.myRecentWeek.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });
  const { data: birthdays, isLoading: birthdaysLoading } = trpc.employee.getUpcomingBirthdays.useQuery(undefined, {
    staleTime: 15 * 60_000,
  });

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex items-center gap-3">
        <Link
          href="/employee-portal/profile"
          className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-50 text-sm font-medium text-emerald-700 border border-neutral-200"
          title={userName || "Profile"}
        >
          {session?.user?.image ? (
            <img
              src={session.user.image}
              alt={userName || "Profile"}
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            initials(first, last) || "U"
          )}
        </Link>
        <Link
          href="/employee-portal/directory"
          className="flex h-11 flex-1 items-center justify-between rounded-xl bg-neutral-100 px-4 text-sm text-neutral-500"
        >
          Search your colleagues
          <Search className="h-5 w-5 text-neutral-700" />
        </Link>
      </div>

      <div className="flex gap-6">
        {quickActions.map((a) => {
          const Icon = a.icon;
          return (
            <Link key={a.label} href={a.href} className="flex w-16 flex-col items-center gap-1.5 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-[#5D3EBC]/20 bg-[#F3F0FC] text-[#5D3EBC]">
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-xs leading-tight text-neutral-700">{a.label}</span>
            </Link>
          );
        })}
      </div>

      <NotificationPrompt />

      <div className="grid gap-5 lg:grid-cols-2">
        <CheckInOutCard />

        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-neutral-900">Wish them</h2>
          {birthdaysLoading ? (
            <p className="mt-3 rounded-xl border border-neutral-100 p-4 text-center text-xs text-neutral-400">
              Loading…
            </p>
          ) : birthdays && birthdays.length > 0 ? (
            <div className="mt-3 flex gap-5 overflow-x-auto pb-1">
              {birthdays.map((b) => (
                <Link
                  key={b.id}
                  href={`/employee-portal/directory/${b.id}`}
                  className="flex w-20 shrink-0 flex-col items-center text-center"
                >
                  <div className="relative">
                    <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-rose-50 text-lg text-rose-500">
                      {b.profilePhotoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={b.profilePhotoUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        initials(b.firstName, b.lastName)
                      )}
                    </div>
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-[#B57EDC] px-2 py-px text-[9px] font-semibold text-white">
                      B&apos;DAY
                    </span>
                  </div>
                  <p className="mt-2 w-full truncate text-xs text-neutral-800">{b.name}</p>
                  <p className="text-[11px] text-neutral-500">{b.isToday ? "Today" : b.birthdayDate}</p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-3 rounded-xl border border-neutral-200 p-4 text-center text-xs text-neutral-500">
              No birthdays in the next 30 days.
            </p>
          )}
        </div>
      </div>

      {recentWeek && recentWeek.length > 0 && (
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-900">This week</h2>
            <Link href="/employee-portal/attendance" className="text-sm font-medium text-[#5D3EBC]">
              View all
            </Link>
          </div>
          <div className="mt-3 divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
            {recentWeek.map((day) => {
              const log = day.log;
              return (
                <Link
                  key={day.dateStr}
                  href="/employee-portal/attendance"
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-900">
                      {day.dayName}{" "}
                      <span className="font-normal text-neutral-500">
                        {day.formattedDate.split(",")[0] || day.formattedDate}
                      </span>
                      {day.isToday && (
                        <span className="ml-1.5 rounded bg-[#F3F0FC] px-1.5 py-0.5 text-[10px] font-semibold text-[#5D3EBC]">
                          Today
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {log?.checkInTime
                        ? `${formatTimeIST(log.checkInTime)} - ${log.checkOutTime ? formatTimeIST(log.checkOutTime) : "On duty"}`
                        : day.isWeeklyOff
                        ? "Weekly off"
                        : "No punch"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={cn(
                        "text-xs font-medium",
                        log?.status === "PRESENT" && "text-emerald-600",
                        (log?.status === "LATE" || log?.status === "HALF_DAY") && "text-amber-600",
                        log?.status === "ABSENT" && "text-rose-600",
                        log?.status === "ON_LEAVE" && "text-sky-600",
                        !log && "text-neutral-400"
                      )}
                    >
                      {log ? log.status.replace("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : "—"}
                    </span>
                    <ChevronRight className="h-4 w-4 text-neutral-300" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
