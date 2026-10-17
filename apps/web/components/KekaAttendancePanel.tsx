"use client";

import { Fragment, useMemo, useState } from "react";
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
  Filter,
  Navigation,
  ShieldCheck,
  Building,
  User,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  geolocationErrorMessage,
  getPunchPosition,
  reverseGeocodePlace,
} from "@/lib/geolocation";
import { subscribeToLocationReminders } from "@/lib/push";
import {
  startNativeDutyTracking,
  stopNativeDutyTracking,
} from "@/lib/native-duty-tracking";
import { toast } from "@/lib/toast";
import { TRPCClientError } from "@trpc/client";
import {
  formatDateIST,
  formatTimeIST,
  getISTDateString,
  getISTDateParts,
  haversineDistanceM,
} from "@realty-smartz/shared";
import { KekaMapViewModal } from "@/components/KekaMapViewModal";
import { PunchList } from "@/components/PunchList";
import { Button } from "@/components/ui/button";

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
  const todayISTStr = useMemo(() => getISTDateString(now), []);
  const currentMonthNum = now.getMonth() + 1;
  const currentYearNum = now.getFullYear();

  // Selected period / month filter
  const [selectedPeriod, setSelectedPeriod] = useState<"30_DAYS" | "OCT" | "SEP" | "AUG">("30_DAYS");
  const [selectedMonth, setSelectedMonth] = useState(currentMonthNum);
  const [selectedYear, setSelectedYear] = useState(currentYearNum);

  // Active tab in Logs & Records
  const [activeTab, setActiveTab] = useState<"log" | "shifts">("log");

  // State for Keka Map View Modal
  const [mapModalDate, setMapModalDate] = useState<string | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const isTargetMode = Boolean(
    targetEmployeeId && targetEmployeeId !== session?.user?.id
  );

  // Queries
  const { data: currentUserWorkLoc } = trpc.attendance.myWorkLocation.useQuery();

  const { data: targetMonthData, isLoading: isTargetMonthLoading } =
    trpc.attendance.forEmployeeMonth.useQuery(
      {
        employeeId: targetEmployeeId ?? "",
        year: selectedYear,
        month: selectedMonth,
      },
      { enabled: isTargetMode }
    );

  const { data: selfMonthData, isLoading: isSelfMonthLoading } =
    trpc.attendance.myMonth.useQuery(
      {
        year: selectedYear,
        month: selectedMonth,
      },
      { enabled: !isTargetMode }
    );

  const monthData = isTargetMode ? targetMonthData : selfMonthData;
  const isMonthLoading = isTargetMode ? isTargetMonthLoading : isSelfMonthLoading;

  const { data: selfTodayAttendance, isLoading: isSelfTodayLoading } =
    trpc.attendance.today.useQuery(undefined, {
      enabled: !isTargetMode,
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      refetchInterval: (data) => {
        const onDuty = Boolean(data?.checkInTime && !data?.checkOutTime);
        return onDuty && getISTDateParts(new Date()).hour >= 19 ? 30_000 : false;
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
  const isTodayLoading = isTargetMode ? isTargetMonthLoading : isSelfTodayLoading;

  // If admin viewing specific employee:
  const { data: selfProfile } = trpc.employee.myIdCard.useQuery(undefined, {
    enabled: !isTargetMode,
    staleTime: 5 * 60 * 1000,
  });
  const empId = targetEmployeeId ?? session?.user?.id ?? "";
  const displayName =
    propName ??
    (selfProfile ? `${selfProfile.firstName} ${selfProfile.lastName}` : session?.user?.name ?? "");
  const displayRole = propDesignation ?? selfProfile?.designation?.title ?? "";
  const displayDept = propDepartment ?? selfProfile?.department?.name ?? "";
  const displayCode = propCode ?? selfProfile?.employeeCode ?? "";

  // Check in/out state
  const [busy, setBusy] = useState(false);
  const [punchError, setPunchError] = useState("");

  const checkInMutation = trpc.attendance.checkIn.useMutation({
    onSuccess: async () => {
      await utils.attendance.today.refetch();
      await utils.attendance.myMonth.invalidate();
      await utils.attendance.myRecentWeek.invalidate();
      if (targetEmployeeId) {
        await utils.attendance.forEmployeeMonth.invalidate({ employeeId: targetEmployeeId });
      }
      setPunchError("");
    },
    onError: (err) => {
      setPunchError(err.message);
    },
  });

  const savePush = trpc.attendance.savePushSubscription.useMutation();

  const checkOutMutation = trpc.attendance.checkOut.useMutation({
    onSuccess: async () => {
      await utils.attendance.today.refetch();
      await utils.attendance.myMonth.invalidate();
      await utils.attendance.myRecentWeek.invalidate();
      if (targetEmployeeId) {
        await utils.attendance.forEmployeeMonth.invalidate({ employeeId: targetEmployeeId });
      }
      setPunchError("");
    },
    onError: (err) => {
      setPunchError(err.message);
    },
  });

  const isOnDuty = Boolean(
    todayAttendance?.checkInTime && !todayAttendance?.checkOutTime
  );
  const hasCompletedSession = Boolean(
    todayAttendance?.checkInTime && todayAttendance?.checkOutTime
  );

  const displaySiteName = isTargetMode
    ? propSiteName || "Company office (default)"
    : currentUserWorkLoc?.sites && currentUserWorkLoc.sites.length > 1
      ? `Office or ${currentUserWorkLoc.assigned?.name ?? "assigned site"}`
      : currentUserWorkLoc?.name ?? "Loading work location…";

  async function handlePunch(mode: "in" | "out") {
    if (busy) return;
    if (mode === "in") void subscribeToLocationReminders(savePush.mutateAsync).catch(() => {});
    setPunchError("");
    setBusy(true);

    try {
      const pos = await getPunchPosition();
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      const sites = currentUserWorkLoc?.sites?.length
        ? currentUserWorkLoc.sites
        : currentUserWorkLoc
          ? [currentUserWorkLoc]
          : [];
      const matchedSite = sites.find(
        (s) => haversineDistanceM(lat, lng, s.lat, s.lng) <= s.radiusM
      );

      if (mode === "in" && sites.length > 0 && !matchedSite) {
        const nearest = sites
          .map((s) => ({ s, d: haversineDistanceM(lat, lng, s.lat, s.lng) }))
          .sort((a, b) => a.d - b.d)[0];
        const names = sites.map((s) => s.name).join(" or ");
        throw new Error(
          `Punch-in blocked: you are ~${Math.round(nearest.d)}m from ${nearest.s.name}. You must be within ${nearest.s.radiusM}m of ${names}.`
        );
      }

      let label = matchedSite?.name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      if (mode === "out" && !matchedSite) {
        const place = await reverseGeocodePlace(lat, lng);
        label =
          place.name === place.address ? place.address : `${place.name} — ${place.address}`;
      }

      if (mode === "in") {
        await checkInMutation.mutateAsync({ lat, lng, address: label });
        void startNativeDutyTracking();
      } else {
        await checkOutMutation.mutateAsync({ lat, lng, address: label });
        void stopNativeDutyTracking();
      }
    } catch (err: unknown) {
      const message = geolocationErrorMessage(err);
      setPunchError(message);
      if (!(err instanceof TRPCClientError)) toast("error", message);
    } finally {
      setBusy(false);
    }
  }

  // Attendance Records for table (Sorted by date desc)
  const logs = useMemo(() => {
    const list = monthData?.logs ?? [];
    return [...list].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [monthData?.logs]);

  // 30 Days Stats calculation
  const stats = useMemo(() => {
    const totalDays = logs.length;
    const presentCount = logs.filter((l) => l.status === "PRESENT").length;
    const lateCount = logs.filter((l) => l.status === "LATE").length;
    const halfDayCount = logs.filter((l) => l.status === "HALF_DAY").length;
    const onLeaveCount = logs.filter((l) => l.status === "ON_LEAVE").length;
    const absentCount = logs.filter((l) => l.status === "ABSENT" || !l.checkInTime).length;
    const totalHours = Math.round(
      logs.reduce((acc, l) => acc + (l.totalHours || 0), 0) * 10
    ) / 10;
    const avgDailyHours = presentCount > 0 ? (totalHours / presentCount).toFixed(1) : "0.0";

    return {
      totalDays,
      presentCount,
      lateCount,
      halfDayCount,
      onLeaveCount,
      absentCount,
      totalHours,
      avgDailyHours,
    };
  }, [logs]);

  // Initials for avatar
  const initials = useMemo(() => {
    const parts = displayName.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return displayName.slice(0, 2).toUpperCase();
  }, [displayName]);

  return (
    <div className="w-full max-w-full space-y-6">
      {/* 1. TOP EMPLOYEE HEADER BANNER (Keka Style) */}
      {!hideHeaderBanner && (
        <div className="rounded-lg border border-neutral-200/90 bg-white p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              {/* Avatar Badge */}
              <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr from-[#0F5C74] to-[#1AB3B6] text-white text-base sm:text-lg font-bold">
                {initials}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-display text-lg sm:text-xl font-extrabold text-neutral-900 truncate">
                    {displayName}
                  </h1>
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                    Full Time
                  </span>
                </div>
                <p className="text-xs text-neutral-500 font-medium mt-0.5">
                  {[displayRole, displayDept, displayCode].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>

            {/* Location Verification Pill */}
            <div className="flex items-center gap-2 text-xs text-neutral-600 bg-neutral-50 px-3 py-1.5 rounded-xl border border-neutral-200/70">
              <MapPin className="h-4 w-4 text-[#5D3EBC] shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-neutral-400 block">
                  Workplace Allocation
                </span>
                <span className="font-semibold text-neutral-800 truncate block max-w-[220px]">
                  {displaySiteName}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. THREE STATS & ACTION WIDGETS (Keka Style) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card A: Attendance Stats (Last 30 Days) */}
        <div className="rounded-lg border border-neutral-200/90 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              ATTENDANCE STATS
            </span>
            <span className="text-[11px] font-semibold text-neutral-400">Last 30 Days</span>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1 text-center">
            <div className="p-2 rounded-xl bg-emerald-50/70 border border-emerald-100">
              <span className="text-lg font-extrabold text-emerald-800">
                {stats.presentCount}
              </span>
              <span className="block text-[10px] font-semibold text-emerald-700 uppercase mt-0.5">
                Present
              </span>
            </div>

            <div className="p-2 rounded-xl bg-amber-50/70 border border-amber-100">
              <span className="text-lg font-extrabold text-amber-800">
                {stats.lateCount}
              </span>
              <span className="block text-[10px] font-semibold text-amber-700 uppercase mt-0.5">
                Late Marks
              </span>
            </div>

            <div className="p-2 rounded-xl bg-rose-50/70 border border-rose-100">
              <span className="text-lg font-extrabold text-rose-800">
                {stats.absentCount}
              </span>
              <span className="block text-[10px] font-semibold text-rose-700 uppercase mt-0.5">
                Absent / Leave
              </span>
            </div>
          </div>
        </div>

        {/* Card B: Timings */}
        <div className="rounded-lg border border-neutral-200/90 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              TIMINGS
            </span>
            <span className="text-[11px] font-semibold text-neutral-400">Shift 10:00 - 19:00</span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="p-2 rounded-xl bg-neutral-50 border border-neutral-100">
              <span className="text-xs text-neutral-400 uppercase font-bold text-[10px]">
                Total Gross Hours
              </span>
              <p className="text-lg font-extrabold text-neutral-900 mt-0.5">
                {stats.totalHours} hrs
              </p>
            </div>

            <div className="p-2 rounded-xl bg-neutral-50 border border-neutral-100">
              <span className="text-xs text-neutral-400 uppercase font-bold text-[10px]">
                Avg Daily Hours
              </span>
              <p className="text-lg font-extrabold text-neutral-900 mt-0.5">
                {stats.avgDailyHours} hrs
              </p>
            </div>
          </div>
        </div>

        {/* Card C: Actions (Punch In / Punch Out with Location Enforcement) */}
        <div className="rounded-lg border border-neutral-200/90 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              ACTIONS
            </span>
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  isOnDuty ? "bg-emerald-500 animate-pulse" : "bg-neutral-300"
                )}
              />
              <span className={isOnDuty ? "text-emerald-700" : "text-neutral-500"}>
                {isOnDuty ? "Currently On Duty" : "Off Duty"}
              </span>
            </div>
          </div>

          <div>
            {isTargetMode ? (
              <div className="space-y-2">
                <div className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-100 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-neutral-400 block">
                    Today's Attendance Status
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-neutral-900">
                      {isOnDuty
                        ? "Currently On Duty"
                        : hasCompletedSession
                        ? "Shift Completed"
                        : "Not Checked In Today"}
                    </span>
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                        isOnDuty
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : hasCompletedSession
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "bg-neutral-100 text-neutral-500 border-neutral-200"
                      )}
                    >
                      {isOnDuty ? "Active" : hasCompletedSession ? "Done" : "Off"}
                    </span>
                  </div>
                  {todayAttendance?.checkInTime && (
                    <div className="text-[11px] text-neutral-600 pt-1 border-t border-neutral-200/60 flex items-center justify-between flex-wrap gap-1">
                      <span>In: <b className="text-neutral-900">{formatTimeIST(todayAttendance.checkInTime)}</b></span>
                      {todayAttendance?.checkOutTime && (
                        <span>Out: <b className="text-neutral-900">{formatTimeIST(todayAttendance.checkOutTime)}</b></span>
                      )}
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-neutral-400 italic text-center">
                  Staff punch in directly via employee portal
                </p>
              </div>
            ) : isOnDuty && getISTDateParts(new Date()).hour >= 19 ? (
              <div className="w-full h-10 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 font-semibold text-xs flex items-center justify-center gap-2">
                <RotateCw className="h-3.5 w-3.5 animate-spin" />
                Shift ended 7:00 PM — auto clock-out…
              </div>
            ) : isOnDuty ? (
              <Button
                onClick={() => handlePunch("out")}
                disabled={busy}
                className="w-full h-10 rounded-xl bg-neutral-900 hover:bg-black text-white font-semibold text-xs gap-2"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>{busy ? "Verifying GPS..." : "Clock Out"}</span>
              </Button>
            ) : (
              <Button
                onClick={() => handlePunch("in")}
                disabled={busy}
                className="w-full h-10 rounded-xl bg-[#5D3EBC] text-white hover:opacity-95 font-semibold text-xs gap-2"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>
                  {busy
                    ? "Verifying Location..."
                    : hasCompletedSession
                    ? "Clock In Again"
                    : "Clock In"}
                </span>
              </Button>
            )}

            {punchError && (
              <p className="mt-2 text-[11px] font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-2 leading-relaxed">
                {punchError}
              </p>
            )}

            {todayAttendance?.punches && todayAttendance.punches.length > 0 && (
              <div className="mt-3">
                <PunchList punches={todayAttendance.punches} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. LOGS & RECORDS SECTION (Keka Style Table with Visual Timeline) */}
      <div className="rounded-lg border border-neutral-200/90 bg-white overflow-hidden">
        {/* Top Header & Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-neutral-200 px-4 py-3 gap-3 bg-neutral-50/50">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-neutral-900">Logs & Records</h2>
            <div className="flex items-center rounded-lg border border-neutral-200 p-0.5 bg-white text-xs ml-3">
              <button
                type="button"
                onClick={() => setActiveTab("log")}
                className={cn(
                  "px-3 py-1 rounded-md font-semibold transition-colors",
                  activeTab === "log"
                    ? "bg-neutral-900 text-white"
                    : "text-neutral-600 hover:text-neutral-900"
                )}
              >
                Attendance Log
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("shifts")}
                className={cn(
                  "px-3 py-1 rounded-md font-semibold transition-colors",
                  activeTab === "shifts"
                    ? "bg-neutral-900 text-white"
                    : "text-neutral-600 hover:text-neutral-900"
                )}
              >
                Shifts
              </button>
            </div>
          </div>

          {/* Period Selection Pills matching Screenshot 2 */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] font-bold">
            <button
              type="button"
              onClick={() => {
                setSelectedPeriod("30_DAYS");
                setSelectedMonth(currentMonthNum);
              }}
              className={cn(
                "px-2.5 py-1 rounded-md transition-colors",
                selectedPeriod === "30_DAYS"
                  ? "bg-[#5D3EBC] text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              )}
            >
              30 DAYS
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedPeriod("OCT");
                setSelectedMonth(10);
              }}
              className={cn(
                "px-2 py-1 rounded-md transition-colors",
                selectedPeriod === "OCT"
                  ? "bg-[#5D3EBC] text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              )}
            >
              OCT
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedPeriod("SEP");
                setSelectedMonth(9);
              }}
              className={cn(
                "px-2 py-1 rounded-md transition-colors",
                selectedPeriod === "SEP"
                  ? "bg-[#5D3EBC] text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              )}
            >
              SEP
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedPeriod("AUG");
                setSelectedMonth(8);
              }}
              className={cn(
                "px-2 py-1 rounded-md transition-colors",
                selectedPeriod === "AUG"
                  ? "bg-[#5D3EBC] text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              )}
            >
              AUG
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/80 text-[11px] font-bold text-neutral-600">
                <th className="py-3 px-4 w-[160px]">Date</th>
                <th className="py-3 px-4 min-w-[200px]">Attendance Visual</th>
                <th className="py-3 px-4 w-[100px]">Gross Hours</th>
                <th className="py-3 px-4 w-[100px]">Effective Hours</th>
                <th className="py-3 px-4 w-[110px]">Clock In</th>
                <th className="py-3 px-4 w-[110px]">Clock Out</th>
                <th className="py-3 px-4 w-[90px] text-center">Map View</th>
                <th className="py-3 px-4 w-[100px] text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {isMonthLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-neutral-400">
                    Loading attendance logs...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-neutral-400">
                    No attendance records for this period.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const dateStr = formatDateIST(log.date);
                  const isCheckedIn = Boolean(log.checkInTime);
                  const isCheckedOut = Boolean(log.checkOutTime);
                  const hours = log.totalHours != null ? `${log.totalHours}h` : "—";

                  // Calculate percentage for visual bar (e.g. 8 hours out of 9 hours standard shift)
                  const hoursVal = log.totalHours || (isCheckedIn ? 6 : 0);
                  const barWidthPercent = Math.min(100, Math.round((hoursVal / 9) * 100));

                  const rawDateStr = new Date(log.date).toISOString().slice(0, 10);
                  const punches = log.punches ?? [];
                  const firstIn = punches[0]?.checkInTime ?? log.checkInTime;
                  const isExpanded = expandedLogId === log.id;

                  return (
                    <Fragment key={log.id}>
                    <tr
                      className="hover:bg-neutral-50/70 transition-colors"
                    >
                      {/* Date */}
                      <td className="py-3 px-4 font-semibold text-neutral-900 whitespace-nowrap">
                        {dateStr}
                        {punches.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                            className="mt-1 flex items-center gap-0.5 text-[10px] font-bold text-[#5D3EBC] hover:underline"
                          >
                            {punches.length} punches
                            <ChevronRight
                              className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-90")}
                            />
                          </button>
                        )}
                      </td>

                      {/* Visual Timeline Bar matching Screenshot 2 */}
                      <td className="py-3 px-4">
                        <div className="w-full max-w-[240px]">
                          <div className="flex items-center justify-between text-[10px] text-neutral-400 mb-1">
                            <span>{firstIn ? formatTimeIST(firstIn) : "—"}</span>
                            <span>{log.checkOutTime ? formatTimeIST(log.checkOutTime) : isCheckedIn ? "Active" : "—"}</span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-neutral-100 overflow-hidden">
                            {isCheckedIn && (
                              <div
                                className="h-full rounded-full bg-[#1AB3B6] transition-all"
                                style={{ width: `${barWidthPercent}%` }}
                              />
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Gross Hours */}
                      <td className="py-3 px-4 font-bold text-neutral-800 whitespace-nowrap">
                        {hours}
                      </td>

                      {/* Effective Hours */}
                      <td className="py-3 px-4 font-medium text-neutral-600 whitespace-nowrap">
                        {hours}
                      </td>

                      {/* Clock In */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isCheckedIn ? (
                          <span className="font-semibold text-neutral-900">
                            {formatTimeIST(firstIn)}
                          </span>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>

                      {/* Clock Out */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isCheckedOut ? (
                          <span className="font-semibold text-neutral-900">
                            {formatTimeIST(log.checkOutTime)}
                          </span>
                        ) : isCheckedIn ? (
                          <span className="font-bold text-[#5D3EBC]">On Duty</span>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>

                      {/* Map View Button (Opens Screenshot 1 Modal!) */}
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => setMapModalDate(rawDateStr)}
                          title="Open Keka Map View"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700 hover:bg-[#5D3EBC] hover:text-white transition-colors"
                        >
                          <MapPin className="h-3.5 w-3.5" />
                        </button>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {log.status === "PRESENT" && (
                          <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                            On Time
                          </span>
                        )}
                        {log.status === "LATE" && (
                          <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200">
                            Late
                          </span>
                        )}
                        {log.status === "HALF_DAY" && (
                          <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-300">
                            Half Day
                          </span>
                        )}
                        {log.status === "ON_LEAVE" && (
                          <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-primary border border-indigo-200">
                            Leave
                          </span>
                        )}
                        {log.status === "ABSENT" && (
                          <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-maroon border border-rose-200">
                            Absent
                          </span>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-neutral-50/70">
                        <td colSpan={8} className="px-4 py-3">
                          <div className="max-w-md">
                            <PunchList punches={punches} />
                          </div>
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

      {/* 4. MODAL: KEKA MAP VIEW (Screenshot 1) */}
      {mapModalDate && (
        <KekaMapViewModal
          employeeId={empId}
          employeeName={displayName}
          date={mapModalDate}
          onClose={() => setMapModalDate(null)}
        />
      )}
    </div>
  );
}
