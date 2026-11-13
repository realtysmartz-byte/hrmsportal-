"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "@/lib/toast";
import { userFacingErrorMessage } from "@/lib/user-facing-error";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";
import { AlertTriangle, ShieldCheck, Calendar, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface AttendanceRegulariseModalProps {
  open: boolean;
  onClose: () => void;
  employeeId: string;
  employeeName: string;
  employeeCode?: string;
  date: string; // "YYYY-MM-DD"
  currentStatus?: string | null;
  currentCheckIn?: Date | string | null;
  currentCheckOut?: Date | string | null;
  currentHours?: number | null;
  existingNotes?: string | null;
  onSuccess?: () => void;
}

const PRESET_REASONS = [
  "App / Portal login issue prevented check-in",
  "On-site client meeting / outdoor field duty",
  "Technical network glitch during punch",
  "Forgot to punch in / out at scheduled time",
  "Approved full-day attendance by HR/Management",
];

export function AttendanceRegulariseModal({
  open,
  onClose,
  employeeId,
  employeeName,
  employeeCode,
  date,
  currentStatus = "ABSENT",
  onSuccess,
}: AttendanceRegulariseModalProps) {
  const utils = trpc.useUtils();

  // Target status: default to PRESENT (Full Day)
  const [targetStatus, setTargetStatus] = useState<"PRESENT" | "HALF_DAY" | "LATE" | "ABSENT" | "ON_LEAVE">("PRESENT");
  const [totalHours, setTotalHours] = useState<string>("9.0");
  const [checkInTime, setCheckInTime] = useState<string>("10:00");
  const [checkOutTime, setCheckOutTime] = useState<string>("19:00");
  const [reason, setReason] = useState<string>("");
  const [error, setError] = useState<string>("");

  // Lock background screen scroll completely
  useBodyScrollLock(open);

  const regulariseMutation = trpc.attendance.regularise.useMutation({
    onSuccess: (data) => {
      toast("success", data.message || "Attendance regularised successfully");
      utils.attendance.team.invalidate();
      utils.attendance.myMonth.invalidate();
      utils.attendance.forEmployeeMonth.invalidate();
      utils.attendance.today.invalidate();
      utils.employee.profileHub.invalidate();
      onSuccess?.();
      onClose();
    },
    onError: (err) => {
      setError(userFacingErrorMessage(err));
    },
  });

  if (!open) return null;

  const handleStatusChange = (newStatus: "PRESENT" | "HALF_DAY" | "LATE" | "ABSENT" | "ON_LEAVE") => {
    setTargetStatus(newStatus);
    if (newStatus === "PRESENT" || newStatus === "LATE") {
      setTotalHours("9.0");
      setCheckInTime("10:00");
      setCheckOutTime("19:00");
    } else if (newStatus === "HALF_DAY") {
      setTotalHours("4.5");
      setCheckInTime("10:00");
      setCheckOutTime("14:30");
    } else {
      setTotalHours("0.0");
      setCheckInTime("");
      setCheckOutTime("");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!reason.trim()) {
      setError("Please provide or select a reason for regularisation.");
      return;
    }

    const parsedHours = parseFloat(totalHours);
    if (isNaN(parsedHours) || parsedHours < 0 || parsedHours > 24) {
      setError("Please enter a valid number of working hours between 0 and 24.");
      return;
    }

    regulariseMutation.mutate({
      employeeId,
      date,
      status: targetStatus,
      totalHours: parsedHours,
      checkInTime: checkInTime || null,
      checkOutTime: checkOutTime || null,
      reason: reason.trim(),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto select-none"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100vh-3.5rem)] flex flex-col rounded-2xl bg-white shadow-2xl border border-neutral-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150 select-text"
        onClick={(e) => e.stopPropagation()}
      >
          {/* Pinned Header */}
          <div className="shrink-0 flex items-center justify-between px-5 py-3.5 border-b border-neutral-100 bg-neutral-50/90">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#5D3EBC]/10 text-[#5D3EBC]">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                  <h2 className="text-sm sm:text-base font-bold text-neutral-900 leading-tight">
                    Regularise Attendance
                  </h2>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      Admin correction for login issues, missed punches, or field duty
                    </p>
                  </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {error && (
                <div className="shrink-0 mx-5 mt-3 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
        )}

                          <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
                            {/* Scrollable Form Body */}
                            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4 overscroll-contain">
                              {/* Employee & Date Summary Banner */}
                              <div className="rounded-xl bg-[#F8F7FD] border border-[#ECE6F8] p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-[#6D28D9] to-[#8B5CF6] text-white flex items-center justify-center font-bold text-xs shrink-0">
                                      {employeeName.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-bold text-xs text-neutral-900 truncate">
                                        {employeeName}
                                      </p>
                                      <p className="text-[10px] text-neutral-500">
                                        {employeeCode || "Employee"}
                                      </p>
                                    </div>
                                  </div>

                                    <div className="text-right">
                                      <span className="text-[10px] uppercase font-bold text-neutral-400 block">Date</span>
                                      <span className="font-bold text-xs text-neutral-800 flex items-center gap-1">
                                        <Calendar className="h-3 w-3 text-[#5D3EBC]" />
                                        {date}
                                      </span>
                                    </div>
                                  </div>

                                      <div className="pt-2 border-t border-[#ECE6F8] flex items-center justify-between text-xs">
                                        <span className="text-neutral-500 font-medium">Recorded Status:</span>
                                        <span
                                          className={cn(
                                            "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                                            currentStatus === "PRESENT"
                                              ? "bg-emerald-100 text-emerald-800"
                                              : currentStatus === "HALF_DAY"
                                                ? "bg-amber-100 text-amber-800"
                                                : currentStatus === "LATE"
                                                  ? "bg-orange-100 text-orange-800"
                                                  : currentStatus === "ON_LEAVE"
                                                    ? "bg-blue-100 text-blue-800"
                                                    : "bg-rose-100 text-rose-800"
                                          )}
                                        >
                                          {currentStatus || "ABSENT"}
                                        </span>
                                      </div>
                                  </div>

                                    {/* Target Status Selection */}
                                    <div>
                                      <label className="block text-xs font-bold text-neutral-800 mb-2">
                                        Convert To Status <span className="text-rose-500">*</span>
                                      </label>
                                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        <button
                                          type="button"
                                          onClick={() => handleStatusChange("PRESENT")}
                                          className={cn(
                                            "px-3 py-2 text-xs font-bold rounded-xl border text-center transition-all",
                                            targetStatus === "PRESENT"
                                              ? "bg-[#5D3EBC] text-white border-[#5D3EBC] shadow-sm"
                                              : "bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50"
                                          )}
                                        >
                                          Full Day (Present)
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleStatusChange("HALF_DAY")}
                                          className={cn(
                                            "px-3 py-2 text-xs font-bold rounded-xl border text-center transition-all",
                                            targetStatus === "HALF_DAY"
                                              ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                                              : "bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50"
                                          )}
                                        >
                                          Half Day
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleStatusChange("LATE")}
                                          className={cn(
                                            "px-3 py-2 text-xs font-bold rounded-xl border text-center transition-all",
                                            targetStatus === "LATE"
                                              ? "bg-orange-500 text-white border-orange-500 shadow-sm"
                                              : "bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50"
                                          )}
                                        >
                                          Late Mark
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleStatusChange("ON_LEAVE")}
                                          className={cn(
                                            "px-3 py-2 text-xs font-bold rounded-xl border text-center transition-all",
                                            targetStatus === "ON_LEAVE"
                                              ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                                              : "bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50"
                                          )}
                                        >
                                          On Leave
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleStatusChange("ABSENT")}
                                          className={cn(
                                            "px-3 py-2 text-xs font-bold rounded-xl border text-center transition-all",
                                            targetStatus === "ABSENT"
                                              ? "bg-rose-600 text-white border-rose-600 shadow-sm"
                                              : "bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50"
                                          )}
                                        >
                                          Absent
                                        </button>
                                      </div>
                                    </div>

                                          {/* Time Adjustments */ }
            {
                                          targetStatus !== "ABSENT" && targetStatus !== "ON_LEAVE" && (
                                            <div className="grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-neutral-50 border border-neutral-200 text-xs">
                                              <div>
                                                <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                                                  Punch In
                                                </label>
                                                <input
                                                  type="time"
                                                  value={checkInTime}
                                                  onChange={(e) => setCheckInTime(e.target.value)}
                                                  className="w-full text-xs p-1.5 rounded-lg border border-neutral-300 bg-white"
                                                />
                                              </div>
                                              <div>
                                                <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                                                  Punch Out
                                                </label>
                                                <input
                                                  type="time"
                                                  value={checkOutTime}
                                                  onChange={(e) => setCheckOutTime(e.target.value)}
                                                  className="w-full text-xs p-1.5 rounded-lg border border-neutral-300 bg-white"
                                                />
                                              </div>
                                              <div>
                                                <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                                                  Gross Hours
                                                </label>
                                                <input
                                                  type="number"
                                                  step="0.5"
                                                  min="0"
                                                  max="24"
                                                  value={totalHours}
                                                  onChange={(e) => setTotalHours(e.target.value)}
                                                  className="w-full text-xs p-1.5 rounded-lg border border-neutral-300 bg-white font-bold"
                                                />
                                              </div>
                                            </div>
                                          )
                                        }

                                        {/* Reason for Regularisation */ }
                                        <div className="space-y-2">
                                          <label className="block text-xs font-bold text-neutral-800">
                                            Reason for Regularisation <span className="text-rose-500">*</span>
                                          </label>

                                          {/* Quick Presets */}
                                          <div className="flex flex-wrap gap-1.5 pb-1">
                                            {PRESET_REASONS.map((preset) => (
                                              <button
                                                key={preset}
                                                type="button"
                                                onClick={() => setReason(preset)}
                                                className={cn(
                      "text-[10px] font-medium px-2 py-0.5 rounded-md border transition-all text-left",
                                                  reason === preset
                                                    ? "bg-[#5D3EBC]/10 border-[#5D3EBC] text-[#5D3EBC] font-semibold"
                                                    : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                                                )}
                                              >
                                                {preset}
                                              </button>
                ))}
                                              </div>

                                              <textarea
                                                rows={2}
                                                placeholder="e.g. Employee experienced app check-in failure, regularised to Full Day as per field confirmation."
                                                value={reason}
                                                onChange={(e) => setReason(e.target.value)}
                                                className="w-full text-xs p-2.5 rounded-md border border-neutral-300 bg-white focus:outline-none focus:ring-1 focus:ring-[#5D3EBC]"
                                                required
                                              />
                                            </div>
          </div>

          {/* Pinned Footer */}
          <div className="shrink-0 px-5 py-3.5 border-t border-neutral-200 bg-neutral-50/90 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={regulariseMutation.isLoading}
              className="px-3.5 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 rounded-lg border border-neutral-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={regulariseMutation.isLoading}
              className="px-4 py-2 text-xs font-bold text-white bg-[#5D3EBC] hover:bg-[#4C32A0] rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {regulariseMutation.isLoading ? "Saving..." : "Apply Regularisation"}
            </button>
          </div>
        </form>
      </div>
                                  </div>
                                  );
}
