"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
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
import { formatDate, fullName } from "@/lib/utils";
import { canApproveLeave } from "@realty-smartz/shared";
import type { Role } from "@realty-smartz/shared";

export default function LeaveApprovalsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const role = (session?.user?.role ?? "EMPLOYEE") as Role;
  const allowed = canApproveLeave(role);
  const utils = trpc.useUtils();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  const { data, isLoading } = trpc.leave.pendingApprovals.useQuery(undefined, {
    enabled: allowed,
  });

  const respond = trpc.leave.respond.useMutation({
    onSuccess: () => {
      utils.leave.pendingApprovals.invalidate();
      utils.leave.myBalances.invalidate();
      setError("");
    },
    onError: (err) => setError(err.message),
  });

  useEffect(() => {
    if (status === "authenticated" && !allowed) {
      router.replace("/admin-portal/dashboard");
    }
  }, [status, allowed, router]);

  if (status === "loading" || !allowed) {
    return <TableSkeleton />;
  }

  return (
    <div className="section-gap">
      <div className="page-header">
        <div>
          <h1 className="page-title">Leave Approvals</h1>
          <p className="page-subtitle">
            Approve or reject pending leave requests
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-maroon-600">{error}</p>}

      {isLoading ? (
        <TableSkeleton />
      ) : !data?.length ? (
        <EmptyState
          title="No pending requests"
          description="When employees apply for leave, approvals will show up here."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Note / Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <p className="font-medium">
                      {fullName(r.employee.firstName, r.employee.lastName)}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {r.employee.employeeCode}
                    </p>
                  </TableCell>
                  <TableCell>{r.leaveType.name}</TableCell>
                  <TableCell>
                    {formatDate(r.startDate)} – {formatDate(r.endDate)}
                  </TableCell>
                  <TableCell>{r.numberOfDays}</TableCell>
                  <TableCell className="max-w-xs whitespace-pre-wrap text-sm">
                    {r.reason}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-2">
                      <Input
                        placeholder="Optional note"
                        value={notes[r.id] ?? ""}
                        onChange={(e) =>
                          setNotes((prev) => ({
                            ...prev,
                            [r.id]: e.target.value,
                          }))
                        }
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={respond.isLoading}
                          onClick={() =>
                            respond.mutate({
                              id: r.id,
                              action: "APPROVE",
                              approverNote: notes[r.id] || null,
                            })
                          }
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={respond.isLoading}
                          onClick={() =>
                            respond.mutate({
                              id: r.id,
                              action: "REJECT",
                              approverNote: notes[r.id] || null,
                            })
                          }
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
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
