"use client";

import { FormEvent, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { formatDate } from "@/lib/utils";
import { countWeekdays } from "@realty-smartz/shared";

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

  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  const applyMutation = trpc.leave.apply.useMutation({
    onSuccess: () => {
      setReason("");
      setStartDate("");
      setEndDate("");
      setShowForm(false);
      setError("");
      utils.leave.myRequests.invalidate();
      utils.leave.myBalances.invalidate();
    },
    onError: (err) => setError(err.message),
  });

  const cancelMutation = trpc.leave.cancel.useMutation({
    onSuccess: () => utils.leave.myRequests.invalidate(),
  });

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
    applyMutation.mutate({
      leaveTypeId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      reason: reason.trim(),
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Leave</h1>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Close" : "Apply"}
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {balances?.map((b) => (
          <div
            key={b.id}
            className="min-w-[120px] shrink-0 rounded-xl border bg-white p-3"
          >
            <p className="text-[10px] text-muted-foreground">{b.leaveType.name}</p>
            <p className="text-xl font-bold text-brand-teal">{b.remaining}</p>
            <p className="text-[10px] text-muted-foreground">
              of {b.allotted}
            </p>
          </div>
        ))}
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
                  <option value="">Select</option>
                  {(types ?? []).map((t) => {
                    const bal = balances?.find((b) => b.leaveTypeId === t.id);
                    return (
                      <option key={t.id} value={t.id}>
                        {t.name}
                        {bal != null ? ` (${bal.remaining} left)` : ""}
                      </option>
                    );
                  })}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>From</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>To</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Working days: {days || "—"}
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
                disabled={applyMutation.isLoading}
              >
                Submit
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">My requests</h2>
        {requests?.map((r) => (
          <div key={r.id} className="rounded-xl border bg-white p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{r.leaveType.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(r.startDate)} – {formatDate(r.endDate)} ·{" "}
                  {r.numberOfDays}d
                </p>
              </div>
              <Badge variant={STATUS_VARIANT[r.status] ?? "secondary"}>
                {r.status}
              </Badge>
            </div>
            {r.status === "PENDING" && (
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => cancelMutation.mutate({ id: r.id })}
              >
                Cancel
              </Button>
            )}
          </div>
        ))}
        {!requests?.length && (
          <p className="text-sm text-muted-foreground">No leave requests yet.</p>
        )}
      </div>
    </div>
  );
}
