"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "@/lib/toast";
import { userFacingErrorMessage } from "@/lib/user-facing-error";
import { Clock, CheckCircle2, AlertTriangle, ShieldCheck, User, Calendar, Sparkles, X } from "lucide-react";
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
  currentCheckIn,
  currentCheckOut,
  currentHours,
  existingNotes,
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

  // Bulletproof freeze of background page while modal is open (handles iOS, Android, and Desktop)
  useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY;
    const originalBodyPosition = document.body.style.position;
    const originalBodyTop = document.body.style.top;
    const originalBodyWidth = document.body.style.width;
    const originalBodyOverflow = document.body.style.overflow;
    const originalDocOverflow = document.documentElement.style.overflow;

    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.position = originalBodyPosition;
      document.body.style.top = originalBodyTop;
      document.body.style.width = originalBodyWidth;
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalDocOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overscroll-none select-none"
      onClick={onClose}
      onWheel={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
        }
      }}
      onTouchMove={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
        }
      }}
    >
      <div
        className="w-full max-w-md max-h-[90vh] overflow-y-auto overscroll-contain select-text rounded-2xl bg-white p-5 shadow-2xl border border-neutral-200 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#5D3EBC]/10 text-[#5D3EBC]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900 leading-tight">
                Regularise Attendance
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Admin correction for login issues, missed punches, or field duty
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mt-3 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-3">
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

            <div className="pt-1.5 border-t border-purple-100/60 flex items-center justify-between text-xs">
              <span className="text-[11px] text-neutral-500 font-medium">Recorded Status:</span>
              <span className={cn(
                "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                currentStatus === "PRESENT" && "bg-emerald-100 text-emerald-800",
                currentStatus === "HALF_DAY" && "bg-amber-100 text-amber-800",
                currentStatus === "LATE" && "bg-orange-100 text-orange-800",
                currentStatus === "ABSENT" && "bg-rose-100 text-rose-800",
                !currentStatus && "bg-neutral-100 text-neutral-600"
              )}>
                {currentStatus || "Not Checked In"}
              </span>
            </div>
          </div>

          {/* Target Status Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-800 block">
              Convert To Status <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: "PRESENT", label: "Full Day (Present)" },
                { id: "HALF_DAY", label: "Half Day" },
                { id: "LATE", label: "Late Mark" },
                { id: "ON_LEAVE", label: "On Leave" },
                { id: "ABSENT", label: "Absent" },
              ].map((s) => {
                const isSelected = targetStatus === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleStatusChange(s.id as any)}
                    className={cn(
                      "py-2 px-1 text-center rounded-lg text-xs font-bold transition-all border",
                      isSelected
                        ? "bg-[#5D3EBC] text-white border-[#5D3EBC] shadow-xs"
                        : "bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50"
                    )}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Timings and Hours */}
          {targetStatus !== "ABSENT" && targetStatus !== "ON_LEAVE" && (
            <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-neutral-50 border border-neutral-100">
              <div>
                <label className="text-[10px] uppercase font-bold text-neutral-500 block mb-1">
                  Punch In
                </label>
                <input
                  type="time"
                  value={checkInTime}
                  onChange={(e) => setCheckInTime(e.target.value)}
                  className="w-full h-8 text-xs font-semibold px-2 rounded-md border border-neutral-300 bg-white"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-neutral-500 block mb-1">
                  Punch Out
                </label>
                <input
                  type="time"
                  value={checkOutTime}
                  onChange={(e) => setCheckOutTime(e.target.value)}
                  className="w-full h-8 text-xs font-semibold px-2 rounded-md border border-neutral-300 bg-white"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-neutral-500 block mb-1">
                  Gross Hours
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="24"
                  value={totalHours}
                  onChange={(e) => setTotalHours(e.target.value)}
                  className="w-full h-8 text-xs font-bold px-2 text-center rounded-md border border-neutral-300 bg-white"
                />
              </div>
            </div>
          )}

          {/* Reason for Regularisation */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-neutral-800">
                Reason / Remarks <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] text-neutral-400">Recorded in audit history</span>
            </div>

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

          <div className="pt-3 border-t border-neutral-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={regulariseMutation.isLoading}
              className="px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 rounded-lg border border-neutral-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={regulariseMutation.isLoading}
              className="px-4 py-1.5 text-xs font-bold text-white bg-[#5D3EBC] hover:bg-[#4C32A0] rounded-lg shadow-sm"
            >
              {regulariseMutation.isLoading ? "Saving..." : "Apply Regularisation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
