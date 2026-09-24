"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus } from "lucide-react";
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
    <div className="section-gap">
      <div className="page-header">
        <div>
          <h1 className="page-title">Recruitment</h1>
          <p className="page-subtitle">Job postings and candidate pipeline</p>
        </div>
        <Link href="/admin-portal/recruitment/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New job posting
          </Button>
        </Link>
      </div>

      <Select
        className="w-48"
        value={status}
        onChange={(e) => setStatus(e.target.value)}
      >
        <option value="">All statuses</option>
        <option value="OPEN">Open</option>
        <option value="ON_HOLD">On hold</option>
        <option value="CLOSED">Closed</option>
      </Select>

      {isLoading ? (
        <TableSkeleton />
      ) : !data?.length ? (
        <EmptyState
          title="No job postings yet"
          description="Create a job posting to start sourcing candidates."
          action={
            <Link href="/admin-portal/recruitment/new">
              <Button size="sm">New job posting</Button>
            </Link>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Candidates</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Posted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((job) => (
                <TableRow key={job.id}>
                  <TableCell>
                    <Link
                      href={`/admin-portal/recruitment/${job.id}`}
                      className="font-medium text-teal-800 transition-colors duration-150 hover:underline"
                    >
                      {job.title}
                    </Link>
                  </TableCell>
                  <TableCell>{job.department?.name ?? "—"}</TableCell>
                  <TableCell>{job.location}</TableCell>
                  <TableCell>{job._count.candidates}</TableCell>
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
                      {job.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(job.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
