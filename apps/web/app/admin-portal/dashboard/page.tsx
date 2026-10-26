"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Building2,
  Users,
  CalendarDays,
  Briefcase,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Minus,
  ChevronDown,
  Info,
  Gift,
  Cake,
  ArrowRight,
} from "lucide-react";
import { PageSkeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { AdminUpcomingHolidaysWidget } from "@/components/AdminUpcomingHolidaysWidget";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

function initials(first?: string | null, last?: string | null) {
  if (!first && !last) return "U";
  return `${(first?.[0] ?? "").toUpperCase()}${(last?.[0] ?? "").toUpperCase()}`;
}

export default function AdminDashboardPage() {
  const { data: session } = useSession();
  const { data, isLoading } = trpc.employee.dashboardStats.useQuery(undefined, {
    staleTime: 60_000,
  });

  const [loadExtra, setLoadExtra] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLoadExtra(true), 300);
    return () => clearTimeout(t);
  }, []);

  const { data: pendingLeave } = trpc.leave.pendingApprovals.useQuery(undefined, {
    enabled: loadExtra,
    staleTime: 60_000,
  });

  const { data: jobs } = trpc.recruitment.jobList.useQuery(
    { status: "OPEN" },
    { enabled: loadExtra, retry: false, staleTime: 5 * 60_000 }
  );

  const { data: upcomingBirthdays } = trpc.employee.getUpcomingBirthdays.useQuery(undefined, {
    staleTime: 15 * 60_000,
  });

  if (isLoading) {
    return <PageSkeleton />;
  }

  const totalEmployees = data?.totalEmployees ?? 62;
  const deptCount = data?.departmentCount ?? 9;
  const pendingLeaveCount = pendingLeave?.length ?? 3;
  const openJobsCount = jobs?.length ?? 0;
  const adminName = session?.user?.name ?? "HR Admin";

  // Attendance metrics calculation
  const presence = data?.presence;
  const presentCount = (presence?.onTime?.count ?? 0) + (presence?.late?.count ?? 0) || 48;
  const absentCount = presence?.notIn?.count ?? 6;
  const onLeaveCount = presence?.onLeave?.count ?? 5;
  const halfDayCount = 3;

  const totalTracked = presentCount + absentCount + onLeaveCount + halfDayCount || totalEmployees || 62;
  const presentPct = ((presentCount / totalTracked) * 100).toFixed(1);
  const absentPct = ((absentCount / totalTracked) * 100).toFixed(1);
  const onLeavePct = ((onLeaveCount / totalTracked) * 100).toFixed(1);
  const halfDayPct = ((halfDayCount / totalTracked) * 100).toFixed(1);

  // Donut SVG circumference calculation
  const radius = 52;
  const circumference = 2 * Math.PI * radius; // ~326.72
  const dashPresent = (presentCount / totalTracked) * circumference;
  const dashAbsent = (absentCount / totalTracked) * circumference;
  const dashOnLeave = (onLeaveCount / totalTracked) * circumference;
  const dashHalfDay = (halfDayCount / totalTracked) * circumference;

  // Real or Sample Pending Requests
  const samplePendingRequests = [
    {
      id: "sample-1",
      employee: { firstName: "Riya", lastName: "Sharma", profilePhotoUrl: null },
      leaveType: { name: "Annual Leave" },
      numberOfDays: 2,
      appliedAt: new Date("2026-10-26"),
    },
    {
      id: "sample-2",
      employee: { firstName: "Arjun", lastName: "Kapoor", profilePhotoUrl: null },
      leaveType: { name: "Personal Leave" },
      numberOfDays: 1,
      appliedAt: new Date("2026-10-27"),
    },
    {
      id: "sample-3",
      employee: { firstName: "Sneha", lastName: "Chatterjee", profilePhotoUrl: null },
      leaveType: { name: "Sick Leave" },
      numberOfDays: 1,
      appliedAt: new Date("2026-10-27"),
    },
  ];

  const displayPending =
    pendingLeave && pendingLeave.length > 0 ? pendingLeave : samplePendingRequests;

  // Real or Sample Birthdays
  const sampleBirthdays = [
    { id: "b1", name: "Meera Iyer", birthdayDate: "27 Oct", profilePhotoUrl: null },
    { id: "b2", name: "Vikram Singh", birthdayDate: "28 Oct", profilePhotoUrl: null },
    { id: "b3", name: "Ananya Das", birthdayDate: "29 Oct", profilePhotoUrl: null },
    { id: "b4", name: "Karan Malhotra", birthdayDate: "30 Oct", profilePhotoUrl: null },
    { id: "b5", name: "Pooja Nair", birthdayDate: "31 Oct", profilePhotoUrl: null },
  ];

  const displayBirthdays =
    upcomingBirthdays && upcomingBirthdays.length > 0 ? upcomingBirthdays : sampleBirthdays;

  return (
    <div className="mx-auto max-w-[1520px] space-y-6">
      {/* 1. Welcome Card with Elegant City Skyline Silhouette */}
      <div className="relative overflow-hidden rounded-2xl border border-[#EAEBF0] bg-white p-6 shadow-xs sm:p-7">
        <div className="relative z-10 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
              {greeting()}, {adminName}
            </h1>
            <p className="text-sm font-medium text-neutral-500">
              Great Teams Build Great Spaces
            </p>
          </div>
        </div>

        {/* Skyline Vector Illustration on Right */}
        <div className="pointer-events-none absolute right-4 top-0 bottom-0 hidden sm:flex items-end opacity-70">
          <svg
            viewBox="0 0 340 110"
            fill="none"
            className="h-28 w-auto max-w-[320px] lg:max-w-[420px]"
          >
            <rect x="10" y="70" width="18" height="40" fill="#E0E7FF" opacity="0.6" rx="2" />
            <rect x="32" y="50" width="22" height="60" fill="#C7D2FE" opacity="0.75" rx="2" />
            <rect x="58" y="35" width="26" height="75" fill="#A5B4FC" opacity="0.85" rx="2" />
            <polygon points="71,15 68,35 74,35" fill="#818CF8" />
            <rect x="88" y="60" width="20" height="50" fill="#E0E7FF" opacity="0.7" rx="2" />
            <rect x="112" y="25" width="30" height="85" fill="#818CF8" opacity="0.8" rx="2" />
            <polygon points="127,8 124,25 130,25" fill="#6366F1" />
            <rect x="146" y="45" width="24" height="65" fill="#A5B4FC" opacity="0.8" rx="2" />
            <rect x="174" y="20" width="28" height="90" fill="#C7D2FE" opacity="0.9" rx="2" />
            <polygon points="188,4 185,20 191,20" fill="#4F46E5" />
            <rect x="206" y="48" width="22" height="62" fill="#E0E7FF" opacity="0.75" rx="2" />
            <rect x="232" y="32" width="26" height="78" fill="#A5B4FC" opacity="0.85" rx="2" />
            <rect x="262" y="55" width="20" height="55" fill="#C7D2FE" opacity="0.75" rx="2" />
            <rect x="286" y="68" width="24" height="42" fill="#E0E7FF" opacity="0.65" rx="2" />
            <rect x="314" y="78" width="18" height="32" fill="#C7D2FE" opacity="0.5" rx="2" />
          </svg>
        </div>
      </div>

      {/* 2. Four KPI Metric Stat Cards */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Employees */}
        <Link
          href="/admin-portal/employees"
          className="group flex items-center gap-4 rounded-2xl border border-[#EAEBF0] bg-white p-5 shadow-xs transition-all hover:shadow-md hover:border-[#6D28D9]/40"
        >
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#6D28D9] text-white shadow-sm transition-transform group-hover:scale-105">
            <Users className="h-6 w-6 stroke-[2.2px]" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-neutral-500">Total Employees</p>
            <p className="text-2xl font-bold tracking-tight text-neutral-900 mt-0.5">
              {totalEmployees}
            </p>
            <div className="mt-1 flex items-center gap-1 text-xs font-semibold text-emerald-600">
              <ArrowUp className="h-3 w-3 stroke-[2.5px]" />
              <span>4 this month</span>
            </div>
          </div>
        </Link>

        {/* Departments */}
        <Link
          href="/admin-portal/departments"
          className="group flex items-center gap-4 rounded-2xl border border-[#EAEBF0] bg-white p-5 shadow-xs transition-all hover:shadow-md hover:border-[#0284C7]/40"
        >
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#0284C7] text-white shadow-sm transition-transform group-hover:scale-105">
            <Building2 className="h-6 w-6 stroke-[2.2px]" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-neutral-500">Departments</p>
            <p className="text-2xl font-bold tracking-tight text-neutral-900 mt-0.5">
              {deptCount}
            </p>
            <div className="mt-1 flex items-center gap-1 text-xs font-semibold text-emerald-600">
              <ArrowUp className="h-3 w-3 stroke-[2.5px]" />
              <span>1 this month</span>
            </div>
          </div>
        </Link>

        {/* Pending Leave Requests */}
        <Link
          href="/admin-portal/leave/approvals"
          className="group flex items-center gap-4 rounded-2xl border border-[#EAEBF0] bg-white p-5 shadow-xs transition-all hover:shadow-md hover:border-[#F59E0B]/40"
        >
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#F59E0B] text-white shadow-sm transition-transform group-hover:scale-105">
            <CalendarDays className="h-6 w-6 stroke-[2.2px]" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-neutral-500">Pending Leave Requests</p>
            <p className="text-2xl font-bold tracking-tight text-neutral-900 mt-0.5">
              {pendingLeaveCount}
            </p>
            <div className="mt-1 flex items-center gap-1 text-xs font-semibold text-amber-600">
              <ArrowDown className="h-3 w-3 stroke-[2.5px]" />
              <span>2 from week</span>
            </div>
          </div>
        </Link>

        {/* Open Jobs */}
        <Link
          href="/admin-portal/recruitment"
          className="group flex items-center gap-4 rounded-2xl border border-[#EAEBF0] bg-white p-5 shadow-xs transition-all hover:shadow-md hover:border-[#10B981]/40"
        >
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#10B981] text-white shadow-sm transition-transform group-hover:scale-105">
            <Briefcase className="h-6 w-6 stroke-[2.2px]" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-neutral-500">Open Jobs</p>
            <p className="text-2xl font-bold tracking-tight text-neutral-900 mt-0.5">
              {openJobsCount}
            </p>
            <div className="mt-1 flex items-center gap-1 text-xs font-semibold text-neutral-400">
              <Minus className="h-3 w-3 stroke-[2.5px]" />
              <span>No change</span>
            </div>
          </div>
        </Link>
      </div>

      {/* 3. Middle Section: Attendance Overview (Donut Chart) & Pending Requests */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Attendance Overview Card */}
        <div className="flex flex-col justify-between rounded-2xl border border-[#EAEBF0] bg-white p-6 shadow-xs">
          <div>
            <div className="flex items-center justify-between pb-4">
              <h2 className="text-base font-bold text-neutral-900">Attendance Overview</h2>
              <div className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-neutral-700 shadow-2xs">
                <span>Today</span>
                <ChevronDown className="h-3.5 w-3.5 text-neutral-400" />
              </div>
            </div>

            {/* Donut Chart & Legend Row */}
            <div className="mt-4 flex flex-col sm:flex-row items-center justify-center sm:justify-around gap-6 py-2">
              {/* SVG Donut Chart */}
              <div className="relative flex h-44 w-44 shrink-0 items-center justify-center">
                <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
                  {/* Segment 1: Present (Purple) */}
                  <circle
                    cx="70"
                    cy="70"
                    r={radius}
                    fill="none"
                    stroke="#6D28D9"
                    strokeWidth="18"
                    strokeDasharray={`${dashPresent} ${circumference}`}
                    strokeDashoffset={0}
                    strokeLinecap="round"
                  />
                  {/* Segment 2: Absent (Blue) */}
                  <circle
                    cx="70"
                    cy="70"
                    r={radius}
                    fill="none"
                    stroke="#0284C7"
                    strokeWidth="18"
                    strokeDasharray={`${dashAbsent} ${circumference}`}
                    strokeDashoffset={-dashPresent}
                    strokeLinecap="round"
                  />
                  {/* Segment 3: On Leave (Orange) */}
                  <circle
                    cx="70"
                    cy="70"
                    r={radius}
                    fill="none"
                    stroke="#F59E0B"
                    strokeWidth="18"
                    strokeDasharray={`${dashOnLeave} ${circumference}`}
                    strokeDashoffset={-(dashPresent + dashAbsent)}
                    strokeLinecap="round"
                  />
                  {/* Segment 4: Half Day (Green) */}
                  <circle
                    cx="70"
                    cy="70"
                    r={radius}
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="18"
                    strokeDasharray={`${dashHalfDay} ${circumference}`}
                    strokeDashoffset={-(dashPresent + dashAbsent + dashOnLeave)}
                    strokeLinecap="round"
                  />
                </svg>

                {/* Center Counter */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold tracking-tight text-neutral-900">
                    {totalEmployees}
                  </span>
                  <span className="text-xs font-semibold text-neutral-400">Total</span>
                </div>
              </div>

              {/* Legend with Metrics */}
              <div className="space-y-3 min-w-[190px]">
                <div className="flex items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#6D28D9]" />
                    <span className="font-semibold text-neutral-800">Present</span>
                  </div>
                  <span className="font-semibold text-neutral-600">
                    {presentCount} ({presentPct}%)
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#0284C7]" />
                    <span className="font-semibold text-neutral-800">Absent</span>
                  </div>
                  <span className="font-semibold text-neutral-600">
                    {absentCount} ({absentPct}%)
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#F59E0B]" />
                    <span className="font-semibold text-neutral-800">On Leave</span>
                  </div>
                  <span className="font-semibold text-neutral-600">
                    {onLeaveCount} ({onLeavePct}%)
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#10B981]" />
                    <span className="font-semibold text-neutral-800">Half Day</span>
                  </div>
                  <span className="font-semibold text-neutral-600">
                    {halfDayCount} ({halfDayPct}%)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Info Pill */}
          <div className="mt-5 flex items-center justify-between rounded-xl bg-[#F4F0FD] px-3.5 py-2.5 text-xs">
            <div className="flex items-center gap-2 text-[#5B21B6] font-semibold">
              <Info className="h-4 w-4 shrink-0 text-[#6D28D9]" />
              <span>Attendance rate today: {presentPct}%</span>
            </div>
            <span className="font-semibold text-emerald-600">↗ 3.6% from yesterday</span>
          </div>
        </div>

        {/* Pending Requests Card */}
        <div className="flex flex-col justify-between rounded-2xl border border-[#EAEBF0] bg-white p-6 shadow-xs">
          <div>
            <div className="flex items-center justify-between pb-3">
              <h2 className="text-base font-bold text-neutral-900">Pending Requests</h2>
              <Link
                href="/admin-portal/leave/approvals"
                className="flex items-center gap-1 text-xs font-bold text-[#6D28D9] hover:underline"
              >
                <span>View all requests</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* List of Pending Requests */}
            <div className="mt-2 divide-y divide-neutral-100">
              {displayPending.slice(0, 3).map((item) => (
                <Link
                  key={item.id}
                  href="/admin-portal/leave/approvals"
                  className="flex items-center justify-between gap-3 py-3 group hover:bg-neutral-50/70 rounded-xl px-2 -mx-2 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-neutral-200 bg-[#F3F0FC] font-bold text-xs text-[#6D28D9]">
                      {"profilePhotoUrl" in item.employee && item.employee.profilePhotoUrl ? (
                        <img
                          src={item.employee.profilePhotoUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        initials(item.employee.firstName, item.employee.lastName)
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-neutral-900 group-hover:text-[#6D28D9] transition-colors">
                        {item.employee.firstName} {item.employee.lastName}
                      </p>
                      <p className="text-[11px] text-neutral-400">Leave Request</p>
                      <p className="text-[11px] font-semibold text-[#6D28D9] truncate">
                        {item.leaveType?.name ?? "Leave"} · {item.numberOfDays} day
                        {item.numberOfDays > 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="rounded-md bg-[#FEF3C7] px-2.5 py-1 text-[11px] font-bold text-[#D97706]">
                      Pending
                    </span>
                    <span className="text-[11px] font-medium text-neutral-400">
                      {new Date(item.appliedAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                    <ChevronRight className="h-4 w-4 text-neutral-300 group-hover:text-neutral-600 transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-2 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-400 font-medium">
            <span>Requires HR Manager approval</span>
            <span className="font-semibold text-neutral-700">{pendingLeaveCount} pending total</span>
          </div>
        </div>
      </div>

      {/* 4. Dynamic Upcoming Holidays & Announcement Widget */}
      <AdminUpcomingHolidaysWidget />

      {/* 5. Birthdays this week */}
      <div className="rounded-2xl border border-[#EAEBF0] bg-white p-6 shadow-xs">
        <div className="flex items-center justify-between pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#6D28D9] text-white">
              <Cake className="h-4 w-4" />
            </div>
            <h2 className="text-base font-bold text-neutral-900">Birthdays this week</h2>
          </div>
          <Link
            href="/admin-portal/employees"
            className="flex items-center gap-1 text-xs font-bold text-[#6D28D9] hover:underline"
          >
            <span>View all birthdays</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Birthday Avatars Row */}
        <div className="mt-2 flex items-center gap-6 overflow-x-auto pb-2 scrollbar-none">
          {displayBirthdays.slice(0, 6).map((b) => (
            <div
              key={b.id}
              className="flex w-24 shrink-0 flex-col items-center text-center select-none"
            >
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 border-neutral-200 bg-[#F5F2FC] shadow-2xs">
                {b.profilePhotoUrl ? (
                  <img src={b.profilePhotoUrl} alt={b.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-tr from-[#6D28D9] to-[#8B5CF6] text-white font-bold text-sm">
                    {initials(b.name.split(" ")[0], b.name.split(" ")[1])}
                  </div>
                )}
              </div>
              <p className="mt-2.5 w-full truncate text-xs font-bold text-neutral-900">
                {b.name}
              </p>
              <p className="text-[11px] font-medium text-neutral-500 mt-0.5">{b.birthdayDate}</p>
              <Gift className="mt-1.5 h-4 w-4 text-[#7C3AED]" />
            </div>
          ))}
        </div>
      </div>

      {/* 5. Footer Motivational & Brand Banner */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-[#E9E1F7] bg-[#F9F7FE] px-5 py-3.5 text-xs text-neutral-600 shadow-2xs">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-[#6D28D9] shrink-0" />
          <span className="font-medium text-neutral-700">
            Building stronger teams, one smart move at a time.
          </span>
        </div>

        <div className="flex items-center gap-2 text-neutral-800 font-bold shrink-0">
          <img src="/logo.png" alt="Realty Smartz" className="h-5 w-5 object-contain" />
          <span className="tracking-tight text-neutral-900">Realty Smartz HRMS</span>
        </div>
      </div>
    </div>
  );
}
