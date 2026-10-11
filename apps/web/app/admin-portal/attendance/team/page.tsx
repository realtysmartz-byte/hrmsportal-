"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Download,
  ExternalLink,
  FileSpreadsheet,
  Calendar,
  Clock,
  MapPin,
  Search,
  RefreshCw,
  X,
  Filter,
  CalendarDays,
  CalendarRange,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { fullName, cn } from "@/lib/utils";
import { KekaMapViewModal } from "@/components/KekaMapViewModal";
import {
  canViewTeamAttendance,
  formatTimeIST,
  formatDateIST,
  formatDateTimeIST,
  getISTDateString,
} from "@realty-smartz/shared";
import type { Role } from "@realty-smartz/shared";

type ViewMode = "daily" | "monthly" | "custom";
type StatusFilter = "ALL" | "PRESENT" | "LATE" | "HALF_DAY" | "ON_LEAVE" | "ABSENT";

function formatMonthTitle(monthStr: string): string {
  try {
    const [y, m] = monthStr.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1, 1));
    return d.toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      month: "long",
      year: "numeric",
    });
  } catch {
    return monthStr;
  }
}

function parseDateParam(d: unknown, fallback: string): string {
  if (!d) return fallback;
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
}

export default function TeamAttendancePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const role = (session?.user?.role ?? "EMPLOYEE") as Role;
  const allowed = canViewTeamAttendance(role);

  const todayIST = useMemo(() => getISTDateString(new Date()), []);
  const currentMonthIST = useMemo(() => todayIST.slice(0, 7), [todayIST]);

  // View modes: daily (1 day), monthly (1 full month), custom (date range)
  const [viewMode, setViewMode] = useState<ViewMode>("daily");
  const [selectedDate, setSelectedDate] = useState(todayIST);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthIST);
  const [customStartDate, setCustomStartDate] = useState(todayIST);
  const [customEndDate, setCustomEndDate] = useState(todayIST);

  // Filters
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const [googleSheetResult, setGoogleSheetResult] = useState<string | null>(null);
  const [mapModalTarget, setMapModalTarget] = useState<{
    employeeId: string;
    employeeName: string;
    date: string;
  } | null>(null);

  // Build query input based on active view mode
  const queryInput = useMemo(() => {
    if (viewMode === "monthly") {
      const [year, month] = selectedMonth.split("-").map(Number);
      const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
      const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
      const endDate = new Date(Date.UTC(year, month - 1, lastDay, 23, 59, 59, 999));
      return {
        startDate,
        endDate,
      };
    }

    if (viewMode === "custom") {
      const startDate = new Date(`${customStartDate}T00:00:00.000Z`);
      const endDate = new Date(`${customEndDate}T23:59:59.999Z`);
      return {
        startDate,
        endDate,
      };
    }

    // Default daily mode
    return {
      date: new Date(`${selectedDate}T00:00:00.000Z`),
    };
  }, [viewMode, selectedDate, selectedMonth, customStartDate, customEndDate]);

  // Query attendance via tRPC
  const {
    data: teamData,
    isLoading,
    refetch,
    isFetching,
  } = trpc.attendance.team.useQuery(queryInput, { enabled: allowed });

  const syncGoogleSheet = trpc.googleSheets.syncDailyReport.useMutation({
    onSuccess: (res) => {
      setGoogleSheetResult(
        `Attendance for "${formatDateIST(selectedDate)}" synced to Google Sheet successfully (${res.rowCount} records).`
      );
      setTimeout(() => setGoogleSheetResult(null), 6000);
    },
    onError: (err) => {
      alert(`Google Sheet Sync Error: ${err.message}`);
    },
  });

  useEffect(() => {
    if (status === "authenticated" && !allowed) {
      router.replace("/admin-portal/dashboard");
    }
  }, [status, allowed, router]);

  // Quick navigation helpers for 1-month filtration
  function handleSelectThisMonth() {
    setSelectedMonth(currentMonthIST);
    setViewMode("monthly");
  }

  function handleSelectPreviousMonth() {
    const [y, m] = selectedMonth.split("-").map(Number);
    const prevDate = new Date(Date.UTC(y, m - 2, 1));
    const prevYear = prevDate.getUTCFullYear();
    const prevMonth = String(prevDate.getUTCMonth() + 1).padStart(2, "0");
    setSelectedMonth(`${prevYear}-${prevMonth}`);
    setViewMode("monthly");
  }

  // Filter rows by search and status
  const rows = useMemo(() => {
    const raw = teamData?.rows ?? [];
    let filtered = raw;

    if (employeeSearch.trim()) {
      const q = employeeSearch.toLowerCase().trim();
      filtered = filtered.filter(
        (r) =>
          r.employee.firstName.toLowerCase().includes(q) ||
          r.employee.lastName.toLowerCase().includes(q) ||
          r.employee.employeeCode.toLowerCase().includes(q) ||
          r.employee.department?.name?.toLowerCase().includes(q) ||
          r.employee.designation?.title?.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== "ALL") {
      filtered = filtered.filter((r) => {
        if (statusFilter === "ABSENT") {
          return !r.log?.checkInTime || r.log?.status === "ABSENT";
        }
        return r.log?.status === statusFilter;
      });
    }

    // In monthly or range mode: sort by Date descending, then CheckIn time descending
    if (viewMode !== "daily") {
      return [...filtered].sort((a, b) => {
        const aDate = a.log?.date ? new Date(a.log.date).getTime() : 0;
        const bDate = b.log?.date ? new Date(b.log.date).getTime() : 0;
        if (aDate !== bDate) return bDate - aDate;
        const aIn = a.log?.checkInTime ? new Date(a.log.checkInTime).getTime() : 0;
        const bIn = b.log?.checkInTime ? new Date(b.log.checkInTime).getTime() : 0;
        if (aIn !== bIn) return bIn - aIn;
        return a.employee.firstName.localeCompare(b.employee.firstName);
      });
    }

    // Daily mode: Sort punched-in employees first (most recent punch in first), then remaining alphabetically
    return [...filtered].sort((a, b) => {
      const aIn = a.log?.checkInTime ? new Date(a.log.checkInTime).getTime() : 0;
      const bIn = b.log?.checkInTime ? new Date(b.log.checkInTime).getTime() : 0;
      if (aIn !== bIn) return bIn - aIn;
      return a.employee.firstName.localeCompare(b.employee.firstName);
    });
  }, [teamData?.rows, employeeSearch, statusFilter, viewMode]);

  // Summary counts
  const summary = useMemo(() => {
    const raw = teamData?.rows ?? [];
    const totalRecords = raw.length;
    const present = raw.filter((r) => r.log?.status === "PRESENT").length;
    const late = raw.filter((r) => r.log?.status === "LATE").length;
    const halfDay = raw.filter((r) => r.log?.status === "HALF_DAY").length;
    const onDuty = raw.filter((r) => r.log?.checkInTime && !r.log?.checkOutTime).length;
    const absent = raw.filter((r) => !r.log?.checkInTime || r.log?.status === "ABSENT").length;
    const totalHours = Math.round(
      raw.reduce((acc, r) => acc + (r.log?.totalHours || 0), 0) * 10
    ) / 10;
    return { totalRecords, present, late, halfDay, onDuty, absent, totalHours };
  }, [teamData?.rows]);

  // Export clean CSV with the exact 7+ columns
  function exportCsv() {
    if (!rows.length) return;
    const header = [
      "Employee Name",
      "Employee Code",
      "Date",
      "Punch In (IST)",
      "Punch Out (IST)",
      "Location Address",
      "Map Coordinates",
      "Status",
      "Working Hours",
    ];

    const lines = rows.map((r) => {
      const log = r.log;
      const empName = fullName(r.employee.firstName, r.employee.lastName);
      const dateStr = formatDateIST(log?.date || selectedDate);
      const punchIn = log?.checkInTime ? formatTimeIST(log.checkInTime) : "—";
      const punchOut = log?.checkOutTime
        ? formatTimeIST(log.checkOutTime)
        : log?.checkInTime
          ? "On Duty"
          : "—";
      const locationAddr = log?.checkInAddress || log?.checkOutAddress || "—";
      const coords =
        log?.checkInLat != null && log?.checkInLng != null
          ? `${log.checkInLat}, ${log.checkInLng}`
          : "—";
      const statusText = log?.status
        ? log.status === "PRESENT"
          ? "Present"
          : log.status === "LATE"
            ? "Late Punch"
            : log.status === "HALF_DAY"
              ? "Half Day"
              : log.status === "ON_LEAVE"
                ? "On Leave"
                : "Absent"
        : "Not Checked In";
      const hours = log?.totalHours != null ? `${log.totalHours} hrs` : log?.checkInTime ? "On Duty" : "—";

      return [
        empName,
        r.employee.employeeCode,
        dateStr,
        punchIn,
        punchOut,
        locationAddr,
        coords,
        statusText,
        hours,
      ].map((c) => `"${String(c).replace(/"/g, '""')}"`);
    });

    const blob = new Blob([[header.join(","), ...lines.map((l) => l.join(","))].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;

    let filename = `realty-smartz-daily-attendance-${selectedDate}.csv`;
    if (viewMode === "monthly") {
      filename = `realty-smartz-monthly-attendance-${selectedMonth}.csv`;
    } else if (viewMode === "custom") {
      filename = `realty-smartz-attendance-${customStartDate}-to-${customEndDate}.csv`;
    }

    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (status === "loading" || !allowed) {
    return (
      <div className="flex items-center justify-center py-20 text-xs text-neutral-500">
        Loading attendance records...
      </div>
    );
  }

  const activePeriodLabel =
    viewMode === "monthly"
      ? `1 Month Attendance (${formatMonthTitle(selectedMonth)})`
      : viewMode === "custom"
        ? `Custom Range (${formatDateIST(customStartDate)} – ${formatDateIST(customEndDate)})`
        : `Daily Attendance (${formatDateIST(selectedDate)})`;

  return (
    <div className="w-full max-w-full overflow-x-hidden space-y-5 px-1 sm:px-0">
      {/* 1. TOP HEADER & ACTIONS */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
            <span>Realty Smartz Private Limited</span>
            <span>·</span>
            <span className="text-[#FF7A70] font-bold">Admin Portal</span>
          </div>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900 truncate">
            {viewMode === "monthly" ? "1-Month Attendance" : "Team Attendance"}
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-neutral-500">
            {activePeriodLabel} · Exact punches in local Indian Standard Time (IST).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs text-neutral-600 hover:text-neutral-900 shadow-2xs"
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin text-primary")} />
            <span>Refresh</span>
          </Button>

          {viewMode === "daily" && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-semibold shadow-2xs"
              disabled={syncGoogleSheet.isLoading}
              onClick={() => syncGoogleSheet.mutate({ date: selectedDate })}
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              <span>{syncGoogleSheet.isLoading ? "Syncing..." : "Sync to Google Sheet"}</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs shadow-2xs"
            onClick={exportCsv}
            disabled={!rows.length}
          >
            <Download className="h-3.5 w-3.5 text-neutral-500" />
            <span>Export CSV</span>
          </Button>
        </div>
      </div>

      {/* Sync Status Banner */}
      {googleSheetResult && (
        <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900 font-medium shadow-2xs">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{googleSheetResult}</span>
          </div>
          <button
            type="button"
            onClick={() => setGoogleSheetResult(null)}
            className="text-neutral-400 hover:text-neutral-600 p-1"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* 2. ADVANCED FILTERS: VIEW MODE, DATES, EMPLOYEE & STATUS */}
      <div className="rounded-xl border border-neutral-200/90 bg-white p-3.5 shadow-2xs space-y-3.5">
        {/* Row 1: Mode Switcher Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 pb-3">
          <div className="inline-flex rounded-lg border border-neutral-200 p-1 bg-neutral-50 text-xs">
            <button
              type="button"
              onClick={() => setViewMode("daily")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-colors",
                viewMode === "daily"
                  ? "bg-white text-neutral-900 shadow-2xs"
                  : "text-neutral-600 hover:text-neutral-900"
              )}
            >
              <Calendar className="h-3.5 w-3.5 text-[#FF7A70]" />
              <span>Daily (1 Day)</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode("monthly")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-colors",
                viewMode === "monthly"
                  ? "bg-white text-neutral-900 shadow-2xs"
                  : "text-neutral-600 hover:text-neutral-900"
              )}
            >
              <CalendarDays className="h-3.5 w-3.5 text-[#FF7A70]" />
              <span>1 Month Attendance</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode("custom")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-colors",
                viewMode === "custom"
                  ? "bg-white text-neutral-900 shadow-2xs"
                  : "text-neutral-600 hover:text-neutral-900"
              )}
            >
              <CalendarRange className="h-3.5 w-3.5 text-[#FF7A70]" />
              <span>Custom Range</span>
            </button>
          </div>

          <div className="text-[11px] font-semibold text-neutral-500">
            {viewMode === "monthly" && (
              <span className="text-[#FF7A70] font-bold">
                Viewing full month of {formatMonthTitle(selectedMonth)}
              </span>
            )}
          </div>
        </div>

        {/* Row 2: Date Selector Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Daily View Controls */}
          {viewMode === "daily" && (
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700 shrink-0">
                <Calendar className="h-4 w-4 text-[#FF7A70]" />
                <span>Date:</span>
              </div>
              <Input
                type="date"
                className="w-38 sm:w-44 text-xs h-9 font-medium"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
              {selectedDate !== todayIST && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-[#FF7A70] hover:bg-[#FF7A70]/10 px-2 font-semibold"
                  onClick={() => setSelectedDate(todayIST)}
                >
                  Today
                </Button>
              )}
            </div>
          )}

          {/* 1-Month View Controls */}
          {viewMode === "monthly" && (
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700 shrink-0">
                <CalendarDays className="h-4 w-4 text-[#FF7A70]" />
                <span>Select Month:</span>
              </div>
              <Input
                type="month"
                className="w-38 sm:w-44 text-xs h-9 font-medium"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
              <Button
                variant={selectedMonth === currentMonthIST ? "default" : "outline"}
                size="sm"
                className={cn(
                  "h-8 text-xs px-2.5 font-semibold",
                  selectedMonth === currentMonthIST
                    ? "bg-[#FF7A70] hover:bg-[#FF6559] text-white"
                    : "text-neutral-700"
                )}
                onClick={handleSelectThisMonth}
              >
                This Month
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs px-2.5 font-semibold text-neutral-700"
                onClick={handleSelectPreviousMonth}
              >
                Previous Month
              </Button>
            </div>
          )}

          {/* Custom Date Range Controls */}
          {viewMode === "custom" && (
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700 shrink-0">
                <CalendarRange className="h-4 w-4 text-[#FF7A70]" />
                <span>From:</span>
              </div>
              <Input
                type="date"
                className="w-34 sm:w-38 text-xs h-9 font-medium"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
              />
              <span className="text-xs text-neutral-400 font-bold">To:</span>
              <Input
                type="date"
                className="w-34 sm:w-38 text-xs h-9 font-medium"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
              />
            </div>
          )}

          <div className="hidden sm:block h-6 w-px bg-neutral-200" />

          {/* Employee Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
            <Input
              placeholder={
                viewMode === "monthly"
                  ? "Search employee across month..."
                  : "Search employee by name or code..."
              }
              className="pl-9 pr-8 text-xs h-9 w-full"
              value={employeeSearch}
              onChange={(e) => setEmployeeSearch(e.target.value)}
            />
            {employeeSearch && (
              <button
                type="button"
                onClick={() => setEmployeeSearch("")}
                className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Filter className="h-3.5 w-3.5 text-neutral-400" />
            <select
              aria-label="Filter attendance by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="h-9 rounded-md border border-neutral-200 bg-white px-2.5 text-xs font-semibold text-neutral-700 shadow-2xs focus:border-[#FF7A70] focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="PRESENT">Present Only</option>
              <option value="LATE">Late Punches</option>
              <option value="HALF_DAY">Half Day</option>
              <option value="ABSENT">Absent / Not Checked In</option>
            </select>
          </div>
        </div>

        {/* Quick Count Indicators */}
        <div className="pt-2 border-t border-neutral-100 flex flex-wrap items-center gap-2 text-[11px] text-neutral-500">
          <span className="font-semibold text-neutral-800">
            {rows.length} {rows.length === 1 ? "Record" : "Records"}
          </span>
          <span>·</span>
          <span className="text-emerald-700 font-semibold">{summary.present} Present</span>
          <span>·</span>
          <span className="text-amber-700 font-semibold">{summary.late} Late</span>
          <span>·</span>
          <span className="text-amber-800 font-semibold">{summary.halfDay} Half Day</span>
          {viewMode === "daily" ? (
            <>
              <span>·</span>
              <span className="text-primary font-semibold">{summary.onDuty} On Duty</span>
              <span>·</span>
              <span className="text-neutral-500">{summary.absent} Not Checked In</span>
            </>
          ) : (
            <>
              <span>·</span>
              <span className="text-neutral-700 font-bold">{summary.totalHours} Total Hours Logged</span>
            </>
          )}
        </div>
      </div>

      {/* 3. MOBILE CARD VIEW (< md breakpoint, 100% responsive down to 360px) */}
      <div className="block md:hidden space-y-3.5">
        {isLoading && (
          <div className="py-12 text-center text-xs text-neutral-400 rounded-xl bg-white border border-neutral-200">
            Loading attendance records for {activePeriodLabel}...
          </div>
        )}

        {!isLoading && rows.length === 0 && (
          <div className="py-12 text-center text-xs text-neutral-500 rounded-xl bg-white border border-neutral-200 p-4">
            No attendance records found matching filters for {activePeriodLabel}.
          </div>
        )}

        {rows.map((row, index) => {
          const log = row.log;
          const hasCheckedIn = Boolean(log?.checkInTime);
          const hasCheckedOut = Boolean(log?.checkOutTime);
          const isAuto = Boolean(log?.checkOutTime && log.notes?.includes("Auto checked out"));
          const empName = fullName(row.employee.firstName, row.employee.lastName);
          const dateStr = formatDateIST(log?.date || selectedDate);

          const hasGps = log?.checkInLat != null && log?.checkInLng != null;
          const mapLat = log?.checkInLat ?? 0;
          const mapLng = log?.checkInLng ?? 0;
          const addressText = log?.checkInAddress || log?.checkOutAddress || "—";

          return (
            <div
              key={log?.id ?? `${row.employee.id}-${index}`}
              className="rounded-xl border border-neutral-200/90 bg-white p-3.5 space-y-3 shadow-2xs overflow-hidden"
            >
              {/* Card Header: Employee Name, Code & Status */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-neutral-900 text-xs sm:text-sm truncate">
                    {empName}
                  </p>
                  <p className="text-[11px] text-neutral-500 truncate mt-0.5">
                    {row.employee.employeeCode}
                    {row.employee.department?.name ? ` · ${row.employee.department.name}` : ""}
                  </p>
                </div>

                {/* Status Badge */}
                <div className="shrink-0">
                  {log?.status === "PRESENT" && (
                    <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                      Present
                    </span>
                  )}
                  {log?.status === "LATE" && (
                    <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200">
                      Late Punch
                    </span>
                  )}
                  {log?.status === "HALF_DAY" && (
                    <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-300">
                      Half Day
                    </span>
                  )}
                  {log?.status === "ON_LEAVE" && (
                    <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-primary border border-indigo-200">
                      On Leave
                    </span>
                  )}
                  {log?.status === "ABSENT" && (
                    <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-maroon border border-rose-200">
                      Absent
                    </span>
                  )}
                  {!log && (
                    <span className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-500 border border-neutral-200">
                      Not Checked In
                    </span>
                  )}
                </div>
              </div>

              {/* SECTION A: Clearly Separated Date and Timestamps in readable IST format */}
              <div className="rounded-lg bg-neutral-50 p-2.5 border border-neutral-100 space-y-2 text-xs">
                {/* Date */}
                <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-neutral-200/60">
                  <span className="text-[10px] uppercase font-bold text-neutral-400">Date</span>
                  <span className="font-bold text-neutral-900 text-xs">{dateStr}</span>
                </div>

                {/* Punch In */}
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] uppercase font-bold text-neutral-400">Punch In Time</span>
                  {hasCheckedIn ? (
                    <span className="font-semibold text-neutral-900 text-xs flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                      {formatDateTimeIST(log!.checkInTime)}
                    </span>
                  ) : (
                    <span className="text-neutral-400 font-medium">—</span>
                  )}
                </div>

                {/* Punch Out */}
                <div className="flex flex-col gap-0.5 pt-1.5 border-t border-neutral-200/60">
                  <span className="text-[10px] uppercase font-bold text-neutral-400">Punch Out Time</span>
                  {hasCheckedOut ? (
                    <div className="space-y-0.5">
                      <span className="font-semibold text-emerald-800 text-xs flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        {formatDateTimeIST(log!.checkOutTime)}
                      </span>
                      {isAuto && (
                        <span className="inline-block text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                          ⚡ Auto 7:00 PM
                        </span>
                      )}
                    </div>
                  ) : hasCheckedIn ? (
                    <span className="text-xs font-semibold text-primary">On Duty</span>
                  ) : (
                    <span className="text-neutral-400 font-medium">—</span>
                  )}
                </div>

                {/* Working Hours */}
                <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-neutral-200/60">
                  <span className="text-[10px] uppercase font-bold text-neutral-400">Working Hours</span>
                  <span className="font-bold text-xs text-neutral-900">
                    {log?.totalHours != null
                      ? `${log.totalHours} hrs`
                      : hasCheckedIn
                        ? "Active Shift"
                        : "—"}
                  </span>
                </div>
              </div>

              {/* SECTION B: Location & Google Map Display */}
              {hasCheckedIn && (
                <div className="space-y-2 pt-0.5">
                  {/* Location Address & Map Link Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 flex items-start gap-1.5 text-xs text-neutral-700">
                      <MapPin className="h-3.5 w-3.5 text-[#FF7A70] shrink-0 mt-0.5" />
                      <span className="break-words line-clamp-2 text-[11px]">{addressText}</span>
                    </div>

                    {hasGps && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setMapModalTarget({
                              employeeId: row.employee.id,
                              employeeName: empName,
                              date: parseDateParam(log?.date, selectedDate),
                            });
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-neutral-900 hover:bg-black px-2.5 py-1 rounded-md shrink-0 transition-colors shadow-2xs"
                        >
                          <MapPin className="h-3 w-3 text-[#1AB3B6]" />
                          <span>Map View</span>
                        </button>
                        <a
                          href={`https://www.google.com/maps?q=${mapLat},${mapLng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-[#FF7A70] bg-[#FF7A70]/10 hover:bg-[#FF7A70]/20 p-1.5 rounded-md shrink-0 transition-colors"
                          title="Open Google Maps"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Google Map View */}
                  {hasGps && (
                    <div className="w-full h-[160px] rounded-lg overflow-hidden border border-neutral-200/80 bg-neutral-100 shadow-2xs">
                      <iframe
                        title={`Location Map for ${empName}`}
                        src={`https://www.google.com/maps?q=${mapLat},${mapLng}&z=16&output=embed`}
                        className="w-full h-full border-0 pointer-events-none"
                        loading="lazy"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 4. DESKTOP TABLE VIEW (Horizontally scrollable container, page never scrolls sideways) */}
      <div className="hidden md:block overflow-x-auto w-full rounded-2xl border border-neutral-200/80 bg-white shadow-2xs">
        <Table>
          <TableHeader>
            <TableRow className="bg-neutral-50/90 border-b border-neutral-200">
              <TableHead className="w-[20%] min-w-[180px] font-bold text-neutral-700 text-xs">
                Employee Name
              </TableHead>
              <TableHead className="w-[12%] min-w-[110px] font-bold text-neutral-700 text-xs">
                Date
              </TableHead>
              <TableHead className="w-[13%] min-w-[120px] font-bold text-neutral-700 text-xs">
                Punch In time
              </TableHead>
              <TableHead className="w-[14%] min-w-[130px] font-bold text-neutral-700 text-xs">
                Punch Out time
              </TableHead>
              <TableHead className="w-[21%] min-w-[200px] font-bold text-neutral-700 text-xs">
                Location (map link)
              </TableHead>
              <TableHead className="w-[10%] min-w-[100px] font-bold text-neutral-700 text-xs">
                Status
              </TableHead>
              <TableHead className="w-[10%] min-w-[90px] font-bold text-neutral-700 text-xs">
                Working Hours
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="py-14 text-center text-xs text-neutral-400">
                  Loading attendance records for {activePeriodLabel}...
                </TableCell>
              </TableRow>
            )}

            {!isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-14 text-center text-xs text-neutral-500">
                  No employee attendance records match your search for {activePeriodLabel}.
                </TableCell>
              </TableRow>
            )}

            {rows.map((row, index) => {
              const log = row.log;
              const hasCheckedIn = Boolean(log?.checkInTime);
              const hasCheckedOut = Boolean(log?.checkOutTime);
              const isAuto = Boolean(log?.checkOutTime && log.notes?.includes("Auto checked out"));
              const empName = fullName(row.employee.firstName, row.employee.lastName);
              const dateStr = formatDateIST(log?.date || selectedDate);

              const hasGps = log?.checkInLat != null && log?.checkInLng != null;
              const mapLat = log?.checkInLat ?? 0;
              const mapLng = log?.checkInLng ?? 0;
              const addressText = log?.checkInAddress || log?.checkOutAddress || "—";

              return (
                <TableRow
                  key={log?.id ?? `${row.employee.id}-${index}`}
                  className="hover:bg-neutral-50/70 transition-colors border-b border-neutral-100"
                >
                  {/* 1. Employee Name */}
                  <TableCell className="align-middle">
                    <p className="font-bold text-neutral-900 text-xs">{empName}</p>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      {row.employee.employeeCode}
                      {row.employee.department?.name ? ` · ${row.employee.department.name}` : ""}
                    </p>
                  </TableCell>

                  {/* 2. Date */}
                  <TableCell className="align-middle whitespace-nowrap text-xs font-semibold text-neutral-800">
                    {dateStr}
                  </TableCell>

                  {/* 3. Punch In time */}
                  <TableCell className="align-middle whitespace-nowrap text-xs">
                    {hasCheckedIn ? (
                      <div className="flex items-center gap-1.5 font-medium text-neutral-900">
                        <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>{formatTimeIST(log!.checkInTime)}</span>
                      </div>
                    ) : (
                      <span className="text-neutral-400 font-medium">—</span>
                    )}
                  </TableCell>

                  {/* 4. Punch Out time */}
                  <TableCell className="align-middle whitespace-nowrap text-xs">
                    {hasCheckedOut ? (
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 font-medium text-neutral-900">
                          <Clock className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          <span>{formatTimeIST(log!.checkOutTime)}</span>
                        </div>
                        {isAuto && (
                          <span className="inline-block text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                            ⚡ Auto 7:00 PM
                          </span>
                        )}
                      </div>
                    ) : hasCheckedIn ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-primary border border-indigo-200">
                        On Duty
                      </span>
                    ) : (
                      <span className="text-neutral-400 font-medium">—</span>
                    )}
                  </TableCell>

                  {/* 5. Location (map link) */}
                  <TableCell className="align-middle text-xs">
                    {hasCheckedIn ? (
                      <div className="space-y-1">
                        <p className="text-neutral-700 text-xs line-clamp-2" title={addressText}>
                          {addressText}
                        </p>
                        {hasGps ? (
                          <div className="flex items-center gap-2 pt-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                setMapModalTarget({
                                  employeeId: row.employee.id,
                                  employeeName: empName,
                                  date: parseDateParam(log?.date, selectedDate),
                                });
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-neutral-800 hover:text-black bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 px-2 py-0.5 rounded shadow-2xs transition-colors"
                            >
                              <MapPin className="h-3 w-3 text-[#1AB3B6]" />
                              <span>Map View</span>
                            </button>
                            <a
                              href={`https://www.google.com/maps?q=${mapLat},${mapLng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#FF7A70] hover:underline"
                            >
                              <span>Google Maps</span>
                              <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-neutral-400 font-medium">—</span>
                    )}
                  </TableCell>

                  {/* 6. Status */}
                  <TableCell className="align-middle whitespace-nowrap">
                    {log?.status === "PRESENT" && (
                      <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                        Present
                      </span>
                    )}
                    {log?.status === "LATE" && (
                      <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
                        Late Punch
                      </span>
                    )}
                    {log?.status === "HALF_DAY" && (
                      <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 border border-amber-300">
                        Half Day
                      </span>
                    )}
                    {log?.status === "ON_LEAVE" && (
                      <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-primary border border-indigo-200">
                        On Leave
                      </span>
                    )}
                    {log?.status === "ABSENT" && (
                      <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-xs font-semibold text-maroon border border-rose-200">
                        Absent
                      </span>
                    )}
                    {!log && (
                      <span className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500 border border-neutral-200">
                        Not Checked In
                      </span>
                    )}
                  </TableCell>

                  {/* 7. Working Hours */}
                  <TableCell className="align-middle whitespace-nowrap text-xs font-semibold text-neutral-900">
                    {log?.totalHours != null ? (
                      `${log.totalHours} hrs`
                    ) : hasCheckedIn ? (
                      <span className="text-primary font-medium">On Duty</span>
                    ) : (
                      <span className="text-neutral-400 font-normal">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {mapModalTarget && (
        <KekaMapViewModal
          onClose={() => setMapModalTarget(null)}
          employeeId={mapModalTarget.employeeId}
          employeeName={mapModalTarget.employeeName}
          date={mapModalTarget.date}
        />
      )}
    </div>
  );
}
