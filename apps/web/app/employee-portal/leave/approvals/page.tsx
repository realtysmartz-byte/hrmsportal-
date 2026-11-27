"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  CalendarDays,
  Check,
  X,
  ChevronLeft,
  Clock,
  User,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RotateCw,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type StatusTab = "PENDING" | "APPROVED" | "REJECTED" | "ALL";

export default function ManagerLeaveApprovalsPage() {
  const { data: session } = useSession();
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<StatusTab>("PENDING");
  const [actionNotes, setActionNotes] = useState<Record<string, string>>({});
  const [actioningId, setActioningId] = useState<string | null>(null);

  const { data: approvals = [], isLoading, refetch } = trpc.leave.listApprovals.useQuery(
    { status: activeTab },
    { refetchOnWindowFocus: true }
  );

  const respondMutation = trpc.leave.respond.useMutation({
    onSuccess: () => {
      void utils.leave.listApprovals.invalidate();
      void utils.leave.pendingApprovals.invalidate();
      void utils.leave.myTeamPendingCount.invalidate();
      void utils.employee.notifications.invalidate();
      setActioningId(null);
    },
    onError: (err) => {
      alert(err.message || "Failed to process leave action");
      setActioningId(null);
    },
  });

  const handleAction = async (id: string, action: "APPROVE" | "REJECT") => {
    setActioningId(id);
    const note = actionNotes[id] || "";
    await respondMutation.mutateAsync({
      id,
      action,
      approverNote: note.trim() || undefined,
    });
  };

  return (
    <div className="space-y-4 pb-12 font-sans">
      {/* Header bar with Back button */}
      <div className="flex items-center gap-3 border-b border-[var(--line)] pb-3">
        <Link
          href="/employee-portal/dashboard"
          className="flex h-9 w-9 items-center justify-center rounded-[4px] border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] hover:bg-[var(--soft)] transition-colors"
          title="Back to Dashboard"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={1.8} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold tracking-tight text-[var(--ink)] truncate">
            Team Leave Approvals
          </h1>
          <p className="text-[11px] text-[var(--muted)]">
            Review and action leave applications submitted by your team
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          className="flex h-9 w-9 items-center justify-center rounded-[4px] border border-[var(--line)] bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
          title="Refresh"
        >
          <RotateCw className="h-4 w-4" strokeWidth={1.8} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 border-b border-[var(--line)] pb-2 overflow-x-auto">
        {(["PENDING", "APPROVED", "REJECTED", "ALL"] as StatusTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-3 py-1.5 rounded-[4px] text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer",
              activeTab === tab
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--soft)] text-[var(--muted)] hover:text-[var(--ink)]"
            )}
          >
            {tab === "PENDING"
              ? "Pending Action"
              : tab === "APPROVED"
                ? "Approved"
                : tab === "REJECTED"
                  ? "Rejected"
                  : "All Records"}
          </button>
        ))}
      </div>

      {/* Approvals List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-32 rounded-[4px] border border-[var(--line)] bg-[var(--soft)]/50 animate-pulse" />
            ))}
          </div>
        ) : approvals.length === 0 ? (
          <div className="rounded-[4px] border border-[var(--line)] bg-[var(--bg)] p-8 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-[var(--ok)]/60 mb-2" strokeWidth={1.5} />
            <p className="text-sm font-bold text-[var(--ink)]">No leave applications</p>
            <p className="text-xs text-[var(--muted)] mt-1">
              {activeTab === "PENDING"
                ? "There are no pending leave requests awaiting your action."
                : "No matching records found for this view."}
            </p>
          </div>
        ) : (
          approvals.map((req: any) => {
            const isManagerPending = req.managerStatus === "PENDING" && req.status === "PENDING";
            const isManagerApproved = req.managerStatus === "APPROVED";
            const isHRApproved = req.status === "APPROVED";
            const isRejected = req.status === "REJECTED" || req.managerStatus === "REJECTED";

            return (
              <div
                key={req.id}
                className="rounded-[4px] border border-[var(--line)] bg-[var(--bg)] p-4 shadow-sm space-y-3"
              >
                {/* Employee Info Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-10 w-10 flex-none rounded-[4px] bg-[var(--accent)] text-white flex items-center justify-center font-bold text-sm overflow-hidden select-none">
                      {req.employee?.profilePhotoUrl ? (
                        <img
                          src={req.employee.profilePhotoUrl}
                          alt={req.employee.firstName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span>
                          {(req.employee?.firstName?.[0] ?? "").toUpperCase()}
                          {(req.employee?.lastName?.[0] ?? "").toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[var(--ink)] truncate">
                        {req.employee?.firstName} {req.employee?.lastName}
                      </p>
                      <p className="text-[11px] text-[var(--muted)] truncate">
                        {req.employee?.department?.name || "General"} • {req.employee?.employeeCode}
                      </p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-[2px] text-[10px] font-bold border shrink-0",
                      isHRApproved
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : isManagerApproved
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : isRejected
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-amber-50 text-amber-800 border-amber-200"
                    )}
                  >
                    {isHRApproved
                      ? "HR Confirmed"
                      : isManagerApproved
                        ? "Manager Approved (Pending HR)"
                        : isRejected
                          ? "Rejected"
                          : "Needs Your Action"}
                  </span>
                </div>

                {/* Leave Details */}
                <div className="rounded-[4px] bg-[var(--soft)]/60 border border-[var(--line)] p-2.5 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[var(--ink)]">
                      {req.leaveType?.name}
                    </span>
                    <span className="font-bold text-[var(--accent)]">
                      {req.numberOfDays} {req.numberOfDays === 1 ? "day" : "days"}
                      {req.isHalfDay && ` (${req.halfDaySlot === "SECOND_HALF" ? "2nd Half" : "1st Half"})`}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
                    <CalendarDays className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
                    <span>
                      {new Date(req.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      {" → "}
                      {new Date(req.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>

                  {req.reason && (
                      <p className="text-[11px] text-[var(--ink)] pt-1 border-t border-[var(--line)]/60 whitespace-pre-wrap break-words">
                        <strong className="text-[var(--muted)] font-normal">Reason: </strong>
                        {req.reason}
                      </p>
                  )}
                    </div>

                {/* Actions if pending manager approval */}
                  {isManagerPending && (
                    <div className="space-y-2 pt-1">
                      <input
                        type="text"
                        placeholder="Add an optional comment/note..."
                        value={actionNotes[req.id] || ""}
                        onChange={(e) =>
                          setActionNotes((prev) => ({ ...prev, [req.id]: e.target.value }))
                        }
                        className="w-full h-8 px-2.5 rounded-[4px] border border-[var(--line)] bg-[var(--bg)] text-xs text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)]"
                      />

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={actioningId === req.id}
                          onClick={() => handleAction(req.id, "APPROVE")}
                          className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-[4px] bg-[var(--ok)] text-white text-xs font-semibold hover:brightness-110 transition-all disabled:opacity-50 cursor-pointer"
                        >
                          <Check className="h-4 w-4" strokeWidth={2} />
                          <span>Approve & Forward to HR</span>
                        </button>

                        <button
                          type="button"
                          disabled={actioningId === req.id}
                          onClick={() => handleAction(req.id, "REJECT")}
                          className="px-4 flex items-center justify-center gap-1.5 h-9 rounded-[4px] border border-[var(--danger)] text-[var(--danger)] text-xs font-semibold hover:bg-rose-50 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <X className="h-4 w-4" strokeWidth={2} />
                          <span>Reject</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                );
          })
        )}
              </div>
    </div>
      );
}
