"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Check, X, FileText, Calendar, Clock, AlertCircle } from "lucide-react";
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
    return (
      <div className="flex h-48 items-center justify-center text-xs font-semibold text-neutral-400">
        Loading pending requests...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* 1. TOP HEADER (Dashboards V3 Style) */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
            <span>Realty Smartz Private Limited</span>
            <span>·</span>
            <span className="text-[#FF7A70] font-bold">Managerial Approvals</span>
          </div>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900">
            Leave Approvals
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-neutral-500">
            Review, authorize, or reject staff time-off and leave requests
          </p>
        </div>

        <div className="flex items-center gap-1.5 rounded-full bg-neutral-100 px-3.5 py-1.5 text-xs font-semibold text-neutral-700 border border-neutral-200/60">
          <Clock className="h-4 w-4 text-[#FF7A70]" />
          <span>{data?.length ?? 0} Awaiting Decision</span>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. REQUESTS (Dual View: Desktop Table + Mobile Cards) */}
      {isLoading ? (
        <TableSkeleton rows={4} />
      ) : !data?.length ? (
        <div className="rounded-2xl border border-neutral-200/80 bg-white p-12 text-center shadow-sm">
          <EmptyState
            title="All clear! Zero pending requests"
            description="When employees submit new leave applications, they will appear here for your review."
            className="border-0"
          />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Desktop Table View */}
          <div className="hidden md:block rounded-2xl border border-neutral-200/80 bg-white shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Leave Type</TableHead>
                  <TableHead>Date Interval</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right min-w-[240px]">Decision</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((r) => (
                  <TableRow key={r.id} className="hover:bg-neutral-50/70 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[#FF7A70] to-[#FFA07A] text-xs font-bold text-white shadow-xs">
                          {r.employee.firstName?.[0]}
                          {r.employee.lastName?.[0]}
                        </div>
                        <div>
                          <p className="font-bold text-neutral-900">
                            {fullName(r.employee.firstName, r.employee.lastName)}
                          </p>
                          <p className="text-[11px] font-mono text-neutral-400 font-medium">
                            {r.employee.employeeCode}
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold text-neutral-700 border border-neutral-200/60">
                        {r.leaveType.name}
                      </span>
                    </TableCell>

                    <TableCell className="font-medium text-neutral-700 text-xs sm:text-sm">
                      {formatDate(r.startDate)} – {formatDate(r.endDate)}
                    </TableCell>

                    <TableCell>
                      <span className="font-bold text-neutral-900">
                        {r.numberOfDays} {r.numberOfDays === 1 ? "day" : "days"}
                      </span>
                    </TableCell>

                    <TableCell className="max-w-xs text-xs text-neutral-600 line-clamp-2">
                      {r.reason}
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Input
                          placeholder="Optional note..."
                          className="h-8 text-xs max-w-[150px]"
                          value={notes[r.id] ?? ""}
                          onChange={(e) =>
                            setNotes((prev) => ({
                              ...prev,
                              [r.id]: e.target.value,
                            }))
                          }
                        />
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={respond.isLoading}
                            onClick={() =>
                              respond.mutate({
                                id: r.id,
                                action: "APPROVE",
                                approverNote: notes[r.id] || null,
                              })
                            }
                            className="flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition-colors disabled:opacity-50"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={respond.isLoading}
                            onClick={() =>
                              respond.mutate({
                                id: r.id,
                                action: "REJECT",
                                approverNote: notes[r.id] || null,
                              })
                            }
                            className="flex items-center gap-1 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-rose-700 transition-colors disabled:opacity-50"
                          >
                            <X className="h-3.5 w-3.5" />
                            Reject
                          </button>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards View */}
          <div className="md:hidden space-y-3">
            {data.map((r) => (
              <div
                key={r.id}
                className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-2xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[#FF7A70] to-[#FFA07A] text-xs font-bold text-white shadow-xs">
                      {r.employee.firstName?.[0]}
                      {r.employee.lastName?.[0]}
                    </div>
                    <div>
                      <p className="font-bold text-xs text-neutral-900">
                        {fullName(r.employee.firstName, r.employee.lastName)}
                      </p>
                      <p className="text-[10px] font-mono text-neutral-400">
                        {r.employee.employeeCode}
                      </p>
                    </div>
                  </div>

                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-700 border border-neutral-200">
                    {r.leaveType.name}
                  </span>
                </div>

                <div className="rounded-xl bg-neutral-50 p-2.5 text-xs space-y-1.5 border border-neutral-100">
                  <div className="flex items-center justify-between text-neutral-700">
                    <span className="text-neutral-400 font-medium">Dates:</span>
                    <span className="font-semibold">{formatDate(r.startDate)} – {formatDate(r.endDate)}</span>
                  </div>
                  <div className="flex items-center justify-between text-neutral-700">
                    <span className="text-neutral-400 font-medium">Duration:</span>
                    <span className="font-bold text-[#FF7A70]">
                      {r.numberOfDays} {r.numberOfDays === 1 ? "day" : "days"}
                    </span>
                  </div>
                  {r.reason && (
                    <div className="pt-1 border-t border-neutral-200/50">
                      <span className="text-neutral-400 font-medium text-[11px] block">Reason:</span>
                      <p className="text-neutral-700 text-[11px] italic mt-0.5">{r.reason}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-2 pt-1">
                  <Input
                    placeholder="Optional note..."
                    className="h-8 text-xs w-full"
                    value={notes[r.id] ?? ""}
                    onChange={(e) =>
                      setNotes((prev) => ({
                        ...prev,
                        [r.id]: e.target.value,
                      }))
                    }
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={respond.isLoading}
                      onClick={() =>
                        respond.mutate({
                          id: r.id,
                          action: "APPROVE",
                          approverNote: notes[r.id] || null,
                        })
                      }
                      className="flex items-center justify-center gap-1 rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition-colors disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={respond.isLoading}
                      onClick={() =>
                        respond.mutate({
                          id: r.id,
                          action: "REJECT",
                          approverNote: notes[r.id] || null,
                        })
                      }
                      className="flex items-center justify-center gap-1 rounded-xl bg-rose-600 py-2 text-xs font-bold text-white shadow-xs hover:bg-rose-700 transition-colors disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" />
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
