"use client";

import { userFacingErrorMessage } from "@/lib/user-facing-error";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { cn, formatDate } from "@/lib/utils";
import { countWeekdays, HALF_DAY_SLOT_LABELS } from "@realty-smartz/shared";

type HalfDaySlot = keyof typeof HALF_DAY_SLOT_LABELS;

function halfDayLabel(slot: string | null) {
  return slot === "SECOND_HALF" ? HALF_DAY_SLOT_LABELS.SECOND_HALF : HALF_DAY_SLOT_LABELS.FIRST_HALF;
}

const STATUS_VARIANT: Record<
  string,
  "warning" | "success" | "danger" | "secondary"
> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  CANCELLED: "secondary",
};

export default function EmployeeLeavePage() {
  const utils = trpc.useUtils();
  const { data: balances } = trpc.leave.myBalances.useQuery();
  const { data: requests } = trpc.leave.myRequests.useQuery();
  const { data: types } = trpc.leave.types.useQuery();
  const { data: probationStatus } = trpc.leave.myProbationStatus.useQuery();

  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDaySlot, setHalfDaySlot] = useState<HalfDaySlot>("FIRST_HALF");
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  const applyMutation = trpc.leave.apply.useMutation({
    onSuccess: () => {
      setReason("");
      setStartDate("");
      setEndDate("");
      setIsHalfDay(false);
      setShowForm(false);
      setError("");
      utils.leave.myRequests.invalidate();
      utils.leave.myBalances.invalidate();
    },
    onError: (err) => setError(userFacingErrorMessage(err)),
  });

  const isUnpaidLeaveType = (name: string) => {
    const lower = (name || "").toLowerCase();
    return lower.includes("unpaid") || lower.includes("loss of pay") || lower.includes("lop");
  };

  const isOnProbation = Boolean(probationStatus?.isUnderProbation);
  const eligibleTypes = useMemo(() => {
    const list = types ?? [];
    if (!isOnProbation) return list;
    return list.filter((t) => isUnpaidLeaveType(t.name));
  }, [types, isOnProbation]);

  // Auto-select Unpaid Leave for probation staff so they cannot accidentally submit Casual/Sick
  useEffect(() => {
    if (isOnProbation && eligibleTypes.length > 0) {
      if (!leaveTypeId || !eligibleTypes.some((t) => t.id === leaveTypeId)) {
        setLeaveTypeId(eligibleTypes[0].id);
      }
    }
  }, [isOnProbation, eligibleTypes, leaveTypeId]);

  const cancelMutation = trpc.leave.cancel.useMutation({
    onSuccess: () => utils.leave.myRequests.invalidate(),
  });

  const todayIST = useMemo(() => {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(now); // Guaranteed "YYYY-MM-DD"
  }, []);

  const days = useMemo(() => {
    if (!startDate || !endDate) return 0;
    return countWeekdays(new Date(startDate), new Date(endDate));
  }, [startDate, endDate]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!leaveTypeId || !startDate || !endDate || reason.trim().length < 3) {
      setError("Please fill all fields");
      return;
    }
    if (startDate < todayIST || endDate < todayIST) {
      setError("Leave can only be applied for today or upcoming dates.");
      return;
    }
    if (endDate < startDate) {
      setError("End date cannot be earlier than start date.");
      return;
    }
    applyMutation.mutate({
      leaveTypeId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      isHalfDay,
      halfDaySlot: isHalfDay ? halfDaySlot : null,
      reason: reason.trim(),
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-[var(--ink)]">Leave</h1>
        <Button
          size="sm"
          onClick={() => setShowForm((v) => !v)}
          className="bg-[var(--accent)] text-[var(--accent-ink)] btn-chamfer font-semibold px-4 hover:opacity-90 transition-opacity"
        >
          {showForm ? "Close" : "Apply"}
        </Button>
      </div>

      {/* Probation Period Banner */}
      {probationStatus?.isUnderProbation && (
        <div className="rounded-[4px] border border-[var(--line)] bg-[var(--card)] p-4 text-xs text-[var(--ink)] space-y-1.5 shadow-xs">
          <div className="flex items-center gap-2 font-bold text-[var(--warn)]">
            <span className="flex h-2 w-2 rounded-full bg-[var(--warn)] animate-pulse" />
            <span>Probation Period Active ({probationStatus.probationMonths} Months)</span>
          </div>
          <p className="text-[11px] text-[var(--muted)] leading-relaxed">
            You are currently in your probation period (active until{' '}
            <strong className="text-[var(--ink)]">
              {probationStatus.probationEndDate
                ? new Date(probationStatus.probationEndDate).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
                : "completion"}
            </strong>
            ). Per corporate policy, employees under probation are strictly limited to{' '}
            <strong className="underline text-[var(--ink)]">Unpaid Leave (Loss of Pay)</strong>. Paid leave quotas will become available once your probation concludes.
          </p>
        </div>
      )}

      <div className="flex gap-2.5 overflow-x-auto pb-1">
        {balances?.map((b) => {
          const isPaid = !isUnpaidLeaveType(b.leaveType.name);
          const lockedOnProbation = isOnProbation && isPaid;
          const isNegative = (b.remaining ?? 0) < 0;
          return (
            <div
              key={b.id}
              style={{ backgroundColor: "var(--card)", borderColor: "var(--line)", color: "var(--ink)" }}
              className={cn(
                "min-w-[140px] shrink-0 rounded-[4px] border bg-[var(--card)] p-3.5",
                lockedOnProbation && "opacity-65"
              )}
            >
              <div className="flex items-center justify-between gap-1">
                <p className="text-[12px] font-[600] text-[var(--muted)]">{b.leaveType.name}</p>
                {lockedOnProbation && (
                  <span className="rounded px-1.5 py-0.2 text-[9px] font-bold bg-amber-100 text-amber-800">
                    Locked
                  </span>
                )}
              </div>
              <p
                className={cn(
                  "text-[30px] font-[700] leading-tight my-1",
                  lockedOnProbation
                    ? "text-[var(--muted)]"
                    : isNegative
                    ? "text-[var(--danger)]"
                    : "text-[var(--ink)]"
                )}
              >
                {lockedOnProbation ? 0 : b.remaining}
              </p>
              <p className="text-[11px] text-[var(--muted)]">
                {lockedOnProbation ? "Locked during probation" : `of ${b.allotted}`}
              </p>
            </div>
          );
        })}
        {isOnProbation && !balances?.some((b) => isUnpaidLeaveType(b.leaveType.name)) && (
          <div
            style={{ backgroundColor: "var(--card)", borderColor: "var(--line)", color: "var(--ink)" }}
            className="min-w-[160px] shrink-0 rounded-[4px] border bg-[var(--card)] p-3.5"
          >
            <p className="text-[12px] font-[600] text-[var(--muted)]">Unpaid Leave (LOP)</p>
            <p className="text-[16px] font-[700] text-[var(--accent)] my-2">Allowed</p>
            <p className="text-[11px] text-[var(--muted)]">Available on probation</p>
          </div>
        )}
      </div>

      {showForm && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Apply leave</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-3">
              <div className="space-y-1">
                <Label>Type</Label>
                <Select
                  value={leaveTypeId}
                  onChange={(e) => setLeaveTypeId(e.target.value)}
                  required
                >
                  {!isOnProbation && <option value="">Select</option>}
                  {eligibleTypes.map((t) => {
                    const bal = balances?.find((b) => b.leaveTypeId === t.id);
                    return (
                      <option key={t.id} value={t.id}>
                        {t.name}
                        {!isUnpaidLeaveType(t.name) && bal != null ? ` (${bal.remaining} left)` : ""}
                      </option>
                    );
                  })}
                </Select>
                {isOnProbation && (
                  <p className="text-[11px] font-semibold text-[var(--warn)]">
                    Probation active: Only Unpaid Leave (Loss of Pay) is allowed.
                  </p>
                )}
              </div>
              <label className="flex items-center gap-2 rounded-[4px] border border-[var(--line)] bg-[var(--field)] px-3 py-2 text-sm text-[var(--ink)]">
                <input
                  type="checkbox"
                  checked={isHalfDay}
                  onChange={(e) => {
                    setIsHalfDay(e.target.checked);
                    if (e.target.checked) setEndDate(startDate);
                  }}
                />
                <span className="font-medium">Half Day</span>
              </label>
              {isHalfDay && (
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(HALF_DAY_SLOT_LABELS) as HalfDaySlot[]).map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setHalfDaySlot(slot)}
                      className={
                        halfDaySlot === slot
                          ? "rounded-[4px] border border-[var(--accent)] bg-[var(--active)] px-2 py-2 text-xs font-semibold text-[var(--accent)]"
                          : "rounded-[4px] border border-[var(--line)] bg-[var(--field)] px-2 py-2 text-xs font-medium text-[var(--muted)] hover:text-[var(--ink)]"
                      }
                    >
                      {HALF_DAY_SLOT_LABELS[slot]}
                    </button>
                  ))}
                </div>
              )}
              <div className="rounded-[4px] border border-amber-200 bg-amber-50/60 px-3 py-1.5 text-[11px] font-semibold text-amber-800 flex items-center justify-between">
                <span>📅 Today &amp; Upcoming Dates Only</span>
                <span className="text-[10px] text-amber-600 font-normal">Past dates locked</span>
              </div>
              <div className={isHalfDay ? "space-y-1" : "grid grid-cols-2 gap-2"}>
                <div className="space-y-1">
                  <Label>{isHalfDay ? "Date" : "From"}</Label>
                  <Input
                    type="date"
                    min={todayIST}
                    value={startDate}
                    onKeyDown={(e) => e.preventDefault()}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val && val < todayIST) {
                        setError("Past dates are not allowed. Please select today or an upcoming date.");
                        setStartDate(todayIST);
                        if (isHalfDay || (endDate && endDate < todayIST)) {
                          setEndDate(todayIST);
                        }
                        return;
                      }
                      setError("");
                      setStartDate(val);
                      if (isHalfDay || (endDate && val && endDate < val)) {
                        setEndDate(val);
                      }
                    }}
                    required
                  />
                </div>
                {!isHalfDay && (
                  <div className="space-y-1">
                    <Label>To</Label>
                    <Input
                      type="date"
                      min={startDate && startDate > todayIST ? startDate : todayIST}
                      value={endDate}
                      onKeyDown={(e) => e.preventDefault()}
                      onChange={(e) => {
                        const val = e.target.value;
                        const minEnd = startDate && startDate > todayIST ? startDate : todayIST;
                        if (val && val < minEnd) {
                          setError("End date cannot be earlier than start date or today.");
                          setEndDate(minEnd);
                          return;
                        }
                        setError("");
                        setEndDate(val);
                      }}
                      required
                    />
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Working days: {isHalfDay && days ? "0.5" : days || "—"}
              </p>
              <div className="space-y-1">
                <Label>Reason</Label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm text-brand-maroon">{error}</p>}
              <Button
                type="submit"
                className="w-full"
                disabled={applyMutation.isPending}
              >
                {applyMutation.isPending ? "Submitting..." : "Submit"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--ink)]">My requests</h2>
        {requests?.map((r) => {
          const statusSentence = r.status.charAt(0).toUpperCase() + r.status.slice(1).toLowerCase();
          const isApproved = r.status === "APPROVED";
          const isPending = r.status === "PENDING";
          const isRejected = r.status === "REJECTED";

          return (
            <div
              key={r.id}
              style={{ backgroundColor: "var(--card)", borderColor: "var(--line)", color: "var(--ink)" }}
              className="rounded-[4px] border bg-[var(--card)] p-3.5 text-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[15px] font-[600] text-[var(--ink)]">{r.leaveType.name}</p>
                  <p className="text-[13px] text-[var(--muted)] mt-0.5">
                    {r.isHalfDay
                      ? `${formatDate(r.startDate)} · ${halfDayLabel(r.halfDaySlot)}`
                      : `${formatDate(r.startDate)} – ${formatDate(r.endDate)} · ${r.numberOfDays}d`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span
                    className={cn(
                      "inline-block px-2.5 py-0.5 text-xs font-semibold rounded-[2px]",
                      isApproved && "chip-ok",
                      isPending && "chip-warn",
                      isRejected && "chip-danger",
                      !isApproved && !isPending && !isRejected && "bg-[var(--soft)] text-[var(--muted)]"
                    )}
                  >
                    {statusSentence}
                  </span>
                  {(r as any).managerStatus === "APPROVED" && r.status === "PENDING" && (
                    <span className="block text-[10px] font-semibold text-[var(--ok)] mt-1">
                      ✓ Manager Approved (Waiting for HR)
                    </span>
                  )}
                  {(r as any).managerStatus === "PENDING" && (r as any).manager && (
                    <span className="block text-[10px] font-semibold text-[var(--warn)] mt-1">
                      • Waiting for Manager ({(r as any).manager.firstName})
                    </span>
                  )}
                </div>
              </div>
              {r.reason && (
                <p className="mt-2 pt-2 border-t border-[var(--line)]/60 text-[12px] text-[var(--ink)] whitespace-pre-wrap break-words">
                  <span className="text-[var(--muted)] font-medium">Reason: </span>
                  {r.reason}
                </p>
              )}
              {r.approverNote && (
                <p className="mt-1 text-[11px] text-[var(--muted)] italic whitespace-pre-wrap break-words">
                  Note: {r.approverNote}
                </p>
              )}
              {r.status === "PENDING" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2.5 border-[var(--line)] text-[var(--ink)] hover:bg-[var(--soft)]"
                  onClick={() => cancelMutation.mutate({ id: r.id })}
                >
                  Cancel
                </Button>
              )}
            </div>
          );
        })}
        {!requests?.length && (
          <p className="text-sm text-[var(--muted)]">No leave requests yet.</p>
        )}
      </div>
    </div>
  );
}
