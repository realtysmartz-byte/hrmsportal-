"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Lock,
  Search,
  Star,
  Target,
  UserCheck,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { formatDate, fullName } from "@/lib/utils";

export default function AdminCycleDetailPage() {
  const params = useParams<{ cycleId: string }>();
  const utils = trpc.useUtils();

  const [search, setSearch] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [filterReviewStatus, setFilterReviewStatus] = useState("");

  const { data, isLoading } = trpc.performance.cycleTracking.useQuery({
    cycleId: params.cycleId,
  });

  const { data: departments } = trpc.department.list.useQuery();

  const activateMutation = trpc.performance.activateCycle.useMutation({
    onSuccess: () => {
      utils.performance.cycleTracking.invalidate({ cycleId: params.cycleId });
    },
  });

  const closeMutation = trpc.performance.closeCycle.useMutation({
    onSuccess: () => {
      utils.performance.cycleTracking.invalidate({ cycleId: params.cycleId });
    },
  });

  const filteredRows = useMemo(() => {
    if (!data?.rows) return [];
    return data.rows.filter((row) => {
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        fullName(row.employee.firstName, row.employee.lastName)
          .toLowerCase()
          .includes(q) ||
        row.employee.employeeCode.toLowerCase().includes(q) ||
        row.employee.email.toLowerCase().includes(q);

      const matchesDept =
        !filterDepartment || row.employee.department?.id === filterDepartment;

      let matchesStatus = true;
      if (filterReviewStatus === "both_done") {
        matchesStatus =
          row.selfReview?.status === "SUBMITTED" &&
          row.managerReview?.status === "SUBMITTED";
      } else if (filterReviewStatus === "self_pending") {
        matchesStatus = row.selfReview?.status !== "SUBMITTED";
      } else if (filterReviewStatus === "manager_pending") {
        matchesStatus = row.managerReview?.status !== "SUBMITTED";
      }

      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [data?.rows, search, filterDepartment, filterReviewStatus]);

  if (isLoading || !data) return <PageSkeleton />;

  const cycle = data.cycle;
  const isDraft = cycle.status === "DRAFT";
  const isActive = cycle.status === "ACTIVE";
  const isClosed = cycle.status === "CLOSED";

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div>
        <Link
          href="/admin-portal/performance"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5D3EBC] hover:underline mb-1"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Performance Cycles
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mt-1">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900">{cycle.name}</h1>
              <Badge
                variant={
                  isActive ? "success" : isDraft ? "warning" : "secondary"
                }
              >
                {cycle.status}
              </Badge>
              <Badge variant="outline">{cycle.cycleType}</Badge>
            </div>
            <p className="mt-1 text-xs sm:text-sm text-neutral-500 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-neutral-400" />
              <span>{formatDate(cycle.startDate)} – {formatDate(cycle.endDate)}</span>
            </p>
          </div>

          <div className="flex gap-2">
            {isDraft && (
              <Button
                variant="outline"
                className="rounded-xl border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                onClick={() => activateMutation.mutate({ id: cycle.id })}
                disabled={activateMutation.isLoading}
              >
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                Activate Cycle
              </Button>
            )}
            {isActive && (
              <Button
                variant="outline"
                className="rounded-xl border-rose-300 text-rose-700 hover:bg-rose-50"
                onClick={() => {
                  if (
                    window.confirm(
                      "Are you sure you want to close this cycle? This locks all goals and reviews."
                    )
                  ) {
                    closeMutation.mutate({ id: cycle.id });
                  }
                }}
                disabled={closeMutation.isLoading}
              >
                <Lock className="mr-1.5 h-4 w-4" />
                Close Cycle
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Completion Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-caption font-medium text-neutral-500">
              Total Headcount
            </CardTitle>
            <Users className="h-4 w-4 text-teal-600" />
          </CardHeader>
          <CardContent>
            <p className="font-display text-3xl font-bold text-teal-700">
              {data.totalEmployees}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-caption font-medium text-neutral-500">
              Self Reviews
            </CardTitle>
            <UserCheck className="h-4 w-4 text-teal-600" />
          </CardHeader>
          <CardContent>
            <p className="font-display text-3xl font-bold text-teal-700">
              {data.selfSubmittedCount} / {data.totalEmployees}
            </p>
            <p className="text-caption text-neutral-500">
              {data.totalEmployees > 0
                ? `${Math.round((data.selfSubmittedCount / data.totalEmployees) * 100)}% submitted`
                : "0%"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-caption font-medium text-neutral-500">
              Manager Reviews
            </CardTitle>
            <Target className="h-4 w-4 text-teal-600" />
          </CardHeader>
          <CardContent>
            <p className="font-display text-3xl font-bold text-teal-700">
              {data.managerSubmittedCount} / {data.totalEmployees}
            </p>
            <p className="text-caption text-neutral-500">
              {data.totalEmployees > 0
                ? `${Math.round((data.managerSubmittedCount / data.totalEmployees) * 100)}% submitted`
                : "0%"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-caption font-medium text-neutral-500">
              Overall Average
            </CardTitle>
            <Star className="h-4 w-4 text-amber-500 fill-amber-400" />
          </CardHeader>
          <CardContent>
            <p className="font-display text-3xl font-bold text-teal-700">
              {data.overallAverageRating ? `${data.overallAverageRating} / 5` : "—"}
            </p>
            <p className="text-caption text-neutral-500">Across submitted ratings</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            className="pl-9"
            placeholder="Search employee by name, code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          className="w-48"
          value={filterDepartment}
          onChange={(e) => setFilterDepartment(e.target.value)}
        >
          <option value="">All departments</option>
          {departments?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
        <Select
          className="w-48"
          value={filterReviewStatus}
          onChange={(e) => setFilterReviewStatus(e.target.value)}
        >
          <option value="">All Review Statuses</option>
          <option value="both_done">Both Reviews Complete</option>
          <option value="self_pending">Self-Review Pending</option>
          <option value="manager_pending">Manager-Review Pending</option>
        </Select>
      </div>

      {/* Completion Tracking Table */}
      <div className="rounded-lg border border-neutral-200/80 bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Department &amp; Title</TableHead>
              <TableHead>Manager</TableHead>
              <TableHead className="text-center">Goals</TableHead>
              <TableHead>Self Review</TableHead>
              <TableHead>Manager Review</TableHead>
              <TableHead className="text-center">Avg Rating</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!filteredRows.length ? (
              <TableRow>
                <TableCell colSpan={8} className="p-0">
                  <EmptyState
                    title="No matching employees found"
                    description="Try changing the search or filter criteria."
                    className="border-0"
                  />
                </TableCell>
              </TableRow>
            ) : (
              filteredRows.map((r) => {
                const selfDone = r.selfReview?.status === "SUBMITTED";
                const mgrDone = r.managerReview?.status === "SUBMITTED";

                return (
                  <TableRow key={r.employee.id}>
                    <TableCell>
                      <Link
                        href={`/admin-portal/employees/${r.employee.id}`}
                        className="font-medium text-neutral-900 hover:text-teal-700 hover:underline"
                      >
                        {fullName(r.employee.firstName, r.employee.lastName)}
                      </Link>
                      <p className="text-xs text-neutral-500">
                        {r.employee.employeeCode}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium">
                        {r.employee.designation?.title ?? "—"}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {r.employee.department?.name ?? "—"}
                      </p>
                    </TableCell>
                    <TableCell>
                      {r.employee.manager ? (
                        <p className="text-caption text-neutral-700">
                          {fullName(
                            r.employee.manager.firstName,
                            r.employee.manager.lastName
                          )}
                        </p>
                      ) : (
                        <span className="text-caption text-neutral-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center font-semibold text-teal-800">
                      {r.goalsCount}
                    </TableCell>
                    <TableCell>
                      {selfDone ? (
                        <div className="flex items-center gap-1.5">
                          <Badge variant="success">Submitted</Badge>
                          {r.selfReview?.rating && (
                            <span className="text-caption font-semibold text-neutral-700">
                              ★ {r.selfReview.rating}
                            </span>
                          )}
                        </div>
                      ) : (
                        <Badge variant="secondary">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {mgrDone ? (
                        <div className="flex items-center gap-1.5">
                          <Badge variant="success">Submitted</Badge>
                          {r.managerReview?.rating && (
                            <span className="text-caption font-semibold text-neutral-700">
                              ★ {r.managerReview.rating}
                            </span>
                          )}
                        </div>
                      ) : (
                        <Badge variant="secondary">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {r.averageRating != null ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-0.5 text-caption font-bold text-teal-800">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-500" />
                          {r.averageRating}
                        </span>
                      ) : (
                        <span className="text-caption text-neutral-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/admin-portal/employees/${r.employee.id}`}
                        className="text-caption font-semibold text-teal-700 hover:underline"
                      >
                        Profile &amp; History
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
