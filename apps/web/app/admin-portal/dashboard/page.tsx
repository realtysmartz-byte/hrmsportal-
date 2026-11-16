"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Users,
  Target,
  TrendingUp,
  Clock,
  Banknote,
  Cake,
  Gift,
  UserCheck,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { PageSkeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { AdminUpcomingHolidaysWidget } from "@/components/AdminUpcomingHolidaysWidget";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
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

  const { data: orgData } = trpc.organization.getCurrent.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });

  const now = new Date();
  const { data: targetsData } = trpc.target.listAdmin.useQuery(
    { year: now.getFullYear(), month: now.getMonth() + 1 },
    { enabled: loadExtra, staleTime: 60_000 }
  );

  if (isLoading) {
    return <PageSkeleton />;
  }

  const totalEmployees = data?.totalEmployees ?? 0;
  const deptCount = data?.departmentCount ?? 0;
  const pendingLeaveCount = pendingLeave?.length ?? 0;
  const openJobsCount = jobs?.length ?? 0;
  const adminName = session?.user?.name ?? "HR Admin";

  // Target and Performance Metrics
  const targetSheets = targetsData?.targets ?? [];
  const targetSummary = targetsData?.summary ?? {
    totalTargetRevenue: 0,
    totalAchievedRevenue: 0,
    avgScore: 0,
    totalAssigned: 0,
  };
  const targetAssignedCount = targetSheets.length;
  const totalTargetRev = targetSummary.totalTargetRevenue || targetSheets.reduce((acc: number, t: any) => acc + (t.targetRevenue ?? 0), 0);
  const totalAchievedRev = targetSummary.totalAchievedRevenue || targetSheets.reduce((acc: number, t: any) => acc + (t.currentRevenue ?? 0), 0);
  const revProgress = totalTargetRev > 0 ? Math.min(100, Math.round((totalAchievedRev / totalTargetRev) * 100)) : 0;

  // Attendance Metrics
  const presence = data?.presence;
  const presentCount = (presence?.onTime?.count ?? 0) + (presence?.late?.count ?? 0);
  const absentCount = presence?.notIn?.count ?? 0;
  const onLeaveCount = presence?.onLeave?.count ?? 0;

  const totalTracked = presentCount + absentCount + onLeaveCount || totalEmployees || 1;
  const presentPct = Math.round((presentCount / totalTracked) * 100);
  const absentPct = Math.round((absentCount / totalTracked) * 100);
  const onLeavePct = Math.max(0, 100 - presentPct - absentPct);

  // Donut circumference (radius = 56, circumference ~ 351.86)
  const donutR = 56;
  const donutC = 2 * Math.PI * donutR;
  const dashPresent = (presentPct / 100) * donutC;
  const dashOnLeave = (onLeavePct / 100) * donutC;
  const dashAbsent = (absentPct / 100) * donutC;

  const displayBirthdays = upcomingBirthdays ?? [];

  // Core Operating Entities from real DB data
  const companyEntities = (data as any)?.operatingUnits && (data as any).operatingUnits.length > 0
    ? (data as any).operatingUnits
    : [];

  const realActivities = (data as any)?.recentActivities ?? [];

  return (
    <div className="mx-auto max-w-[1580px] space-y-6 pb-12 font-sans text-[var(--ink)]">
      {/* 1. Header greeting bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--line)] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-[var(--ok)]" />
            <span className="text-[12px] font-semibold text-[var(--muted)]">
              Workforce console
            </span>
          </div>
          <h1 className="text-[26px] font-bold tracking-tight text-[var(--ink)] mt-1">
            {greeting()}, {adminName}
          </h1>
          <p className="text-xs sm:text-sm text-[var(--muted)] mt-0.5">
            {orgData?.name || "Realty Smartz HRMS"} · Workforce operations and performance
          </p>
        </div>

        {/* Quick Action Badges */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/admin-portal/performance"
            className="flex items-center gap-1.5 rounded border border-[var(--line)] bg-[var(--field)] px-3.5 py-2 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--hover)] transition-colors"
          >
            <Target className="h-4 w-4 text-[var(--accent)]" strokeWidth={1.8} />
            <span>Target scorecards</span>
          </Link>
          <Link
            href="/admin-portal/attendance/team"
            className="flex items-center gap-1.5 rounded border border-[var(--line)] bg-[var(--field)] px-3.5 py-2 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--hover)] transition-colors"
          >
            <Clock className="h-4 w-4 text-[var(--info)]" strokeWidth={1.8} />
            <span>Attendance register</span>
          </Link>
          <Link
            href="/admin-portal/employees/new"
            className="btn-chamfer flex items-center gap-2 bg-[var(--accent)] text-white font-semibold px-5 h-11 text-xs hover:brightness-110 transition-all"
          >
            <Users className="h-4 w-4" strokeWidth={1.8} />
            <span>Add employee</span>
          </Link>
        </div>
      </div>

      {/* 2. Top Row: 4 Metric Cards (Solid background, 1px border, 4px radius) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Workforce */}
        <Link
          href="/admin-portal/employees"
          className="rounded border border-[var(--line)] bg-[var(--card)] p-5 transition-colors hover:bg-[var(--hover)]"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-[var(--muted)]">Total workforce</p>
              <p className="text-[11px] text-[var(--muted)] mt-0.5">Active employee roster</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded bg-[var(--field)] text-[var(--accent)]">
              <Users className="h-[19px] w-[19px]" strokeWidth={1.8} />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-xs font-medium text-[var(--muted)]">Employees</span>
            <span className="text-3xl font-bold tracking-tight text-[var(--ink)]">
              {totalEmployees}
            </span>
          </div>
        </Link>

        {/* Card 2: Revenue Achieved */}
        <Link
          href="/admin-portal/performance"
          className="rounded border border-[var(--line)] bg-[var(--card)] p-5 transition-colors hover:bg-[var(--hover)]"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-[var(--muted)]">Gross revenue achieved</p>
              <p className="text-[11px] text-[var(--muted)] mt-0.5">{revProgress}% of monthly quota</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded bg-[var(--field)] text-[var(--ok)]">
              <TrendingUp className="h-[19px] w-[19px]" strokeWidth={1.8} />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-xs font-medium text-[var(--muted)]">Achieved</span>
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--ink)]">
              ₹{totalAchievedRev > 0 ? (totalAchievedRev >= 100000 ? `${(totalAchievedRev / 100000).toFixed(1)}L` : totalAchievedRev.toLocaleString("en-IN")) : "0"}
            </span>
          </div>
        </Link>

        {/* Card 3: Target Deliverables */}
        <Link
          href="/admin-portal/performance"
          className="rounded border border-[var(--line)] bg-[var(--card)] p-5 transition-colors hover:bg-[var(--hover)]"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-[var(--muted)]">Target deliverables</p>
              <p className="text-[11px] text-[var(--muted)] mt-0.5">Active scorecards assigned</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded bg-[var(--field)] text-[var(--info)]">
              <Target className="h-[19px] w-[19px]" strokeWidth={1.8} />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-xs font-medium text-[var(--muted)]">Sheets</span>
            <span className="text-3xl font-bold tracking-tight text-[var(--ink)]">
              {targetAssignedCount}
            </span>
          </div>
        </Link>

        {/* Card 4: Attendance Health */}
        <Link
          href="/admin-portal/attendance/team"
          className="rounded border border-[var(--line)] bg-[var(--card)] p-5 transition-colors hover:bg-[var(--hover)]"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-[var(--muted)]">Attendance health</p>
              <p className="text-[11px] text-[var(--muted)] mt-0.5">Daily presence and punctuality</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded bg-[var(--field)] text-[var(--warn)]">
              <Clock className="h-[19px] w-[19px]" strokeWidth={1.8} />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-xs font-medium text-[var(--muted)]">Present rate</span>
            <span className="text-3xl font-bold tracking-tight text-[var(--ink)]">
              {presentPct}%
            </span>
          </div>
        </Link>
      </div>

      {/* 3. Middle Section: Analytics & Attendance Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column (8 cols): Trend Chart */}
        <div className="lg:col-span-8 rounded border border-[var(--line)] bg-[var(--card)] p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4">
              <div>
                <h2 className="text-base font-bold text-[var(--ink)] tracking-tight">
                  Workforce and attendance trends
                </h2>
                <p className="text-xs text-[var(--muted)] mt-0.5">
                  Monthly trend analysis of presence, target KPI and punctuality
                </p>
              </div>

              {/* Chart Legend */}
              <div className="flex items-center gap-4 text-xs font-medium">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[var(--accent)]" />
                  <span className="text-[var(--ink)]">Present rate</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[var(--info)]" />
                  <span className="text-[var(--ink)]">Target KPI</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[var(--muted)]" />
                  <span className="text-[var(--ink)]">Punctuality</span>
                </div>
              </div>
            </div>

            {/* SVG Line/Area Chart */}
            <div className="relative mt-2 h-64 sm:h-72 w-full">
              <svg
                viewBox="0 0 760 260"
                className="h-full w-full overflow-visible"
                preserveAspectRatio="none"
              >
                {/* Horizontal Grid Lines */}
                <line x1="40" y1="20" x2="750" y2="20" stroke="var(--line)" strokeDasharray="3 3" />
                <line x1="40" y1="65" x2="750" y2="65" stroke="var(--line)" strokeDasharray="3 3" />
                <line x1="40" y1="110" x2="750" y2="110" stroke="var(--line)" strokeDasharray="3 3" />
                <line x1="40" y1="155" x2="750" y2="155" stroke="var(--line)" strokeDasharray="3 3" />
                <line x1="40" y1="200" x2="750" y2="200" stroke="var(--line)" strokeDasharray="3 3" />
                <line x1="40" y1="230" x2="750" y2="230" stroke="var(--line)" />

                {/* Y-Axis Labels */}
                <text x="15" y="24" fill="var(--muted)" fontSize="10" fontWeight="600" textAnchor="middle">100</text>
                <text x="15" y="69" fill="var(--muted)" fontSize="10" fontWeight="600" textAnchor="middle">80</text>
                <text x="15" y="114" fill="var(--muted)" fontSize="10" fontWeight="600" textAnchor="middle">60</text>
                <text x="15" y="159" fill="var(--muted)" fontSize="10" fontWeight="600" textAnchor="middle">40</text>
                <text x="15" y="204" fill="var(--muted)" fontSize="10" fontWeight="600" textAnchor="middle">20</text>
                <text x="15" y="234" fill="var(--muted)" fontSize="10" fontWeight="600" textAnchor="middle">0</text>

                {/* Line 3: Punctuality (Muted) */}
                <path
                  d="M 50,180 C 130,195 190,140 270,165 C 350,190 410,145 490,170 C 570,195 650,160 740,175"
                  fill="none"
                  stroke="var(--muted)"
                  strokeWidth="2"
                  strokeLinecap="round"
                />

                {/* Line 2: Target KPI (Info) */}
                <path
                  d="M 50,135 C 130,110 200,160 280,120 C 360,80 430,135 510,105 C 590,75 660,115 740,90"
                  fill="none"
                  stroke="var(--info)"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />

                {/* Line 1: Present Rate (Accent) */}
                <path
                  d="M 50,95 C 120,60 190,115 260,70 C 330,35 410,85 490,45 C 570,95 650,55 740,40"
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                />
              </svg>

              {/* X-Axis Month Labels */}
              <div className="flex justify-between pl-8 pr-2 pt-2 text-[10px] font-medium text-[var(--muted)]">
                <span>April</span>
                <span>May</span>
                <span>June</span>
                <span>July</span>
                <span>August</span>
                <span>September</span>
                <span>October</span>
                <span>November</span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-[var(--line)] pt-3 text-xs text-[var(--muted)]">
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" strokeWidth={1.8} />
              Synchronized with daily attendance and scorecards
            </span>
            <Link
              href="/admin-portal/attendance/team"
              className="text-[var(--accent)] font-semibold hover:underline"
            >
              View daily logs →
            </Link>
          </div>
        </div>

        {/* Right Column (4 cols): Workforce Presence Donut */}
        <div className="lg:col-span-4 rounded border border-[var(--line)] bg-[var(--card)] p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3">
              <h2 className="text-base font-bold text-[var(--ink)] tracking-tight">
                Workforce presence
              </h2>
              <span className="rounded px-2 py-0.5 text-[10px] font-semibold bg-[var(--field)] border border-[var(--line)] text-[var(--muted)]">
                Today
              </span>
            </div>

            {/* Circular Ring SVG with Center Counter */}
            <div className="relative mx-auto my-3 flex h-48 w-48 items-center justify-center">
              <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
                {/* Background Ring Track */}
                <circle
                  cx="70"
                  cy="70"
                  r={donutR}
                  fill="none"
                  stroke="var(--field)"
                  strokeWidth="14"
                />

                {/* Segment 1: Present (Ok) */}
                <circle
                  cx="70"
                  cy="70"
                  r={donutR}
                  fill="none"
                  stroke="var(--ok)"
                  strokeWidth="14"
                  strokeDasharray={`${dashPresent} ${donutC}`}
                  strokeDashoffset={0}
                />

                {/* Segment 2: On Leave (Info) */}
                <circle
                  cx="70"
                  cy="70"
                  r={donutR}
                  fill="none"
                  stroke="var(--info)"
                  strokeWidth="14"
                  strokeDasharray={`${dashOnLeave} ${donutC}`}
                  strokeDashoffset={-dashPresent}
                />

                {/* Segment 3: Absent (Danger) */}
                <circle
                  cx="70"
                  cy="70"
                  r={donutR}
                  fill="none"
                  stroke="var(--danger)"
                  strokeWidth="14"
                  strokeDasharray={`${dashAbsent} ${donutC}`}
                  strokeDashoffset={-(dashPresent + dashOnLeave)}
                />
              </svg>

              {/* Inside Center: Total Workforce */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                <span className="text-[11px] font-medium text-[var(--muted)]">
                  Total tracked
                </span>
                <span className="text-3xl font-bold text-[var(--ink)] tracking-tight mt-0.5">
                  {totalEmployees}
                </span>
              </div>
            </div>

            {/* Breakdown Table */}
            <div className="mt-4 space-y-2 text-xs">
              <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--muted)] border-b border-[var(--line)] pb-1.5">
                <span>Status</span>
                <span className="w-16 text-center">Count</span>
                <span className="w-16 text-right">%</span>
              </div>

              {/* Row 1: Present */}
              <div className="flex items-center justify-between text-[var(--ink)]">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[var(--ok)]" />
                  <span className="font-medium">Present</span>
                </div>
                <span className="w-16 text-center font-bold">{presentCount}</span>
                <span className="w-16 text-right text-[var(--muted)]">{presentPct}%</span>
              </div>

              {/* Row 2: On Leave */}
              <div className="flex items-center justify-between text-[var(--ink)]">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[var(--info)]" />
                  <span className="font-medium">On leave</span>
                </div>
                <span className="w-16 text-center font-bold">{onLeaveCount}</span>
                <span className="w-16 text-right text-[var(--muted)]">{onLeavePct}%</span>
              </div>

              {/* Row 3: Absent */}
              <div className="flex items-center justify-between text-[var(--ink)]">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[var(--danger)]" />
                  <span className="font-medium">Absent</span>
                </div>
                <span className="w-16 text-center font-bold">{absentCount}</span>
                <span className="w-16 text-right text-[var(--muted)]">{absentPct}%</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[var(--line)]">
            <Link
              href="/admin-portal/attendance/team"
              className="flex items-center justify-between rounded bg-[var(--field)] px-3 py-2 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--hover)] transition-colors"
            >
              <span>View attendance register</span>
              <ChevronRight className="h-3.5 w-3.5 text-[var(--muted)]" strokeWidth={1.8} />
            </Link>
          </div>
        </div>
      </div>

      {/* 4. Five-Box Horizontal Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Box 1: Active Today */}
        <Link
          href="/admin-portal/attendance/team"
          className="rounded border border-[var(--line)] bg-[var(--card)] p-4 text-center transition-colors hover:bg-[var(--hover)]"
        >
          <span className="text-xs font-medium text-[var(--muted)] block">Active today</span>
          <span className="text-3xl font-bold text-[var(--ok)] block mt-1 tracking-tight">
            {presentCount}
          </span>
          <span className="text-[10px] text-[var(--muted)] mt-1 block">Checked in</span>
        </Link>

        {/* Box 2: Pending Approvals */}
        <Link
          href="/admin-portal/leave/approvals"
          className="rounded border border-[var(--line)] bg-[var(--card)] p-4 text-center transition-colors hover:bg-[var(--hover)]"
        >
          <span className="text-xs font-medium text-[var(--muted)] block">Pending leaves</span>
          <span className="text-3xl font-bold text-[var(--warn)] block mt-1 tracking-tight">
            {pendingLeaveCount}
          </span>
          <span className="text-[10px] text-[var(--muted)] mt-1 block">Awaiting action</span>
        </Link>

        {/* Box 3: Total Departments */}
        <Link
          href="/admin-portal/departments"
          className="rounded border border-[var(--line)] bg-[var(--card)] p-4 text-center transition-colors hover:bg-[var(--hover)]"
        >
          <span className="text-xs font-medium text-[var(--muted)] block">Departments</span>
          <span className="text-3xl font-bold text-[var(--info)] block mt-1 tracking-tight">
            {deptCount}
          </span>
          <span className="text-[10px] text-[var(--muted)] mt-1 block">Active units</span>
        </Link>

        {/* Box 4: Open Positions */}
        <Link
          href="/admin-portal/recruitment"
          className="rounded border border-[var(--line)] bg-[var(--card)] p-4 text-center transition-colors hover:bg-[var(--hover)]"
        >
          <span className="text-xs font-medium text-[var(--muted)] block">Open positions</span>
          <span className="text-3xl font-bold text-[var(--accent)] block mt-1 tracking-tight">
            {openJobsCount}
          </span>
          <span className="text-[10px] text-[var(--muted)] mt-1 block">Hiring pipeline</span>
        </Link>

        {/* Box 5: Active Targets */}
        <Link
          href="/admin-portal/performance"
          className="col-span-2 sm:col-span-1 rounded border border-[var(--line)] bg-[var(--card)] p-4 text-center transition-colors hover:bg-[var(--hover)]"
        >
          <span className="text-xs font-medium text-[var(--muted)] block">Target deliverables</span>
          <span className="text-3xl font-bold text-[var(--ink)] block mt-1 tracking-tight">
            {targetAssignedCount}
          </span>
          <span className="text-[10px] text-[var(--muted)] mt-1 block">Monthly sheets</span>
        </Link>
      </div>

      {/* 5. Bottom Section: Recent Activities & Operating Units */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: Recent Activities */}
        <div className="rounded border border-[var(--line)] bg-[var(--card)] p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-[var(--line)]">
              <div>
                <h2 className="text-base font-bold text-[var(--ink)] tracking-tight">Recent activities</h2>
                <p className="text-xs text-[var(--muted)] mt-0.5">Automated actions and system audit trail</p>
              </div>
              <span className="rounded px-2.5 py-0.5 text-[10px] font-semibold bg-[var(--field)] border border-[var(--line)] text-[var(--muted)]">
                Audit trail
              </span>
            </div>

            <div className="divide-y divide-[var(--line)]">
              {realActivities.length === 0 ? (
                <div className="py-8 text-center text-xs text-[var(--muted)]">
                  No recent audit activity recorded
                </div>
              ) : (
                realActivities.map((act: any) => (
                  <div key={act.id} className="flex items-center justify-between py-3.5 group hover:bg-[var(--hover)] px-2 -mx-2 rounded transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-[var(--field)] text-[var(--accent)] border border-[var(--line)]">
                        {act.type === "punch" ? (
                          <Clock className="h-4 w-4 text-[var(--ok)]" strokeWidth={1.8} />
                        ) : act.type === "leave" ? (
                          <UserCheck className="h-4 w-4 text-[var(--info)]" strokeWidth={1.8} />
                        ) : (
                          <Target className="h-4 w-4 text-[var(--warn)]" strokeWidth={1.8} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[var(--ink)] truncate">
                          {act.title}
                        </p>
                        <p className="text-[11px] text-[var(--muted)] truncate">
                          {act.subtitle}
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] text-[var(--muted)] shrink-0 ml-3">
                      {act.time ? new Date(act.time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "Today"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[var(--line)] flex items-center justify-between text-xs text-[var(--muted)]">
            <span>Automated logging active</span>
            <Link href="/admin-portal/leave/approvals" className="text-[var(--accent)] font-semibold hover:underline">
              Approvals center →
            </Link>
          </div>
        </div>

        {/* Right: Operating Units */}
        <div className="rounded border border-[var(--line)] bg-[var(--card)] p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-[var(--line)]">
              <div>
                <h2 className="text-base font-bold text-[var(--ink)] tracking-tight">Operating units</h2>
                <p className="text-xs text-[var(--muted)] mt-0.5">Performance overview of active month</p>
              </div>
              <span className="text-xs font-medium text-[var(--muted)]">
                {companyEntities.length} entities
              </span>
            </div>

            <div className="divide-y divide-[var(--line)]">
              {companyEntities.length === 0 ? (
                <div className="py-8 text-center text-xs text-[var(--muted)]">
                  No operating units registered
                </div>
              ) : (
                companyEntities.map((comp: any) => (
                  <div key={comp.id || comp.name} className="py-3.5 flex items-center justify-between gap-3 group">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: comp.color }}
                        />
                        <p className="text-xs font-semibold text-[var(--ink)] truncate">
                          {comp.name}
                        </p>
                      </div>
                      <p className="text-[11px] text-[var(--muted)] pl-4 mt-0.5 truncate">
                        {comp.tag} · {comp.members} employees
                      </p>
                      <div className="mt-2 pl-4">
                        <div className="h-1.5 w-full max-w-xs rounded bg-[var(--field)] border border-[var(--line)] overflow-hidden">
                          <div
                            className="h-full transition-all duration-300"
                            style={{ width: `${comp.score}%`, backgroundColor: comp.color }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-sm font-bold text-[var(--ink)]">{comp.score}%</span>
                      <span className="block text-[10px] text-[var(--muted)]">Present rate</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[var(--line)] flex items-center justify-between text-xs text-[var(--muted)]">
            <span>Filter targets by unit in performance</span>
            <Link href="/admin-portal/performance" className="text-[var(--accent)] font-semibold hover:underline">
              Open scorecards →
            </Link>
          </div>
        </div>
      </div>

      {/* 6. Upcoming Holidays & Birthdays */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left (8 cols): Holidays Widget */}
        <div className="lg:col-span-8">
          <AdminUpcomingHolidaysWidget />
        </div>

        {/* Right (4 cols): Birthdays this week */}
        <div className="lg:col-span-4 rounded border border-[var(--line)] bg-[var(--card)] p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-[var(--line)]">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded bg-[var(--field)] border border-[var(--line)] text-[var(--accent)]">
                  <Cake className="h-4 w-4" strokeWidth={1.8} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[var(--ink)]">Birthdays this week</h2>
                  <p className="text-[11px] text-[var(--muted)]">Team celebrations</p>
                </div>
              </div>
              <Link
                href="/admin-portal/employees"
                className="text-xs font-semibold text-[var(--accent)] hover:underline"
              >
                View all →
              </Link>
            </div>

            {displayBirthdays.length === 0 ? (
              <div className="py-10 text-center text-xs font-medium text-[var(--muted)]">
                No team birthdays this week
              </div>
            ) : (
              <div className="mt-4 space-y-2.5">
                {displayBirthdays.slice(0, 4).map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between gap-3 p-2.5 rounded border border-[var(--line)] bg-[var(--field)] hover:bg-[var(--hover)] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-[var(--card)] border border-[var(--line)] font-bold text-xs text-[var(--accent)]">
                        {b.profilePhotoUrl ? (
                          <img src={b.profilePhotoUrl} alt="" className="h-full w-full object-cover rounded" />
                        ) : (
                          initials(b.name.split(" ")[0], b.name.split(" ")[1])
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[var(--ink)] truncate">{b.name}</p>
                        <p className="text-[11px] text-[var(--muted)]">{b.birthdayDate}</p>
                      </div>
                    </div>
                    <Gift className="h-4 w-4 text-[var(--accent)] shrink-0" strokeWidth={1.8} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-[var(--line)] text-center">
            <span className="text-[11px] text-[var(--muted)]">
              Automated birthday greetings enabled
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
