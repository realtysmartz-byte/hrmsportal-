"use client";

import { userFacingErrorMessage } from "@/lib/user-facing-error";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Check,
  X,
  FileText,
  Calendar,
  Clock,
  AlertCircle,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Filter,
} from "lucide-react";
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
import { canApproveLeave, HALF_DAY_SLOT_LABELS } from "@realty-smartz/shared";
import type { Role } from "@realty-smartz/shared";

type StatusTab = "PENDING" | "APPROVED" | "REJECTED" | "ALL";

export default function LeaveApprovalsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const role = (session?.user?.role ?? "EMPLOYEE") as Role;
  const allowed = canApproveLeave(role);
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<StatusTab>("PENDING");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

    const { data: pendingData } = trpc.leave.pendingApprovals.useQuery(undefined, {
      enabled: allowed,
    });

    const { data, isLoading } = trpc.leave.listApprovals.useQuery(
      { status: activeTab },
      { enabled: allowed }
    );

    const respond = trpc.leave.respond.useMutation({
      onSuccess: () => {
        utils.leave.listApprovals.invalidate();
        utils.leave.pendingApprovals.invalidate();
        utils.leave.myBalances.invalidate();
        utils.leave.forEmployee.invalidate();
        setError("");
      },
      onError: (err) => setError(userFacingErrorMessage(err)),
    });

    useEffect(() => {
    if (status === "authenticated" && !allowed) {
      router.replace("/admin-portal/dashboard");
    }
  }, [status, allowed, router]);

  if (status === "loading" || !allowed) {
    return (
      <div className="flex h-48 items-center justify-center text-xs font-semibold text-neutral-400">
        Loading requests...
      </div>
    );
  }

  const pendingCount = pendingData?.length ?? 0;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
        {/* 1. TOP HEADER */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold text-neutral-900">
              Leave Approvals & Management
            </h1>
            <p className="mt-0.5 text-xs sm:text-sm text-neutral-500">
              Review, authorize, reject, or correct past staff time-off decisions
            </p>
          </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3.5 py-1.5 text-xs font-semibold text-amber-800 border border-amber-200">
                <Clock className="h-4 w-4 text-amber-600" />
                <span>{pendingCount} Awaiting Decision</span>
              </div>
            </div>
          </div>

          {/* 2. FILTER TABS */}
          <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200/80 pb-3">
            <button
              type="button"
              onClick={() => setActiveTab("PENDING")}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${activeTab === "PENDING"
                  ? "bg-[#5D3EBC] text-white shadow-xs"
                  : "bg-white text-neutral-600 border border-neutral-200/80 hover:bg-neutral-50"
                }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Pending</span>
              {pendingCount > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-black ${activeTab === "PENDING"
                      ? "bg-amber-400 text-neutral-900"
                      : "bg-amber-100 text-amber-800"
                    }`}
                >
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("APPROVED")}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${activeTab === "APPROVED"
                  ? "bg-[#5D3EBC] text-white shadow-xs"
                  : "bg-white text-neutral-600 border border-neutral-200/80 hover:bg-neutral-50"
                }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Approved</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("REJECTED")}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${activeTab === "REJECTED"
                  ? "bg-[#5D3EBC] text-white shadow-xs"
                  : "bg-white text-neutral-600 border border-neutral-200/80 hover:bg-neutral-50"
                }`}
            >
              <XCircle className="h-3.5 w-3.5" />
              <span>Rejected</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("ALL")}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${activeTab === "ALL"
                  ? "bg-[#5D3EBC] text-white shadow-xs"
                  : "bg-white text-neutral-600 border border-neutral-200/80 hover:bg-neutral-50"
                }`}
            >
              <Filter className="h-3.5 w-3.5" />
              <span>All Records</span>
            </button>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}

          {/* 3. REQUESTS (Dual View: Desktop Table + Mobile Cards) */}
          {isLoading ? (
            <TableSkeleton rows={4} />
          ) : !data?.length ? (
            <div className="rounded-lg border border-neutral-200/80 bg-white p-12 text-center">
              <EmptyState
                title={`No ${activeTab.toLowerCase()} leave requests`}
                description={
                  activeTab === "PENDING"
                    ? "All clear! Zero pending leave requests currently awaiting decision."
                    : `There are currently no ${activeTab.toLowerCase()} leave requests in this view.`
                }
                className="border-0"
              />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Desktop Table View */}
                <div className="hidden md:block rounded-lg border border-neutral-200/80 bg-white overflow-hidden shadow-xs">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Leave Type</TableHead>
                        <TableHead>Date Interval</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Reason & Note</TableHead>
                        <TableHead className="text-right min-w-[280px]">Action / Change Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.map((r) => (
                        <TableRow key={r.id} className="hover:bg-neutral-50/70 transition-colors">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#5D3EBC] text-xs font-bold text-white">
                                {r.employee.firstName?.[0]}
                                {r.employee.lastName?.[0]}
                              </div>
                              <div>
                                <p className="font-bold text-neutral-900">
                                  {fullName(r.employee.firstName, r.employee.lastName)}
                                </p>
                                <p className="text-[11px] tabular-nums text-neutral-400 font-medium">
                                  {r.employee.employeeCode} {r.employee.department?.name ? `· ${r.employee.department.name}` : ""}
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
                              {r.isHalfDay
                                ? r.halfDaySlot === "SECOND_HALF"
                                  ? HALF_DAY_SLOT_LABELS.SECOND_HALF
                                  : HALF_DAY_SLOT_LABELS.FIRST_HALF
                                : `${r.numberOfDays} ${r.numberOfDays === 1 ? "day" : "days"}`}
                            </span>
                          </TableCell>

                            <TableCell>
                              <span
                                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${r.status === "APPROVED"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : r.status === "REJECTED"
                                      ? "bg-rose-50 text-rose-700 border border-rose-200"
                                      : r.status === "CANCELLED"
                                        ? "bg-neutral-100 text-neutral-500 border border-neutral-200"
                                        : "bg-amber-50 text-amber-700 border border-amber-200"
                                  }`}
                              >
                                {r.status === "APPROVED" && <Check className="h-3 w-3" />}
                                {r.status === "REJECTED" && <X className="h-3 w-3" />}
                                {r.status === "PENDING" && <Clock className="h-3 w-3" />}
                                {r.status}
                              </span>
                            </TableCell>

                            <TableCell className="max-w-xs text-xs">
                              <p className="text-neutral-700 font-medium line-clamp-1">{r.reason}</p>
                              {r.approverNote && (
                                <p className="text-[11px] text-neutral-400 italic mt-0.5">
                                  Note: {r.approverNote}
                                </p>
                              )}
                            </TableCell>

                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Input
                                  placeholder="Optional note..."
                                  className="h-8 text-xs max-w-[130px]"
                                  value={notes[r.id] ?? ""}
                                  onChange={(e) =>
                                    setNotes((prev) => ({
                                      ...prev,
                                      [r.id]: e.target.value,
                                    }))
                                  }
                                />

                                  {/* PENDING ACTIONS */}
                                  {r.status === "PENDING" && (
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
                                        className="flex items-center gap-1 rounded-xl bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 shadow-2xs"
                                        title="Approve this leave request"
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
                                        className="flex items-center gap-1 rounded-xl bg-rose-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-rose-700 transition-colors disabled:opacity-50 shadow-2xs"
                                        title="Reject this leave request"
                                      >
                                        <X className="h-3.5 w-3.5" />
                                        Reject
                                      </button>
                                    </div>
                                  )}

                                  {/* APPROVED ACTIONS: Option to Change to Reject or Reset */}
                                  {r.status === "APPROVED" && (
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        disabled={respond.isLoading}
                                        onClick={() =>
                                          respond.mutate({
                                            id: r.id,
                                            action: "REJECT",
                                            approverNote: notes[r.id] || "Reversed approval to reject",
                                          })
                                        }
                                        className="flex items-center gap-1 rounded-xl bg-rose-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-rose-700 transition-colors disabled:opacity-50"
                                        title="Reverse decision: Change to Reject"
                                      >
                                        <X className="h-3.5 w-3.5" />
                                        Change to Reject
                                      </button>
                                      <button
                                        type="button"
                                        disabled={respond.isLoading}
                                        onClick={() =>
                                          respond.mutate({
                                            id: r.id,
                                            action: "RESET_TO_PENDING",
                                            approverNote: null,
                                          })
                                        }
                                        className="flex items-center gap-1 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-neutral-300 px-2 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50"
                                        title="Reset status back to Pending"
                                      >
                                        <RotateCcw className="h-3 w-3" />
                                        Reset
                                      </button>
                                    </div>
                                  )}

                                  {/* REJECTED ACTIONS: Option to Change to Approve or Reset */}
                                  {r.status === "REJECTED" && (
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        disabled={respond.isLoading}
                                        onClick={() =>
                                          respond.mutate({
                                            id: r.id,
                                            action: "APPROVE",
                                            approverNote: notes[r.id] || "Reversed rejection to approve",
                                          })
                                        }
                                        className="flex items-center gap-1 rounded-xl bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                                        title="Reverse decision: Change to Approve"
                                      >
                                        <Check className="h-3.5 w-3.5" />
                                        Change to Approve
                                      </button>
                                      <button
                                        type="button"
                                        disabled={respond.isLoading}
                                        onClick={() =>
                                          respond.mutate({
                                            id: r.id,
                                            action: "RESET_TO_PENDING",
                                            approverNote: null,
                                          })
                                        }
                                        className="flex items-center gap-1 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-neutral-300 px-2 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50"
                                        title="Reset status back to Pending"
                                      >
                                        <RotateCcw className="h-3 w-3" />
                                        Reset
                                      </button>
                                    </div>
                                  )}

                                  {/* CANCELLED ACTIONS */}
                                  {r.status === "CANCELLED" && (
                          <button
                            type="button"
                            disabled={respond.isLoading}
                            onClick={() =>
                              respond.mutate({
                                id: r.id,
                                action: "RESET_TO_PENDING",
                                approverNote: null,
                              })
                            }
                            className="flex items-center gap-1 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-neutral-300 px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50"
                            title="Re-open request as Pending"
                          >
                            <RotateCcw className="h-3 w-3" />
                            Reopen to Pending
                          </button>
                        )}
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
                      className="rounded-lg border border-neutral-200/80 bg-white p-4 space-y-3 shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#5D3EBC] text-xs font-bold text-white">
                            {r.employee.firstName?.[0]}
                            {r.employee.lastName?.[0]}
                          </div>
                          <div>
                            <p className="font-bold text-xs text-neutral-900">
                              {fullName(r.employee.firstName, r.employee.lastName)}
                            </p>
                            <p className="text-[10px] tabular-nums text-neutral-400">
                              {r.employee.employeeCode}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-700 border border-neutral-200">
                            {r.leaveType.name}
                          </span>
                          <span
                            className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${r.status === "APPROVED"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : r.status === "REJECTED"
                                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                                  : r.status === "CANCELLED"
                                    ? "bg-neutral-100 text-neutral-500 border border-neutral-200"
                                    : "bg-amber-50 text-amber-700 border border-amber-200"
                              }`}
                          >
                            {r.status}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-xl bg-neutral-50 p-2.5 text-xs space-y-1.5 border border-neutral-100">
                        <div className="flex items-center justify-between text-neutral-700">
                          <span className="text-neutral-400 font-medium">Dates:</span>
                          <span className="font-semibold">
                            {formatDate(r.startDate)} – {formatDate(r.endDate)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-neutral-700">
                          <span className="text-neutral-400 font-medium">Duration:</span>
                          <span className="font-bold text-[#5D3EBC]">
                            {r.isHalfDay
                              ? r.halfDaySlot === "SECOND_HALF"
                                ? HALF_DAY_SLOT_LABELS.SECOND_HALF
                                : HALF_DAY_SLOT_LABELS.FIRST_HALF
                              : `${r.numberOfDays} ${r.numberOfDays === 1 ? "day" : "days"}`}
                          </span>
                        </div>
                        {r.reason && (
                          <div className="pt-1 border-t border-neutral-200/50">
                            <span className="text-neutral-400 font-medium text-[11px] block">Reason:</span>
                            <p className="text-neutral-700 text-[11px] italic mt-0.5">{r.reason}</p>
                          </div>
                        )}
                        {r.approverNote && (
                          <div className="pt-1 border-t border-neutral-200/50">
                            <span className="text-neutral-400 font-medium text-[11px] block">Reviewer Note:</span>
                            <p className="text-neutral-500 text-[11px] mt-0.5">{r.approverNote}</p>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2 pt-1">
                        <Input
                          placeholder="Optional note for correction..."
                          className="h-8 text-xs w-full"
                          value={notes[r.id] ?? ""}
                          onChange={(e) =>
                            setNotes((prev) => ({
                              ...prev,
                              [r.id]: e.target.value,
                            }))
                          }
                        />

                        {r.status === "PENDING" && (
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
                              className="flex items-center justify-center gap-1 rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
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
                              className="flex items-center justify-center gap-1 rounded-xl bg-rose-600 py-2 text-xs font-bold text-white hover:bg-rose-700 transition-colors disabled:opacity-50"
                            >
                              <X className="h-3.5 w-3.5" />
                              Reject
                            </button>
                          </div>
                        )}

                        {r.status === "APPROVED" && (
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              disabled={respond.isLoading}
                              onClick={() =>
                                respond.mutate({
                                  id: r.id,
                                  action: "REJECT",
                                  approverNote: notes[r.id] || "Reversed to reject",
                                })
                              }
                              className="flex items-center justify-center gap-1 rounded-xl bg-rose-600 py-2 text-xs font-bold text-white hover:bg-rose-700 transition-colors disabled:opacity-50"
                            >
                              <X className="h-3.5 w-3.5" />
                              Change to Reject
                            </button>
                            <button
                              type="button"
                              disabled={respond.isLoading}
                              onClick={() =>
                                respond.mutate({
                                  id: r.id,
                                  action: "RESET_TO_PENDING",
                                  approverNote: null,
                                })
                              }
                              className="flex items-center justify-center gap-1 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-neutral-300 py-2 text-xs font-semibold transition-colors disabled:opacity-50"
                            >
                              <RotateCcw className="h-3 w-3" />
                              Reset
                            </button>
                          </div>
                        )}

                        {r.status === "REJECTED" && (
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              disabled={respond.isLoading}
                              onClick={() =>
                                respond.mutate({
                                  id: r.id,
                                  action: "APPROVE",
                                  approverNote: notes[r.id] || "Reversed to approve",
                                })
                              }
                              className="flex items-center justify-center gap-1 rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                            >
                              <Check className="h-3.5 w-3.5" />
                              Change to Approve
                            </button>
                            <button
                              type="button"
                              disabled={respond.isLoading}
                              onClick={() =>
                                respond.mutate({
                                  id: r.id,
                                  action: "RESET_TO_PENDING",
                                  approverNote: null,
                                })
                              }
                              className="flex items-center justify-center gap-1 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-neutral-300 py-2 text-xs font-semibold transition-colors disabled:opacity-50"
                            >
                              <RotateCcw className="h-3 w-3" />
                              Reset
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
      )}
            </div>
          );
}
