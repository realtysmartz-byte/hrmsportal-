"use client";

import { userFacingErrorMessage } from "@/lib/user-facing-error";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Clock,
  Calendar,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  LogIn,
  LogOut,
  RotateCw,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Filter,
  Navigation,
  ShieldCheck,
  Building,
  User,
  Receipt,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  acquirePunchFix,
  getServerAdjustedFixTimestamp,
  geolocationErrorMessage,
  setServerTimeReference,
  startPunchLocationPrewarm,
  stopPunchLocationPrewarm,
} from "@/lib/geolocation";
import { subscribeToLocationReminders } from "@/lib/push";
import {
  getNativeMockLocationFlag,
  startNativeDutyTracking,
  stopNativeDutyTracking,
} from "@/lib/native-duty-tracking";
import { notifyClockIn, notifyClockOut } from "@/lib/client-notifications";
import { toast } from "@/lib/toast";
import { TRPCClientError } from "@trpc/client";
import {
  formatDateIST,
  formatTimeIST,
  getISTDateString,
  getISTDateParts,
  canManageEmployees,
} from "@realty-smartz/shared";
import type { Role } from "@realty-smartz/shared";
import { KekaMapViewModal } from "@/components/KekaMapViewModal";
import { AttendanceRegulariseModal } from "@/components/AttendanceRegulariseModal";
import { PunchList } from "@/components/PunchList";
import { Button } from "@/components/ui/button";

