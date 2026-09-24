"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
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
  const { data: session } = useSession();
  const role = (session?.user?.role ?? "EMPLOYEE") as Role;
  const canManage = canManageEmployees(role);

  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

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

  const rows = useMemo(() => data?.items ?? [], [data]);

  return (
    <div className="section-gap">
      <div className="page-header">
        <div>
          <h1 className="page-title">Employees</h1>
          <p className="page-subtitle">Directory of all company employees</p>
        </div>
        {canManage && (
          <Link href="/admin-portal/employees/new">
            <Button className="inline-flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Employee
            </Button>
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            className="pl-9"
            placeholder="Search name, email, code..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          className="w-48"
          value={departmentId}
          onChange={(e) => {
            setDepartmentId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All departments</option>
          {departments?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
        <Select
          className="w-40"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
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

      {isLoading ? (
        <TableSkeleton rows={6} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="p-0">
                    <EmptyState
                      title="No employees found"
                      description="Try adjusting filters, or add a new employee."
                      className="border-0"
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
                <TableRow key={emp.id}>
                  <TableCell>
                    <Link
                      href={`/admin-portal/employees/${emp.id}`}
                      className="flex items-center gap-3 transition-opacity duration-150 hover:opacity-80"
                    >
                      <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-teal-50 text-xs font-semibold text-teal-700">
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
                      <div>
                        <p className="font-medium text-teal-800">
                          {fullName(emp.firstName, emp.lastName)}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {emp.employeeCode}
                        </p>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell>{emp.designation?.title ?? "—"}</TableCell>
                  <TableCell>{emp.department?.name ?? "—"}</TableCell>
                  <TableCell>
                    <StatusBadge status={emp.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-neutral-500">
            Page {data.page} of {data.totalPages} ({data.total} total)
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
