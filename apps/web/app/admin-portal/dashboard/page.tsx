"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Building2, Users, FileText, BriefcaseBusiness } from "lucide-react";
import { EmployeeCard } from "@/components/EmployeeCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { formatDate } from "@/lib/utils";

export default function AdminDashboardPage() {
  const { data, isLoading } = trpc.employee.dashboardStats.useQuery();
  const { data: pendingLeave } = trpc.leave.pendingApprovals.useQuery();
  const { data: jobs } = trpc.recruitment.jobList.useQuery(
    { status: "OPEN" },
    { retry: false }
  );

  if (isLoading) {
    return <PageSkeleton />;
  }

  return (
    <div className="section-gap">
      <div className="page-header">
        <div>
          <h1 className="page-title">Admin Dashboard</h1>
          <p className="page-subtitle">Company-wide overview and quick actions</p>
        </div>
        <Link href="/admin-portal/employees/new">
          <Button>Add Employee</Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Headcount"
          value={data?.totalEmployees ?? 0}
          icon={Users}
        />
        <StatCard
          label="Departments"
          value={data?.departmentCount ?? 0}
          icon={Building2}
        />
        <StatCard
          label="Pending leave"
          value={pendingLeave?.length ?? 0}
          icon={FileText}
          href="/admin-portal/leave/approvals"
        />
        <StatCard
          label="Open jobs"
          value={jobs?.length ?? 0}
          icon={BriefcaseBusiness}
          href="/admin-portal/recruitment"
        />
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-heading-md">Recent joiners</h2>
          <Link
            href="/admin-portal/employees"
            className="text-caption font-semibold text-teal-700 hover:underline"
          >
            View all
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data?.recentJoiners.map((emp) => (
            <div key={emp.id} className="space-y-1">
              <EmployeeCard
                id={emp.id}
                firstName={emp.firstName}
                lastName={emp.lastName}
                employeeCode={emp.employeeCode}
                profilePhotoUrl={emp.profilePhotoUrl}
                designation={emp.designation}
                department={emp.department}
                status={emp.status}
              />
              <p className="px-1 text-caption text-neutral-500">
                Joined {formatDate(emp.dateOfJoining)}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  href,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
}) {
  const inner = (
    <Card className={href ? "transition-colors hover:border-teal-300" : undefined}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-caption font-medium text-neutral-500">
          {label}
        </CardTitle>
        <Icon className="h-4 w-4 text-teal-600" />
      </CardHeader>
      <CardContent>
        <p className="font-display text-3xl font-bold text-teal-700">{value}</p>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
