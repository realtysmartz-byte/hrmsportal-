"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus, Briefcase, Users, MapPin, Building2, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/select";
import { TableSkeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { formatDate } from "@/lib/utils";

export default function RecruitmentJobsPage() {
  const [status, setStatus] = useState("");
  const { data, isLoading } = trpc.recruitment.jobList.useQuery({
    status: (status || undefined) as "OPEN" | "ON_HOLD" | "CLOSED" | undefined,
  });

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* 1. TOP HEADER (Dashboards V3 Style) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-neutral-900">
            Recruitment
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-neutral-500">
            Corporate job postings, requisitions, and candidate application pipeline
          </p>
        </div>

        <Link href="/admin-portal/recruitment/new">
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg bg-[#5D3EBC] px-5 py-2.5 text-xs sm:text-sm font-bold text-white hover:opacity-95 active:scale-95 transition-all"
          >
            <Plus className="h-4 w-4" />
            New Job Posting
          </button>
        </Link>
      </div>

      {/* 2. FILTER BAR */}
      <div className="rounded-lg border border-neutral-200/80 bg-white p-3.5 sm:p-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="w-full sm:w-56">
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All Job Statuses</option>
              <option value="OPEN">Open & Active</option>
              <option value="ON_HOLD">On Hold</option>
              <option value="CLOSED">Closed / Filled</option>
            </Select>
          </div>

          <div className="flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700 border border-neutral-200/60">
            <Briefcase className="h-3.5 w-3.5 text-[#5D3EBC]" />
            <span>{data?.length ?? 0} Total Postings</span>
          </div>
        </div>
      </div>

      {/* 3. JOBS TABLE (Contained & Overflow-Hidden) */}
      {isLoading ? (
        <TableSkeleton rows={4} />
      ) : !data?.length ? (
        <div className="rounded-lg border border-neutral-200/80 bg-white p-12 text-center shadow-sm">
          <EmptyState
            title="No active job postings found"
            description="Create your first job requisition to start receiving candidate applications."
            className="border-0"
            action={
              <Link href="/admin-portal/recruitment/new">
                <Button size="sm">New Job Posting</Button>
              </Link>
            }
          />
        </div>
      ) : (
        <div className="rounded-lg border border-neutral-200/80 bg-white shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role / Title</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Candidates</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Posted Date</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((job) => (
                <TableRow key={job.id} className="hover:bg-neutral-50/70 transition-colors">
                  <TableCell>
                    <Link
                      href={`/admin-portal/recruitment/${job.id}`}
                      className="font-bold text-neutral-900 hover:text-[#5D3EBC] transition-colors"
                    >
                      {job.title}
                    </Link>
                  </TableCell>

                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-700">
                      <Building2 className="h-3 w-3 text-neutral-400" />
                      {job.department?.name ?? "—"}
                    </span>
                  </TableCell>

                  <TableCell>
                    <span className="inline-flex items-center gap-1 text-xs text-neutral-600">
                      <MapPin className="h-3.5 w-3.5 text-neutral-400" />
                      {job.location}
                    </span>
                  </TableCell>

                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold text-neutral-800">
                      <Users className="h-3 w-3 text-[#5D3EBC]" />
                      {job._count.candidates} Applied
                    </span>
                  </TableCell>

                  <TableCell>
                    <Badge
                      variant={
                        job.status === "OPEN"
                          ? "success"
                          : job.status === "CLOSED"
                            ? "secondary"
                            : "warning"
                      }
                    >
                      {job.status}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-xs text-neutral-500 font-medium">
                    {formatDate(job.createdAt)}
                  </TableCell>

                  <TableCell className="text-right">
                    <Link
                      href={`/admin-portal/recruitment/${job.id}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-400 hover:text-[#5D3EBC] transition-colors"
                    >
                      <span>Pipeline</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
