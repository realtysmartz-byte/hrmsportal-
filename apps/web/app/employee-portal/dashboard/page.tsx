"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { CalendarDays, Clock, ChevronRight, UserPlus } from "lucide-react";
import { CheckInOutCard } from "@/components/CheckInOutCard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

export default function EmployeeDashboardPage() {
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(" ")[0] ?? "there";
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const now = new Date();
  const { data: month } = trpc.attendance.myMonth.useQuery({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  });
  const { data: balances } = trpc.leave.myBalances.useQuery();
  const { data: interviews } = trpc.recruitment.myInterviews.useQuery(
    undefined,
    { retry: false }
  );

  const leaveLeft = balances?.reduce((s, b) => s + b.remaining, 0) ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-caption font-semibold uppercase tracking-wide text-teal-700">
          Employee Portal
        </p>
        <h1 className="font-display text-display text-neutral-900">
          {greeting}, {firstName}
        </h1>
        <p className="page-subtitle">
          Check in, track leave, and stay connected with the team.
        </p>
      </div>

      <CheckInOutCard />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="overflow-hidden">
          <CardContent className="pt-5">
            <p className="text-caption text-neutral-500">Present this month</p>
            <p className="mt-1 font-display text-3xl font-bold text-teal-700">
              {month?.summary.present ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 pt-5">
            <p className="text-caption text-neutral-500">Leave remaining</p>
            <p className="font-display text-3xl font-bold text-teal-700">
              {leaveLeft}
            </p>
            <div className="space-y-2">
              {balances?.slice(0, 3).map((b) => {
                const pct =
                  b.allotted > 0
                    ? Math.min(100, (b.remaining / b.allotted) * 100)
                    : 0;
                return (
                  <div key={b.id}>
                    <div className="mb-1 flex justify-between text-caption">
                      <span>{b.leaveType.name}</span>
                      <span className="text-neutral-500">
                        {b.remaining}/{b.allotted}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                      <div
                        className="h-full rounded-full bg-teal-600"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {interviews && interviews.length > 0 && (
        <Card>
          <CardContent className="space-y-3 pt-5">
            <h2 className="font-display text-heading-md">My Interviews</h2>
            {interviews.slice(0, 3).map((iv) => (
              <div
                key={iv.id}
                className="flex items-center justify-between rounded-xl border border-neutral-200 p-3"
              >
                <div>
                  <p className="font-medium">{iv.roundName}</p>
                  <p className="text-caption text-neutral-500">
                    {iv.candidate.fullName} ·{" "}
                    {new Date(iv.scheduledAt).toLocaleString()}
                  </p>
                </div>
                <Link href={`/employee-portal/dashboard#interview-${iv.id}`}>
                  <Button size="sm" variant="outline">
                    {iv.status === "SCHEDULED" ? "Details" : iv.status}
                  </Button>
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <QuickLink
          href="/employee-portal/attendance"
          icon={Clock}
          title="Attendance"
          subtitle="Calendar & check-ins"
        />
        <QuickLink
          href="/employee-portal/leave"
          icon={CalendarDays}
          title="Leave"
          subtitle="Apply & balances"
        />
        <QuickLink
          href="/employee-portal/refer"
          icon={UserPlus}
          title="Refer a candidate"
          subtitle="Help us hire"
        />
      </div>
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  title,
  subtitle,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4 transition-colors hover:border-teal-300 hover:bg-teal-50/40"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-50 text-teal-700">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <p className="font-medium">{title}</p>
        <p className="text-caption text-neutral-500">{subtitle}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-neutral-400" />
    </Link>
  );
}
