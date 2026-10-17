"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Building2,
  Users,
  FileText,
  BriefcaseBusiness,
  UserPlus,
  Clock,
  MapPin,
  Network,
  Settings,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import { PageSkeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { formatDate } from "@/lib/utils";
import { UpcomingBirthdaysWidget } from "@/components/UpcomingBirthdaysWidget";

const quickAccess = [
  { href: "/admin-portal/employees/new", label: "Add Employee", icon: UserPlus },
  { href: "/admin-portal/attendance/team", label: "Attendance", icon: Clock },
  { href: "/admin-portal/attendance/locations", label: "Location Tracing", icon: MapPin },
  { href: "/admin-portal/leave/approvals", label: "Leave Approvals", icon: FileText },
  { href: "/admin-portal/org-chart", label: "Org Chart", icon: Network },
  { href: "/admin-portal/settings/company", label: "Company Settings", icon: Settings },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function initials(first: string, last?: string | null) {
  return `${first[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase();
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white">
      <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-neutral-800">{title}</h3>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const { data: session } = useSession();
  const { data, isLoading } = trpc.employee.dashboardStats.useQuery(undefined, {
    staleTime: 60_000,
  });
  const [loadExtra, setLoadExtra] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLoadExtra(true), 800);
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

  if (isLoading) {
    return <PageSkeleton />;
  }

  const totalEmployees = data?.totalEmployees ?? 0;
  const deptCount = data?.departmentCount ?? 0;
  const pendingLeaveCount = pendingLeave?.length ?? 0;
  const openJobsCount = jobs?.length ?? 0;
  const presence = data?.presence;

  const firstName = session?.user?.name?.split(" ")[0] ?? "Admin";
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const stats = [
    { label: "Total Employees", value: totalEmployees, href: "/admin-portal/employees", icon: Users },
    { label: "Departments", value: deptCount, href: "/admin-portal/departments", icon: Building2 },
    { label: "Pending Leave Requests", value: pendingLeaveCount, href: "/admin-portal/leave/approvals", icon: FileText },
    { label: "Open Jobs", value: openJobsCount, href: "/admin-portal/recruitment", icon: BriefcaseBusiness },
  ];

  const whoIsIn = [
    {
      label: "Not in yet",
      count: presence?.notIn.count ?? 0,
      list: presence?.notIn.sample ?? [],
      color: "bg-neutral-400",
    },
    {
      label: "On time",
      count: presence?.onTime.count ?? 0,
      list: presence?.onTime.sample ?? [],
      color: "bg-emerald-500",
    },
    {
      label: "Late arrivals",
      count: presence?.late.count ?? 0,
      list: presence?.late.sample ?? [],
      color: "bg-amber-500",
    },
    {
      label: "On leave",
      count: presence?.onLeave.count ?? 0,
      list: presence?.onLeave.sample ?? [],
      color: "bg-sky-500",
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="rounded-lg bg-[#5D3EBC] px-5 py-6 text-white sm:px-6">
        <p className="text-xs text-white/70">{today}</p>
        <h1 className="mt-1 text-xl font-semibold sm:text-2xl">
          {greeting()}, {firstName}
        </h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.label}
              href={s.href}
              className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-4 transition-colors hover:border-[#5D3EBC]/40"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#5D3EBC]/10 text-[#5D3EBC]">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xl font-semibold text-neutral-900">{s.value}</p>
                <p className="text-xs text-neutral-500">{s.label}</p>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Panel
            title="Who's in?"
            action={
              <Link
                href="/admin-portal/attendance/team"
                className="text-xs font-medium text-[#5D3EBC] hover:underline"
              >
                View attendance
              </Link>
            }
          >
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {whoIsIn.map((g) => (
                <div key={g.label}>
                  <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                    <span className={`h-2 w-2 rounded-full ${g.color}`} />
                    {g.label}
                  </div>
                  <p className="mt-1 text-lg font-semibold text-neutral-900">{g.count}</p>
                  <div className="mt-2 flex -space-x-1.5">
                    {g.list.slice(0, 4).map((emp) => (
                      <div
                        key={emp.id}
                        title={`${emp.firstName} ${emp.lastName ?? ""}`}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-100 text-[10px] font-semibold text-neutral-700 ring-2 ring-white"
                      >
                        {initials(emp.firstName, emp.lastName)}
                      </div>
                    ))}
                    {g.count > 4 && (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-200 text-[10px] font-semibold text-neutral-700 ring-2 ring-white">
                        +{g.count - 4}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Quick Access">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {quickAccess.map((q) => {
                const Icon = q.icon;
                return (
                  <Link
                    key={q.href}
                    href={q.href}
                    className="flex items-center gap-2.5 rounded-md border border-neutral-200 px-3 py-2.5 text-xs font-medium text-neutral-700 transition-colors hover:border-[#5D3EBC]/40 hover:bg-[#5D3EBC]/5 hover:text-[#5D3EBC]"
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{q.label}</span>
                  </Link>
                );
              })}
            </div>
          </Panel>

          <Panel
            title="New Joinees"
            action={
              <Link
                href="/admin-portal/employees"
                className="text-xs font-medium text-[#5D3EBC] hover:underline"
              >
                View all
              </Link>
            }
          >
            {data?.recentJoiners && data.recentJoiners.length > 0 ? (
              <div className="divide-y divide-neutral-100">
                {data.recentJoiners.map((emp) => (
                  <Link
                    key={emp.id}
                    href={`/admin-portal/employees/${emp.id}`}
                    className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#5D3EBC]/10 text-xs font-semibold text-[#5D3EBC]">
                        {initials(emp.firstName, emp.lastName)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-neutral-900">
                          {emp.firstName} {emp.lastName}
                        </p>
                        <p className="truncate text-xs text-neutral-500">
                          {emp.designation?.title ?? "—"} · {emp.department?.name ?? "—"}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-neutral-400">
                      {formatDate(emp.dateOfJoining)}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="py-6 text-center text-xs text-neutral-500">
                No recent joiners.
              </p>
            )}
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel
            title="Pending Requests"
            action={
              <span className="rounded bg-[#5D3EBC]/10 px-2 py-0.5 text-[11px] font-semibold text-[#5D3EBC]">
                {pendingLeaveCount}
              </span>
            }
          >
            {pendingLeave && pendingLeave.length > 0 ? (
              <div className="divide-y divide-neutral-100">
                {pendingLeave.slice(0, 5).map((item) => (
                  <Link
                    key={item.id}
                    href="/admin-portal/leave/approvals"
                    className="flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-neutral-900">
                        {item.employee.firstName} {item.employee.lastName}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {item.leaveType.name} · {item.numberOfDays} day(s)
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-neutral-500">
                <CheckCircle2 className="mx-auto mb-1.5 h-6 w-6 text-emerald-500" />
                No pending requests.
              </div>
            )}
          </Panel>

          <UpcomingBirthdaysWidget portal="admin" />

          <Panel
            title="Open Jobs"
            action={
              <Link
                href="/admin-portal/recruitment"
                className="text-xs font-medium text-[#5D3EBC] hover:underline"
              >
                View all
              </Link>
            }
          >
            {jobs && jobs.length > 0 ? (
              <div className="divide-y divide-neutral-100">
                {jobs.slice(0, 3).map((job) => (
                  <Link
                    key={job.id}
                    href={`/admin-portal/recruitment/${job.id}`}
                    className="flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-neutral-900">
                        {job.title}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {job.department?.name ?? "—"} · {job._count.candidates} applicants
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" />
                  </Link>
                ))}
              </div>
            ) : (
              <p className="py-6 text-center text-xs text-neutral-500">
                No open jobs.
              </p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