function formatHoursMinutes(hDecimal: number) {
  if (isNaN(hDecimal) || hDecimal <= 0) return "0h 00m";
  const totalMinutes = Math.round(hDecimal * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

interface KekaAttendancePanelProps {
  targetEmployeeId?: string; // If admin viewing an employee, otherwise current logged in user
  employeeName?: string;
  designation?: string;
  department?: string;
  employeeCode?: string;
  workLocationName?: string | null;
  workLocationLat?: number | null;
  workLocationLng?: number | null;
  hideHeaderBanner?: boolean;
}

export function KekaAttendancePanel({
  targetEmployeeId,
  employeeName: propName,
  designation: propDesignation,
  department: propDepartment,
  employeeCode: propCode,
  workLocationName: propSiteName,
  hideHeaderBanner = false,
}: KekaAttendancePanelProps) {
  const { data: session } = useSession();
  const utils = trpc.useUtils();

  const now = new Date();
  const istParts = useMemo(() => getISTDateParts(now), [now]);
  const todayISTStr = useMemo(() => getISTDateString(now), [now]);
  const currentMonthNum = istParts.month;
  const currentYearNum = istParts.year;

  // Monthly switcher state (Defaults to current calendar month)
  const [selectedMonth, setSelectedMonth] = useState(currentMonthNum);
  const [selectedYear, setSelectedYear] = useState(currentYearNum);

  const isCurrentMonth = selectedYear === currentYearNum && selectedMonth === currentMonthNum;

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (isCurrentMonth) return;
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const monthLabel = useMemo(() => {
    const d = new Date(Date.UTC(selectedYear, selectedMonth - 1, 1));
    return d.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  }, [selectedYear, selectedMonth]);

  // Calendar month options for quick pill filter in table
  const availablePeriods = useMemo(() => {
    const list: { key: string; label: string; year: number; month: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(Date.UTC(currentYearNum, currentMonthNum - 1 - i, 1));
      const mNum = d.getUTCMonth() + 1;
      const yNum = d.getUTCFullYear();
      const mLabel = d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }).toUpperCase();
      list.push({ key: `${mLabel}_${yNum}`, label: mLabel, year: yNum, month: mNum });
    }
    return list;
  }, [currentYearNum, currentMonthNum]);

  // Active tab in Logs & Records
  const [activeTab, setActiveTab] = useState<"log" | "shifts">("log");

  // State for Keka Map View Modal & Regularise Modal
  const [mapModalDate, setMapModalDate] = useState<string | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const [regulariseTarget, setRegulariseTarget] = useState<{
    employeeId: string;
    employeeName: string;
    employeeCode?: string;
    date: string;
    currentStatus?: string | null;
    currentCheckIn?: Date | string | null;
    currentCheckOut?: Date | string | null;
    currentHours?: number | null;
    existingNotes?: string | null;
  } | null>(null);

  const role = (session?.user?.role ?? "EMPLOYEE") as Role;
  const canManage = canManageEmployees(role);

  const isTargetMode = Boolean(
    targetEmployeeId && targetEmployeeId !== session?.user?.id
  );

  // Queries
  const { data: currentUserWorkLoc } = trpc.attendance.myWorkLocation.useQuery(undefined, {
    enabled: !isTargetMode,
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (currentUserWorkLoc?.serverTime) {
      setServerTimeReference(currentUserWorkLoc.serverTime);
    }
  }, [currentUserWorkLoc?.serverTime]);

  // Fetch calendar month data
  const { data: targetMonthData, isLoading: isTargetMonthLoading } =
    trpc.attendance.forEmployeeMonth.useQuery(
      {
        employeeId: targetEmployeeId ?? "",
        year: selectedYear,
        month: selectedMonth,
      },
      { enabled: isTargetMode, staleTime: 60_000 }
    );

  const { data: selfMonthData, isLoading: isSelfMonthLoading } =
    trpc.attendance.myMonth.useQuery(
      {
        year: selectedYear,
        month: selectedMonth,
      },
      { enabled: !isTargetMode, staleTime: 60_000 }
    );

  const monthData = isTargetMode ? targetMonthData : selfMonthData;
  const isMonthLoading = isTargetMode ? isTargetMonthLoading : isSelfMonthLoading;

  const { data: selfTodayAttendance } = trpc.attendance.today.useQuery(undefined, {
    enabled: !isTargetMode,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchInterval: (data) => {
      const recentlyCreated =
        data?.createdAt != null &&
        Date.now() - new Date(data.createdAt).getTime() <= 30_000;
      const resolvingAddress =
        recentlyCreated &&
        ((data.checkInLat != null && !data.checkInAddress) ||
          (data.checkOutLat != null && !data.checkOutAddress));
      if (resolvingAddress) return 1_500;
      const onDuty = Boolean(data?.checkInTime && !data?.checkOutTime);
      return onDuty && getISTDateParts(new Date()).hour >= 19 ? 60_000 : false;
    },
  });

  const targetTodayAttendance = useMemo(() => {
    if (!isTargetMode || !targetMonthData?.logs) return null;
    return (
      targetMonthData.logs.find((l) => {
        const dStr =
          l.date instanceof Date
            ? l.date.toISOString().slice(0, 10)
            : String(l.date).slice(0, 10);
        return dStr === todayISTStr;
      }) ?? null
    );
  }, [isTargetMode, targetMonthData?.logs, todayISTStr]);

  const todayAttendance = isTargetMode ? targetTodayAttendance : selfTodayAttendance;

  const { data: selfProfile } = trpc.employee.myIdCard.useQuery(undefined, {
    enabled: !isTargetMode && !propName,
    staleTime: 10 * 60_000,
  });

  const displayName =
    propName ??
    (selfProfile ? `${selfProfile.firstName} ${selfProfile.lastName}` : session?.user?.name ?? "");

  // Check in/out state
  const [busy, setBusy] = useState(false);
  const [punchPhase, setPunchPhase] = useState<"idle" | "locating" | "saving">("idle");
  const [punchError, setPunchError] = useState("");

  useEffect(() => {
    if (isTargetMode) return;
    startPunchLocationPrewarm();
    return () => stopPunchLocationPrewarm();
  }, [isTargetMode]);

  const checkInMutation = trpc.attendance.checkIn.useMutation({
    onSuccess: () => {
      void utils.attendance.today.invalidate();
      void utils.attendance.myMonth.invalidate();
      void utils.attendance.myRecentWeek.invalidate();
      if (targetEmployeeId) {
        void utils.attendance.forEmployeeMonth.invalidate({ employeeId: targetEmployeeId });
      }
      setPunchError("");
    },
    onError: (err) => {
      setPunchError(userFacingErrorMessage(err));
    },
  });

  const savePush = trpc.attendance.savePushSubscription.useMutation();

  const checkOutMutation = trpc.attendance.checkOut.useMutation({
    onSuccess: () => {
      void utils.attendance.today.invalidate();
      void utils.attendance.myMonth.invalidate();
      void utils.attendance.myRecentWeek.invalidate();
      if (targetEmployeeId) {
        void utils.attendance.forEmployeeMonth.invalidate({ employeeId: targetEmployeeId });
      }
      setPunchError("");
    },
    onError: (err) => {
      setPunchError(userFacingErrorMessage(err));
    },
  });

  const isOnDuty = Boolean(
    todayAttendance?.checkInTime && !todayAttendance?.checkOutTime
  );
  const hasCompletedSession = Boolean(
    todayAttendance?.checkInTime && todayAttendance?.checkOutTime
  );

  const displaySiteName = isTargetMode
    ? propSiteName || "Realty Smartz Pvt Ltd"
    : currentUserWorkLoc?.sites && currentUserWorkLoc.sites.length > 1
      ? `Office or ${currentUserWorkLoc.assigned?.name ?? "assigned site"}`
      : currentUserWorkLoc?.name ?? "Realty Smartz Pvt Ltd";

  async function handlePunch(mode: "in" | "out") {
    if (busy) return;
    if (mode === "in") void subscribeToLocationReminders(savePush.mutateAsync).catch(() => { });
    setPunchError("");
    setBusy(true);
    setPunchPhase("locating");

    try {
      const fix = await acquirePunchFix();
      const lat = fix.lat;
      const lng = fix.lng;
      const isMockLocation = await getNativeMockLocationFlag(fix);
      setPunchPhase("saving");
      const payload = {
        lat,
        lng,
        address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        accuracyM: fix.accuracy,
        fixTimestamp: getServerAdjustedFixTimestamp(fix.timestamp),
        isMockLocation,
      };

      if (mode === "in") {
        await checkInMutation.mutateAsync(payload);
        const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        void startNativeDutyTracking();
        void notifyClockIn({
          employeeName: session?.user?.name || undefined,
          timeStr,
          locationName: "Realty Smartz Pvt Ltd",
        });
      } else {
        await checkOutMutation.mutateAsync(payload);
        const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        void stopNativeDutyTracking();
        void notifyClockOut({
          employeeName: session?.user?.name || undefined,
          timeStr,
        });
      }
    } catch (err: unknown) {
      const message = geolocationErrorMessage(err);
      setPunchError(message);
      if (!(err instanceof TRPCClientError)) toast("error", message);
    } finally {
      setBusy(false);
      setPunchPhase("idle");
    }
  }

  // Attendance Records for table (Sorted by date desc)
  const logs = useMemo(() => {
    const list = monthData?.logs ?? [];
    return [...list].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [monthData?.logs]);

  // Calendar Month Stats calculation
  const stats = useMemo(() => {
    const totalDays = logs.length;
    const presentCount = logs.filter((l) => l.status === "PRESENT").length;
    const lateCount = logs.filter((l) => l.status === "LATE").length;
    const halfDayCount = logs.filter((l) => l.status === "HALF_DAY").length;
    const onLeaveCount = logs.filter((l) => l.status === "ON_LEAVE").length;
    const absentCount = logs.filter((l) => l.status === "ABSENT").length;
    const totalHours = Math.round(
      logs.reduce((acc, l) => acc + (l.totalHours || 0), 0) * 10
    ) / 10;
    const avgDailyHours = presentCount > 0 ? (totalHours / presentCount).toFixed(1) : "0.0";

    // Punctuality & Compensation Deduction calculation:
    // • 3 lates (>10:30 AM) = 0.5 day cut
    // • Half Day (>11:00 AM) = 0.5 day cut
    // • Absence = 1.0 day cut
    const lateCutDays = Math.floor(lateCount / 3) * 0.5;
    const halfDayCutDays = halfDayCount * 0.5;
    const absentCutDays = absentCount * 1.0;
    const totalDeductionDays = lateCutDays + halfDayCutDays + absentCutDays;
    const latesToNextCut = 3 - (lateCount % 3);

    return {
      totalDays,
      presentCount,
      lateCount,
      halfDayCount,
      onLeaveCount,
      absentCount,
      totalHours,
      avgDailyHours,
      lateCutDays,
      halfDayCutDays,
      absentCutDays,
      totalDeductionDays,
      latesToNextCut,
    };
  }, [logs]);

  // Initials for avatar
  const initials = useMemo(() => {
    const parts = displayName.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return displayName.slice(0, 2).toUpperCase() || "HA";
  }, [displayName]);

  return (
    <div className="w-full max-w-full space-y-6 text-[var(--ink)]">
      {/* 1. Profile & Workplace Cards */}
      {!hideHeaderBanner && (
        <div className="space-y-3">
          {/* User Info Bar */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[4px] bg-[#2B2FD1] text-white flex items-center justify-center font-bold text-sm shrink-0 select-none">
              {initials}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-bold text-[var(--ink)]">{displayName}</span>
              <span className="inline-flex items-center rounded-full bg-[#E8F8F0] px-2.5 py-0.5 text-[10px] font-semibold text-[#1FA36A] border border-[#1FA36A]/20">
                Full time
              </span>
            </div>
          </div>

          {/* Workplace Card */}
          <div className="border border-[var(--line)] rounded-[4px] p-3.5 bg-[var(--card)] flex items-center gap-3">
            <MapPin className="w-5 h-5 text-[#2B2FD1] shrink-0" />
            <div>
              <span className="text-[11px] text-[var(--muted)] block">Workplace</span>
              <span className="text-[13px] font-semibold text-[var(--ink)] block">{displaySiteName}</span>
            </div>
          </div>
        </div>
      )}

      {/* 2. Attendance Section with Month Switcher */}
      <div className={cn("space-y-3 transition-opacity duration-150", isMonthLoading && "opacity-60")}>
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-bold text-[var(--ink)]">Attendance</h2>

          {/* Month Switcher: [ ‹  November 2026  › ] */}
          <div className="flex items-center h-9 border border-[var(--line)] rounded-[4px] bg-[var(--card)] overflow-hidden select-none">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="w-9 h-9 flex items-center justify-center text-[var(--ink)] hover:bg-[var(--soft)] transition-colors cursor-pointer"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4 stroke-[1.8]" />
            </button>
            <span className="min-w-[116px] text-center text-[13px] font-semibold text-[var(--ink)] px-1">
              {monthLabel}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              disabled={isCurrentMonth}
              className={cn(
                "w-9 h-9 flex items-center justify-center text-[var(--ink)] transition-colors",
                isCurrentMonth ? "opacity-30 cursor-not-allowed" : "hover:bg-[var(--soft)] cursor-pointer"
              )}
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4 stroke-[1.8]" />
            </button>
          </div>
        </div>

        {/* 4 Stat Tiles */}
        <div className="grid grid-cols-2 gap-3">
          {/* Present */}
          <div className="border border-[var(--line)] border-l-[3px] border-l-[#1FA36A] rounded-[4px] p-3.5 bg-[var(--card)]">
            <span className="text-[11px] text-[var(--muted)] block">Present</span>
            <span className="text-[24px] font-bold text-[var(--ink)] block leading-tight my-1">
              {stats.presentCount}
            </span>
            <span className="text-[11px] text-[var(--muted)] block">On duty</span>
          </div>

          {/* Late mark */}
          <div className="border border-[var(--line)] border-l-[3px] border-l-[#D98A00] rounded-[4px] p-3.5 bg-[var(--card)]">
            <span className="text-[11px] text-[var(--muted)] block">Late mark</span>
            <span className="text-[24px] font-bold text-[var(--ink)] block leading-tight my-1">
              {stats.lateCount}
            </span>
            <span className="text-[11px] text-[var(--muted)] block">After 10:30 AM</span>
          </div>

          {/* Half day */}
          <div className="border border-[var(--line)] border-l-[3px] border-l-[#D6283A] rounded-[4px] p-3.5 bg-[var(--card)]">
            <span className="text-[11px] text-[var(--muted)] block">Half day</span>
            <span className="text-[24px] font-bold text-[var(--ink)] block leading-tight my-1">
              {stats.halfDayCount}
            </span>
            <span className="text-[11px] text-[var(--muted)] block">After 11:00 AM</span>
          </div>

          {/* Compensation */}
          <div className="border border-[var(--line)] border-l-[3px] border-l-[#2B2FD1] rounded-[4px] p-3.5 bg-[var(--card)]">
            <span className="text-[11px] text-[var(--muted)] block">Compensation</span>
            <span className="text-[24px] font-bold text-[#2B2FD1] block leading-tight my-1">
              {stats.totalDeductionDays > 0 ? `-${stats.totalDeductionDays}d` : "0d"}
            </span>
            <span className="text-[11px] text-[var(--muted)] block">Days adjusted</span>
          </div>
        </div>
      </div>

      {/* 3. Compensation Breakdown Section */}
      <div className={cn("space-y-3 transition-opacity duration-150", isMonthLoading && "opacity-60")}>
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-bold text-[var(--ink)]">Compensation breakdown</h2>
          <span className="text-[12px] text-[var(--muted)]">{monthLabel}</span>
        </div>

        <div className="border border-[var(--line)] rounded-[4px] bg-[var(--card)] divide-y divide-[var(--line)]">
          {/* Summary Row */}
          <div className="flex items-center justify-between p-3.5">
            <span className="text-[13px] font-semibold text-[var(--ink)]">Summary</span>
            <span className="text-[12px] font-semibold text-[#2B2FD1] bg-[#ECECFB] px-2 py-0.5 rounded-[2px]">
              -{stats.totalDeductionDays} days
            </span>
          </div>

          {/* Late rule */}
          <div className="p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-[var(--ink)]">Late rule</span>
              <span className="text-[13px] font-semibold text-[#2B2FD1]">-{stats.lateCutDays} days</span>
            </div>
            <p className="text-[12px] text-[var(--muted)] leading-relaxed">
              3 lates = 0.5 day. You have {stats.lateCount} late{stats.lateCount === 1 ? "" : "s"}, {stats.latesToNextCut} more to the next adjustment.
            </p>
            {/* 3-segment progress indicator */}
            <div className="flex gap-1.5 h-1.5 w-full mt-2">
              {[1, 2, 3].map((seg) => {
                const countInCycle = stats.lateCount % 3;
                const isFilled = countInCycle >= seg;
                return (
                  <div
                    key={seg}
                    className={cn(
                      "flex-1 h-full rounded-[1px] transition-colors",
                      isFilled ? "bg-[#D98A00]" : "bg-[#E6E7EA]"
                    )}
                  />
                );
              })}
            </div>
          </div>

          {/* Half day */}
          <div className="p-3.5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-[var(--ink)]">Half day</span>
              <span className="text-[13px] font-semibold text-[#2B2FD1]">-{stats.halfDayCutDays} days</span>
            </div>
            <p className="text-[12px] text-[var(--muted)] leading-relaxed">
              Check-in after 11:00 AM = 0.5 day. You have {stats.halfDayCount} half day{stats.halfDayCount === 1 ? "" : "s"}.
            </p>
          </div>

          {/* Total */}
          <div className="flex items-center justify-between p-3.5">
            <span className="text-[13px] font-bold text-[var(--ink)]">Total</span>
            <span className="text-[13px] font-bold text-[#2B2FD1]">-{stats.totalDeductionDays} days</span>
          </div>
        </div>
      </div>

      {/* 4. Timings Section */}
      <div className={cn("space-y-3 transition-opacity duration-150", isMonthLoading && "opacity-60")}>
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-bold text-[var(--ink)]">Timings</h2>
          <span className="text-[12px] text-[var(--muted)]">Shift 10:00 - 19:00</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="border border-[var(--line)] rounded-[4px] p-3.5 bg-[var(--card)]">
            <span className="text-[11px] text-[var(--muted)] block">Total gross hours</span>
            <span className="text-[18px] font-bold text-[var(--ink)] block mt-1">
              {formatHoursMinutes(stats.totalHours)}
            </span>
          </div>

          <div className="border border-[var(--line)] rounded-[4px] p-3.5 bg-[var(--card)]">
            <span className="text-[11px] text-[var(--muted)] block">Avg daily hours</span>
            <span className="text-[18px] font-bold text-[var(--ink)] block mt-1">
              {formatHoursMinutes(Number(stats.avgDailyHours))}
            </span>
          </div>
        </div>
      </div>

      {/* 5. Logs & Records Table */}
      <div className="rounded-[4px] border border-[var(--line)] bg-[var(--card)] overflow-hidden">
        {/* Table Header & Month Filter Pills */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[var(--line)] px-4 py-3 gap-3 bg-[var(--soft)]/50">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-[var(--ink)]">Logs & Records</h2>
            <div className="flex items-center rounded-[4px] border border-[var(--line)] p-0.5 bg-[var(--field)] text-xs ml-3">
              <button
                type="button"
                onClick={() => setActiveTab("log")}
                className={cn(
                  "px-3 py-1 rounded-[2px] font-semibold transition-colors cursor-pointer",
                  activeTab === "log"
                    ? "bg-[var(--accent)] text-white"
                    : "text-[var(--muted)] hover:text-[var(--ink)]"
                )}
              >
                Attendance Log
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("shifts")}
                className={cn(
                  "px-3 py-1 rounded-[2px] font-semibold transition-colors cursor-pointer",
                  activeTab === "shifts"
                    ? "bg-[var(--accent)] text-white"
                    : "text-[var(--muted)] hover:text-[var(--ink)]"
                )}
              >
                Shifts
              </button>
            </div>
          </div>

          {/* Month Pills for quick table jump */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] font-bold">
            {availablePeriods.map((p) => {
              const isActive = selectedYear === p.year && selectedMonth === p.month;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => {
                    setSelectedMonth(p.month);
                    setSelectedYear(p.year);
                  }}
                  className={cn(
                    "px-2.5 py-1 rounded-[2px] transition-all font-semibold text-[11px] whitespace-nowrap cursor-pointer",
                    isActive
                      ? "bg-[#2B2FD1] text-white shadow-xs"
                      : "bg-[var(--soft)] text-[var(--muted)] hover:text-[var(--ink)] border border-[var(--line)]"
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[var(--line)] bg-[var(--soft)] text-[11px] font-bold text-[var(--muted)]">
                <th className="py-3 px-4 w-[160px]">Date</th>
                <th className="py-3 px-4 min-w-[200px]">Attendance Visual</th>
                <th className="py-3 px-4 w-[100px]">Gross Hours</th>
                <th className="py-3 px-4 w-[100px]">Effective Hours</th>
                <th className="py-3 px-4 w-[110px]">Clock In</th>
                <th className="py-3 px-4 w-[110px]">Clock Out</th>
                <th className="py-3 px-4 w-[90px] text-center">Map View</th>
                <th className="py-3 px-4 w-[100px] text-right">Status</th>
                {canManage && (
                  <th className="py-3 px-4 w-[100px] text-right">Action</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {isMonthLoading ? (
                <tr>
                  <td colSpan={canManage ? 9 : 8} className="py-12 text-center text-[var(--muted)]">
                    Loading attendance logs for {monthLabel}...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 9 : 8} className="py-12 text-center text-[var(--muted)]">
                    No attendance records for {monthLabel}.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const dateStr = formatDateIST(log.date);
                  const isCheckedIn = Boolean(log.checkInTime);
                  const isCheckedOut = Boolean(log.checkOutTime);
                  const hours = log.totalHours != null ? `${log.totalHours}h` : "—";
                  const hoursVal = log.totalHours || (isCheckedIn ? 6 : 0);
                  const barWidthPercent = Math.min(100, Math.round((hoursVal / 9) * 100));

                  const rawDateStr = new Date(log.date).toISOString().slice(0, 10);
                  const punches =
                    "punches" in log && Array.isArray(log.punches) ? log.punches : [];
                  const firstIn = punches[0]?.checkInTime ?? log.checkInTime;
                  const isExpanded = expandedLogId === log.id;

                  return (
                    <Fragment key={log.id}>
                      <tr className="hover:bg-[var(--soft)]/50 transition-colors">
                        {/* Date */}
                        <td className="py-3 px-4 font-semibold text-[var(--ink)] whitespace-nowrap">
                          {dateStr}
                          {punches.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                              className="mt-1 flex items-center gap-0.5 text-[10px] font-bold text-[#2B2FD1] hover:underline"
                            >
                              {punches.length} punches
                              <ChevronRight
                                className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-90")}
                              />
                            </button>
                          )}
                        </td>

                        {/* Visual Timeline Bar */}
                        <td className="py-3 px-4">
                          <div className="w-full max-w-[240px]">
                            <div className="flex items-center justify-between text-[10px] text-[var(--muted)] mb-1">
                              <span>{firstIn ? formatTimeIST(firstIn) : "—"}</span>
                              <span>{log.checkOutTime ? formatTimeIST(log.checkOutTime) : isCheckedIn ? "Active" : "—"}</span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-[var(--soft)] overflow-hidden">
                              {isCheckedIn && (
                                <div
                                  className="h-full rounded-full bg-[#1FA36A] transition-all"
                                  style={{ width: `${barWidthPercent}%` }}
                                />
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Gross Hours */}
                        <td className="py-3 px-4 font-semibold text-[var(--ink)]">{hours}</td>

                        {/* Effective Hours */}
                        <td className="py-3 px-4 font-semibold text-[var(--muted)]">{hours}</td>

                        {/* Clock In */}
                        <td className="py-3 px-4 text-[var(--ink)]">
                          {firstIn ? (
                            <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-[2px] border border-emerald-200">
                              {formatTimeIST(firstIn)}
                            </span>
                          ) : (
                            <span className="text-[var(--muted)]">—</span>
                          )}
                        </td>

                        {/* Clock Out */}
                        <td className="py-3 px-4 text-[var(--ink)]">
                          {log.checkOutTime ? (
                            <span className="font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-[2px] border border-rose-200">
                              {formatTimeIST(log.checkOutTime)}
                            </span>
                          ) : isCheckedIn ? (
                            <span className="font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-[2px] border border-amber-200">
                              Active
                            </span>
                          ) : (
                            <span className="text-[var(--muted)]">—</span>
                          )}
                        </td>

                        {/* Map View */}
                        <td className="py-3 px-4 text-center">
                          {isCheckedIn ? (
                            <button
                              type="button"
                              onClick={() => setMapModalDate(rawDateStr)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[2px] text-[11px] font-semibold text-[#2B2FD1] bg-[#ECECFB] hover:bg-[#2B2FD1] hover:text-white transition-colors"
                            >
                              <MapPin className="h-3.5 w-3.5" />
                              <span>Map</span>
                            </button>
                          ) : (
                            <span className="text-[var(--muted)]">—</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 text-right">
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-[2px] text-[10px] font-bold border inline-block",
                              log.status === "PRESENT" && "bg-emerald-50 text-emerald-700 border-emerald-200",
                              log.status === "LATE" && "bg-amber-50 text-amber-800 border-amber-200",
                              log.status === "HALF_DAY" && "bg-orange-50 text-orange-800 border-orange-200",
                              log.status === "ON_LEAVE" && "bg-blue-50 text-blue-700 border-blue-200",
                              log.status === "ABSENT" && "bg-rose-50 text-rose-700 border-rose-200"
                            )}
                          >
                            {log.status === "PRESENT"
                              ? "Present"
                              : log.status === "LATE"
                                ? "Late Mark"
                                : log.status === "HALF_DAY"
                                  ? "Half Day"
                                  : log.status === "ON_LEAVE"
                                    ? "On Leave"
                                    : "Absent"}
                          </span>
                        </td>

                        {/* Admin Action: Regularise */}
                        {canManage && (
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                setRegulariseTarget({
                                  employeeId: targetEmployeeId ?? session?.user?.id ?? "",
                                  employeeName: displayName,
                                  date: rawDateStr,
                                  currentStatus: log.status,
                                  currentCheckIn: log.checkInTime,
                                  currentCheckOut: log.checkOutTime,
                                  currentHours: log.totalHours,
                                  existingNotes: log.notes,
                                })
                              }
                              className="text-[11px] font-semibold text-[#2B2FD1] hover:underline"
                            >
                              Regularise
                            </button>
                          </td>
                        )}
                      </tr>

                      {/* Expanded Multi-Punch List */}
                      {isExpanded && punches.length > 0 && (
                        <tr>
                          <td colSpan={canManage ? 9 : 8} className="bg-[var(--soft)]/40 p-4 border-b border-[var(--line)]">
                            <PunchList punches={punches} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Map View Modal */}
      {mapModalDate && (
        <KekaMapViewModal
          onClose={() => setMapModalDate(null)}
          date={mapModalDate}
          employeeId={targetEmployeeId ?? session?.user?.id ?? ""}
          employeeName={displayName}
        />
      )}

      {/* Regularise Attendance Modal */}
      {regulariseTarget && (
        <AttendanceRegulariseModal
          open={Boolean(regulariseTarget)}
          onClose={() => setRegulariseTarget(null)}
          employeeId={regulariseTarget.employeeId}
          employeeName={regulariseTarget.employeeName}
          employeeCode={regulariseTarget.employeeCode}
          date={regulariseTarget.date}
          currentStatus={regulariseTarget.currentStatus}
          currentCheckIn={regulariseTarget.currentCheckIn}
          currentCheckOut={regulariseTarget.currentCheckOut}
          currentHours={regulariseTarget.currentHours}
          existingNotes={regulariseTarget.existingNotes}
          onSuccess={() => {
            void utils.attendance.myMonth.invalidate();
            if (targetEmployeeId) {
              void utils.attendance.forEmployeeMonth.invalidate({ employeeId: targetEmployeeId });
            }
          }}
        />
      )}
    </div>
  );
}
