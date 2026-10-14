"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, ChevronRight } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
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

export default function DirectoryPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const [search, setSearch] = useState(searchParams.q ?? "");

  useEffect(() => {
    if (searchParams.q !== undefined) setSearch(searchParams.q);
  }, [searchParams.q]);
  const [departmentId, setDepartmentId] = useState("");
  const { data: departments } = trpc.department.list.useQuery();
  const { data, isLoading } = trpc.employee.list.useQuery({
    search: search || undefined,
    departmentId: departmentId || undefined,
    page: 1,
    pageSize: 50,
  });
  const rows = useMemo(() => data?.items ?? [], [data]);

  return (
    <div className="section-gap">
      <div>
        <h1 className="page-title">Directory</h1>
        <p className="page-subtitle">
          Find colleagues — view-only, no edit access
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            className="pl-9"
            placeholder="Search name, email, code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          className="w-48"
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
        >
          <option value="">All departments</option>
          {departments?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </div>
      {isLoading ? (
        <TableSkeleton rows={6} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          {/* Mobile Colleague Cards (sm:hidden) */}
          <div className="block sm:hidden divide-y divide-neutral-100">
            {rows.length === 0 && (
              <EmptyState
                title="No colleagues found"
                description="Try a different search or department filter."
                className="border-0"
              />
            )}
            {rows.map((emp) => (
              <Link
                key={emp.id}
                href={`/employee-portal/directory/${emp.id}`}
                className="flex items-center justify-between p-3.5 hover:bg-neutral-50/70 transition-colors gap-3"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50 text-caption font-semibold text-teal-700">
                    {emp.profilePhotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={emp.profilePhotoUrl}
                        alt=""
                        className="h-full w-full rounded-full object-cover"
                      />
                    ) : (
                      initials(emp.firstName, emp.lastName)
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-neutral-900 truncate">
                      {fullName(emp.firstName, emp.lastName)}
                    </p>
                    <p className="text-[11px] text-neutral-500 truncate">
                      {emp.designation?.title ?? "No designation"} {emp.department?.name ? `• ${emp.department.name}` : ""}
                    </p>
                    <div className="mt-1">
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
                  <TableHead>Colleague</TableHead>
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
                        title="No colleagues found"
                        description="Try a different search or department filter."
                        className="border-0"
                      />
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell>
                      <Link
                        href={`/employee-portal/directory/${emp.id}`}
                        className="flex items-center gap-3 transition-opacity duration-150 hover:opacity-80"
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-50 text-caption font-semibold text-teal-700">
                          {emp.profilePhotoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={emp.profilePhotoUrl}
                              alt=""
                              className="h-full w-full rounded-full object-cover"
                            />
                          ) : (
                            initials(emp.firstName, emp.lastName)
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-teal-800">
                            {fullName(emp.firstName, emp.lastName)}
                          </p>
                          <p className="text-caption text-neutral-500">
                            {emp.email}
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
        </div>
      )}
    </div>
  );
}
