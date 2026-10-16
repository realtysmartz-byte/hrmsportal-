"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  Search,
  Users,
  ChevronRight,
  Filter,
  ArrowUpDown,
  Building2,
  Mail,
  Phone,
  Sparkles,
  FileSpreadsheet,
  Download,
} from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { ExcelImportModal } from "@/components/ExcelImportModal";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
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
import { trpc } from "@/lib/trpc";
import { fullName, initials } from "@/lib/utils";
import { canManageEmployees, EMPLOYEE_STATUSES } from "@realty-smartz/shared";
import type { Role } from "@realty-smartz/shared";

export default function EmployeesPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <EmployeesInner />
    </Suspense>
  );
}

function EmployeesInner() {
  const q = useSearchParams().get("q");
  const { data: session } = useSession();
  const role = (session?.user?.role ?? "EMPLOYEE") as Role;
  const canManage = canManageEmployees(role);

  const [search, setSearch] = useState(q ?? "");
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    if (q !== null) setSearch(q);
  }, [q]);
  const [departmentId, setDepartmentId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [exportStatus, setExportStatus] = useState<
    "ACTIVE" | "TERMINATED" | "EXIT" | "RESIGNED" | "ON_LEAVE" | "ALL"
  >("ACTIVE");
  const [exporting, setExporting] = useState(false);

  const { data: departments } = trpc.department.list.useQuery();
  const { data, isLoading } = trpc.employee.list.useQuery({
    search: search || undefined,
    departmentId: departmentId || undefined,
    status: (status || undefined) as
      | (typeof EMPLOYEE_STATUSES)[number]
      | undefined,
    page,
    pageSize: 20,
  });
  const utils = trpc.useUtils();

  const rows = useMemo(() => data?.items ?? [], [data]);

  async function exportSheet() {
    setExporting(true);
    try {
      const dataRows = await utils.employee.exportRoster.fetch({
        status: exportStatus,
      });
      const XLSX = await import("xlsx");
      const sheet = XLSX.utils.json_to_sheet(dataRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, sheet, exportStatus);
      XLSX.writeFile(
        wb,
        `realty-smartz-employees-${exportStatus.toLowerCase()}-${new Date()
          .toISOString()
          .slice(0, 10)}.xlsx`
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* 1. TOP HEADER & QUICK STATS (Dashboards V3 Bento Style) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-neutral-900">
            Employees
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-neutral-500">
            Complete company staff roster, job designations, and live status
          </p>
        </div>

        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white p-1">
              <Select
                value={exportStatus}
                onChange={(e) =>
                  setExportStatus(
                    e.target.value as typeof exportStatus
                  )
                }
                className="h-9 border-0 bg-transparent text-xs font-semibold shadow-none focus:ring-0"
              >
                <option value="ACTIVE">Active</option>
                <option value="TERMINATED">Terminated</option>
                <option value="EXIT">Exit (no resign)</option>
                <option value="RESIGNED">Resigned</option>
                <option value="ON_LEAVE">On Leave</option>
                <option value="ALL">All</option>
              </Select>
              <button
                type="button"
                onClick={() => void exportSheet()}
                disabled={exporting}
                className="flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-2 text-xs font-bold text-white hover:bg-neutral-800 disabled:opacity-60"
              >
                <Download className="h-3.5 w-3.5" />
                {exporting ? "Exporting…" : "Export Sheet"}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-[#5D3EBC]/30 bg-white px-4 py-2.5 text-xs sm:text-sm font-bold text-[#5D3EBC] hover:bg-[#F3F0FC] transition-all"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Import Excel
            </button>
            <Link href="/admin-portal/employees/new">
              <button
                type="button"
                className="flex items-center gap-2 rounded-lg bg-[#5D3EBC] px-5 py-2.5 text-xs sm:text-sm font-bold text-white hover:opacity-95 active:scale-95 transition-all"
              >
                <Plus className="h-4 w-4" />
                Add Employee
              </button>
            </Link>
          </div>
        )}
      </div>

      <ExcelImportModal open={importOpen} onClose={() => setImportOpen(false)} />

      {/* 2. FILTER & SEARCH CONTROL BAR */}
      <div className="rounded-lg border border-neutral-200/80 bg-white p-3 sm:p-4 overflow-hidden">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Field */}
          <div className="relative min-w-0 sm:min-w-[200px] flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input
              className="pl-10"
              placeholder="Search by name, email, employee code..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {/* Department Filter */}
          <div className="w-full sm:w-48">
            <Select
              value={departmentId}
              onChange={(e) => {
                setDepartmentId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Departments</option>
              {departments?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>

          {/* Status Filter */}
          <div className="w-full sm:w-44">
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Statuses</option>
              {EMPLOYEE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </Select>
          </div>

          {/* Active Filter Clear Tag */}
          {(search || departmentId || status) && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setDepartmentId("");
                setStatus("");
                setPage(1);
              }}
              className="rounded-xl px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
            >
              Reset Filters
            </button>
          )}

          {/* Total Counter Badge */}
          <div className="ml-auto hidden xl:flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-600 border border-neutral-200/60">
            <Users className="h-3.5 w-3.5 text-neutral-500" />
            <span>{data?.total ?? 0} Records</span>
          </div>
        </div>
      </div>

      {/* 3. ROSTER DATA TABLE (Contained & Overflow-Hidden) */}
      {isLoading ? (
        <TableSkeleton rows={6} />
      ) : (
        <div className="rounded-lg border border-neutral-200/80 bg-white overflow-hidden">
          {/* Mobile Employee Cards (sm:hidden) */}
          <div className="block sm:hidden divide-y divide-neutral-100">
            {rows.length === 0 && (
              <EmptyState
                title="No employees found"
                description="Try adjusting your search filters or register a new team member."
                className="border-0 py-12"
                action={
                  canManage ? (
                    <Link href="/admin-portal/employees/new">
                      <Button size="sm">Add Employee</Button>
                    </Link>
                  ) : undefined
                }
              />
            )}
            {rows.map((emp) => (
              <Link
                key={emp.id}
                href={`/admin-portal/employees/${emp.id}`}
                className="flex items-center justify-between p-3.5 hover:bg-neutral-50/70 transition-colors gap-3"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#5D3EBC] text-xs font-bold text-white">
                    {emp.profilePhotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={emp.profilePhotoUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      initials(emp.firstName, emp.lastName)
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm text-neutral-900 truncate">
                      {fullName(emp.firstName, emp.lastName)}
                    </p>
                    <p className="text-[11px] text-neutral-500 truncate">
                      {emp.designation?.title ?? "No designation"} {emp.department?.name ? `• ${emp.department.name}` : ""}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="tabular-nums text-[10px] text-neutral-400 font-medium">
                        {emp.employeeCode}
                      </span>
                      <StatusBadge status={emp.status} />
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" />
              </Link>
            ))}
          </div>

          {/* Desktop Table (hidden sm:block) */}
          <div className="hidden sm:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="p-0">
                      <EmptyState
                        title="No employees found"
                        description="Try adjusting your search filters or register a new team member."
                        className="border-0 py-12"
                        action={
                          canManage ? (
                            <Link href="/admin-portal/employees/new">
                              <Button size="sm">Add Employee</Button>
                            </Link>
                          ) : undefined
                        }
                      />
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((emp) => (
                  <TableRow key={emp.id} className="hover:bg-neutral-50/70 transition-colors">
                    {/* Employee Details Column */}
                    <TableCell>
                      <Link
                        href={`/admin-portal/employees/${emp.id}`}
                        className="flex items-center gap-3.5 group/emp"
                      >
                        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#5D3EBC] text-xs font-bold text-white group-hover/emp:scale-105 transition-transform">
                          {emp.profilePhotoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={emp.profilePhotoUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            initials(emp.firstName, emp.lastName)
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-neutral-900 group-hover/emp:text-[#5D3EBC] transition-colors truncate">
                            {fullName(emp.firstName, emp.lastName)}
                          </p>
                          <p className="text-[11px] tabular-nums text-neutral-400 font-medium">
                            {emp.employeeCode}
                          </p>
                        </div>
                      </Link>
                    </TableCell>

                    {/* Designation Column */}
                    <TableCell className="font-medium text-neutral-700">
                      {emp.designation?.title ?? "—"}
                    </TableCell>

                    {/* Department Column */}
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100/80 px-2.5 py-0.5 text-xs font-medium text-neutral-700 border border-neutral-200/60">
                        <Building2 className="h-3 w-3 text-neutral-400" />
                        {emp.department?.name ?? "—"}
                      </span>
                    </TableCell>

                    {/* Status Column */}
                    <TableCell>
                      <StatusBadge status={emp.status} />
                    </TableCell>

                    {/* Action Column */}
                    <TableCell className="text-right">
                      <Link
                        href={`/admin-portal/employees/${emp.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-400 hover:text-[#5D3EBC] transition-colors"
                      >
                        <span>Manage</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* 4. PAGINATION FOOTER */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs sm:text-sm font-medium text-neutral-500">
            Showing Page <span className="font-bold text-neutral-800">{data.page}</span> of{" "}
            <span className="font-bold text-neutral-800">{data.totalPages}</span> ({data.total} total members)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
