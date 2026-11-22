"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Suspense, useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Plus,
  Search,
  Users,
  ChevronRight,
  Building2,
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q");
  const pageParam = Number(searchParams.get("page"));
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

  // Restore saved page from URL or sessionStorage so navigating back keeps page 3
  const initialPage = pageParam > 0
    ? pageParam
    : (typeof window !== "undefined" ? Number(sessionStorage.getItem("admin_employees_page")) : 0) || 1;
  const [page, setPage] = useState(initialPage);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("admin_employees_page", String(newPage));
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(newPage));
    router.replace(`/admin-portal/employees?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

  // Keep page in sync if URL search param changes
  useEffect(() => {
    if (pageParam > 0 && pageParam !== page) {
      setPage(pageParam);
    }
  }, [pageParam]);

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
      const formattedRows = dataRows.map((r) => ({
        "Consultant Code": r.employeeCode,
        "Consultant Name": `${r.firstName} ${r.lastName}`.trim(),
        "First Name": r.firstName,
        "Last Name": r.lastName,
        "Department": r.department || "-",
        "Designation": r.designation || "-",
        "Status": r.status === "EXIT" ? "Absconding" : r.status,
        "Date of Joining": r.dateOfJoining || "-",
        "Termination / Absconding Date": r.terminationDate || "-",
        "Separation Type": r.separationType === "EXIT" ? "Absconding" : (r.separationType || (r.status === "ACTIVE" ? "Active" : "-")),
        "Reporting Manager": r.manager || "-",
        "Email": r.email,
        "Phone": r.phone || "-",
        "Gender": r.gender || "-",
        "Date of Birth": r.dateOfBirth || "-",
        "Address": r.address || "-",
        "Last Profile Update": r.updatedAt || "-",
      }));
      const ws = XLSX.utils.json_to_sheet(formattedRows);
      ws["!cols"] = [
        { wch: 18 }, // Consultant Code
        { wch: 22 }, // Consultant Name
        { wch: 15 }, // First Name
        { wch: 15 }, // Last Name
        { wch: 20 }, // Department
        { wch: 22 }, // Designation
        { wch: 15 }, // Status
        { wch: 16 }, // Date of Joining (fully visible, no ########)
        { wch: 22 }, // Termination Date
        { wch: 18 }, // Separation Type
        { wch: 22 }, // Reporting Manager
        { wch: 28 }, // Email
        { wch: 16 }, // Phone
        { wch: 12 }, // Gender
        { wch: 16 }, // Date of Birth (fully visible, no ########)
        { wch: 30 }, // Address
        { wch: 20 }, // Last Profile Update
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Consultants");
      XLSX.writeFile(
        wb,
        `Realty_Smartz_Consultants_${exportStatus}_${new Date().toISOString().slice(0, 10)}.xlsx`
      );
    } catch (e: any) {
      alert("Failed to export: " + (e?.message || "Unknown error"));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto text-[var(--ink)]">
      {/* 1. Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--line)] pb-5">
        <div>
          <h1 className="text-[26px] font-bold text-[var(--ink)] tracking-tight">
            Employees
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-[var(--muted)]">
            Complete company staff roster, job designations, and live status
          </p>
        </div>

        {canManage && (
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 rounded border border-[var(--line)] bg-[var(--card)] p-1">
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
                <option value="EXIT">Absconding</option>
                <option value="RESIGNED">Resigned</option>
                <option value="ON_LEAVE">On leave</option>
                <option value="ALL">All</option>
              </Select>
              <button
                type="button"
                onClick={() => void exportSheet()}
                disabled={exporting}
                className="flex items-center gap-1.5 rounded bg-[var(--ink)] px-3 py-2 text-xs font-semibold text-[var(--card)] hover:opacity-90 disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" strokeWidth={1.8} />
                {exporting ? "Exporting…" : "Export sheet"}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="flex items-center gap-2 rounded border border-[var(--line)] bg-[var(--card)] px-4 h-11 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--hover)] transition-colors"
            >
              <FileSpreadsheet className="h-4 w-4 text-[var(--accent)]" strokeWidth={1.8} />
              Import Excel
            </button>
            <Link href="/admin-portal/employees/new">
              <button
                type="button"
                className="btn-chamfer flex items-center gap-2 bg-[var(--accent)] px-5 h-11 text-xs font-semibold text-white hover:brightness-110 transition-all"
              >
                <Plus className="h-4 w-4" strokeWidth={1.8} />
                Add employee
              </button>
            </Link>
          </div>
        )}
      </div>

      <ExcelImportModal open={importOpen} onClose={() => setImportOpen(false)} />

      {/* 2. Filter & Search Control Bar */}
      <div className="rounded border border-[var(--line)] bg-[var(--card)] p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Field */}
          <div className="relative min-w-0 sm:min-w-[200px] flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" strokeWidth={1.8} />
            <Input
              className="pl-10"
              placeholder="Search by name, email, employee code..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                handlePageChange(1);
              }}
            />
          </div>

          {/* Department Filter */}
          <div className="w-full sm:w-48">
            <Select
              value={departmentId}
              onChange={(e) => {
                setDepartmentId(e.target.value);
                handlePageChange(1);
              }}
            >
              <option value="">All departments</option>
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
                handlePageChange(1);
              }}
            >
              <option value="">All statuses</option>
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
              className="rounded px-3 py-2 text-xs font-semibold text-[var(--danger)] hover:bg-[var(--hover)] transition-colors"
            >
              Reset filters
            </button>
          )}

          {/* Total Counter Badge */}
          <div className="ml-auto hidden xl:flex items-center gap-1.5 rounded border border-[var(--line)] bg-[var(--field)] px-3 py-1.5 text-xs font-semibold text-[var(--muted)]">
            <Users className="h-3.5 w-3.5" strokeWidth={1.8} />
            <span>{data?.total ?? 0} records</span>
          </div>
        </div>
      </div>

      {/* 3. Roster Data Table */}
      {isLoading ? (
        <TableSkeleton rows={6} />
      ) : (
        <div className="rounded border border-[var(--line)] bg-[var(--card)] overflow-hidden">
          {/* Mobile Employee Cards (sm:hidden) */}
          <div className="block sm:hidden divide-y divide-[var(--line)]">
            {rows.length === 0 && (
              <EmptyState
                title="No employees found"
                description="Try adjusting your search filters or register a new team member."
                className="border-0 py-12"
                action={
                  canManage ? (
                    <Link href="/admin-portal/employees/new">
                      <Button size="sm">Add employee</Button>
                    </Link>
                  ) : undefined
                }
              />
            )}
            {rows.map((emp) => (
              <Link
                key={emp.id}
                href={`/admin-portal/employees/${emp.id}`}
                className="flex items-center justify-between p-3.5 hover:bg-[var(--hover)] transition-colors gap-3"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded bg-[var(--accent)] text-xs font-bold text-white">
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
                    <p className="font-bold text-sm text-[var(--ink)] truncate">
                      {fullName(emp.firstName, emp.lastName)}
                    </p>
                    <p className="text-[11px] text-[var(--muted)] truncate">
                      {emp.designation?.title ?? "No designation"} {emp.department?.name ? `· ${emp.department.name}` : ""}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="tabular-nums text-[10px] text-[var(--muted)] font-medium">
                        {emp.employeeCode}
                      </span>
                      <StatusBadge status={emp.status} />
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-[var(--muted)]" strokeWidth={1.8} />
              </Link>
            ))}
          </div>

          {/* Desktop Table */}
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
                              <Button size="sm">Add employee</Button>
                            </Link>
                          ) : undefined
                        }
                      />
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((emp) => (
                  <TableRow key={emp.id} className="hover:bg-[var(--hover)] transition-colors">
                    {/* Employee Details Column */}
                    <TableCell>
                      <Link
                        href={`/admin-portal/employees/${emp.id}?page=${page}`}
                        className="flex items-center gap-3.5 group/emp"
                      >
                        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded bg-[var(--accent)] text-xs font-bold text-white">
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
                          <p className="font-semibold text-[var(--ink)] group-hover/emp:text-[var(--accent)] transition-colors truncate">
                            {fullName(emp.firstName, emp.lastName)}
                          </p>
                          <p className="text-[11px] tabular-nums text-[var(--muted)] font-medium">
                            {emp.employeeCode}
                          </p>
                        </div>
                      </Link>
                    </TableCell>

                    {/* Designation Column */}
                    <TableCell className="font-medium text-[var(--ink)]">
                      {emp.designation?.title ?? "—"}
                    </TableCell>

                    {/* Department Column */}
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 rounded border border-[var(--line)] bg-[var(--field)] px-2.5 py-0.5 text-xs font-medium text-[var(--ink)]">
                        <Building2 className="h-3 w-3 text-[var(--muted)]" strokeWidth={1.8} />
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
                        href={`/admin-portal/employees/${emp.id}?page=${page}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
                      >
                        <span>Manage</span>
                        <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.8} />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* 4. Pagination Footer */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs sm:text-sm font-medium text-[var(--muted)]">
            Showing page <span className="font-bold text-[var(--ink)]">{data.page}</span> of{" "}
            <span className="font-bold text-[var(--ink)]">{data.totalPages}</span> ({data.total} total members)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => handlePageChange(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.totalPages}
              onClick={() => handlePageChange(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
