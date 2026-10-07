"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Download,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Search,
  Filter,
  ArrowUpDown,
  Building,
  FileSpreadsheet,
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  Users,
  History,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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
import { canViewTeamAttendance, formatTimeIST, formatDateIST } from "@realty-smartz/shared";
import type { Role, AttendanceStatus } from "@realty-smartz/shared";
import { LocationMap } from "@/components/LocationMap";

type ViewTab = "all-entries" | "daily-roster";
type RangePreset = "all" | "week" | "today" | "month" | "custom";

export default function TeamAttendancePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const role = (session?.user?.role ?? "EMPLOYEE") as Role;
  const allowed = canViewTeamAttendance(role);

  const [activeTab, setActiveTab] = useState<ViewTab>("all-entries");

  // State for All Entries Tab
  const [rangePreset, setRangePreset] = useState<RangePreset>("week");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | "">("");
  const [outsideOnly, setOutsideOnly] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 40;

  // State for Daily Roster Tab
  const [dailyDate, setDailyDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dailyGeofenceFilter, setDailyGeofenceFilter] = useState<"ALL" | "INSIDE" | "OUTSIDE" | "NOT_CHECKED_IN">("ALL");

  // Map popup state
  const [selectedMapLog, setSelectedMapLog] = useState<{
    lat: number;
    lng: number;
    label: string;
    employeeName: string;
  } | null>(null);

  const [googleSheetResult, setGoogleSheetResult] = useState<string | null>(null);

  const { data: departments } = trpc.department.list.useQuery(undefined, {
    enabled: allowed,
  });

  // Query 1: All Entries across date range
  const {
    data: allEntriesData,
    isLoading: isAllEntriesLoading,
    refetch: refetchAllEntries,
  } = trpc.attendance.allEntries.useQuery(
    {
      range: rangePreset,
      startDate: rangePreset === "custom" && customStartDate ? new Date(customStartDate) : undefined,
      endDate: rangePreset === "custom" && customEndDate ? new Date(customEndDate) : undefined,
      departmentId: departmentId || undefined,
      status: statusFilter || undefined,
      outsideGeofenceOnly: outsideOnly ? true : undefined,
      search: searchQuery.trim() || undefined,
      page,
      pageSize,
    },
    { enabled: allowed && activeTab === "all-entries" }
  );

  // Query 2: Daily Single-Day Team Roster
  const {
    data: dailyTeamData,
    isLoading: isDailyLoading,
    refetch: refetchDaily,
  } = trpc.attendance.team.useQuery(
    {
      date: new Date(dailyDate),
      departmentId: departmentId || undefined,
      outsideGeofenceOnly: dailyGeofenceFilter === "OUTSIDE" ? true : undefined,
    },
    { enabled: allowed && activeTab === "daily-roster" }
  );

  const syncGoogleSheet = trpc.googleSheets.syncDailyReport.useMutation({
    onSuccess: (res) => {
      setGoogleSheetResult(
        `Attendance for "${dailyDate}" synced to Google Sheet successfully (${res.rowCount} records).`
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

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [rangePreset, customStartDate, customEndDate, searchQuery, departmentId, statusFilter, outsideOnly]);

  // Export CSV for All Entries
  function exportAllEntriesCsv() {
    if (!allEntriesData?.entries) return;
    const header = [
      "Date",
      "Employee Code",
      "Employee Name",
      "Department",
      "Designation",
      "Status",
      "Punch In",
      "Punch Out",
      "Total Hours",
      "Geofence Status",
      "Address",
      "Notes",
    ];
    const lines = allEntriesData.entries.map((entry) => {
      const isAuto = entry.checkOutTime && entry.notes?.includes("Auto checked out");
      return [
        formatDateIST(entry.date),
        entry.employee.employeeCode,
        fullName(entry.employee.firstName, entry.employee.lastName),
        entry.employee.department?.name ?? "—",
        entry.employee.designation?.title ?? "—",
        entry.status,
        entry.checkInTime ? formatTimeIST(entry.checkInTime) : "—",
        entry.checkOutTime
          ? `${formatTimeIST(entry.checkOutTime)}${isAuto ? " (Auto 7 PM)" : ""}`
          : "—",
        entry.totalHours != null ? `${entry.totalHours} hrs` : "—",
        entry.checkInTime
          ? entry.withinGeofence
            ? "Inside Office"
            : "Outside Geofence"
          : "—",
        ((entry.checkInAddress ?? entry.checkOutAddress) || "—").replace(/sunbreeze/gi, "Realty Smartz Private Limited"),
        entry.notes ?? "—",
      ].map((c) => `"${String(c).replace(/"/g, '""')}"`);
    });

    const blob = new Blob([[header.join(","), ...lines.map((l) => l.join(","))].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `realty-smartz-attendance-${rangePreset}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Daily roster rows
  const rawDailyRows = useMemo(() => dailyTeamData?.rows ?? [], [dailyTeamData]);
  const filteredDailyRows = useMemo(() => {
    let result = [...rawDailyRows];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (r) =>
          r.employee.firstName.toLowerCase().includes(q) ||
          r.employee.lastName.toLowerCase().includes(q) ||
          r.employee.employeeCode.toLowerCase().includes(q) ||
          r.employee.department?.name?.toLowerCase().includes(q)
      );
    }
    if (dailyGeofenceFilter === "INSIDE") {
      result = result.filter((r) => r.log?.checkInTime && r.log.withinGeofence);
    } else if (dailyGeofenceFilter === "OUTSIDE") {
      result = result.filter((r) => r.log?.checkInTime && !r.log.withinGeofence);
    } else if (dailyGeofenceFilter === "NOT_CHECKED_IN") {
      result = result.filter((r) => !r.log?.checkInTime);
    }
    return result;
  }, [rawDailyRows, searchQuery, dailyGeofenceFilter]);

  if (status === "loading" || !allowed) {
    return (
      <div className="flex items-center justify-center py-20 text-xs text-neutral-500">
        Loading attendance portal...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* 1. TOP HEADER */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
            <span>Realty Smartz Private Limited</span>
            <span>·</span>
            <span className="text-[#FF7A70] font-bold">Attendance & Shifts</span>
          </div>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900">
            Attendance Administration
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-neutral-500">
            View all attendance logs, 7-day shifts, 7:00 PM auto punch-out records, and geofence verification
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeTab === "daily-roster" ? (
            <Button
              variant="outline"
              className="gap-2 text-xs border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-semibold shadow-2xs"
              disabled={syncGoogleSheet.isLoading}
              onClick={() => syncGoogleSheet.mutate({ date: dailyDate })}
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              {syncGoogleSheet.isLoading ? "Syncing..." : `Sync "${dailyDate}" to Google Sheet`}
            </Button>
          ) : (
            <Button
              variant="outline"
              className="gap-2 text-xs border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-semibold shadow-2xs"
              onClick={() => {
                setActiveTab("daily-roster");
                syncGoogleSheet.mutate({ date: dailyDate });
              }}
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              Sync Today to Google Sheet
            </Button>
          )}

          <Button
            variant="outline"
            className="gap-2 text-xs shadow-2xs"
            onClick={exportAllEntriesCsv}
            disabled={!allEntriesData?.entries?.length}
          >
            <Download className="h-4 w-4 text-neutral-500" />
            Export CSV
          </Button>
        </div>
      </div>

      {googleSheetResult && (
        <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900 font-medium shadow-2xs">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{googleSheetResult}</span>
          </div>
          <button
            type="button"
            onClick={() => setGoogleSheetResult(null)}
            className="text-neutral-400 hover:text-neutral-600"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. DUAL-MODE VIEW TABS */}
      <div className="flex border-b border-neutral-200 text-xs sm:text-sm font-medium overflow-x-auto scrollbar-none touch-pan-x min-w-0">
        <button
          type="button"
          onClick={() => setActiveTab("all-entries")}
          className={cn(
            "flex items-center gap-1.5 sm:gap-2 border-b-2 px-3 sm:px-4 py-2.5 font-bold transition-all shrink-0",
            activeTab === "all-entries"
              ? "border-[#FF7A70] text-[#FF7A70]"
              : "border-transparent text-neutral-500 hover:text-neutral-800 hover:border-neutral-300"
          )}
        >
          <History className="h-4 w-4" />
          <span>All Attendance Logs</span>
          <span className="hidden sm:inline font-normal text-xs text-neutral-400">(History & Range)</span>
          {allEntriesData?.totalCount != null && (
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 font-semibold">
              {allEntriesData.totalCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("daily-roster")}
          className={cn(
            "flex items-center gap-1.5 sm:gap-2 border-b-2 px-3 sm:px-4 py-2.5 font-bold transition-all shrink-0",
            activeTab === "daily-roster"
              ? "border-[#FF7A70] text-[#FF7A70]"
              : "border-transparent text-neutral-500 hover:text-neutral-800 hover:border-neutral-300"
          )}
        >
          <Users className="h-4 w-4" />
          <span>Daily Office Roster</span>
          <span className="hidden sm:inline font-normal text-xs text-neutral-400">(Single Date)</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: ALL ATTENDANCE LOGS (History, Date Range, 1-Week, Pagination) */}
      {/* ========================================================================= */}
      {activeTab === "all-entries" && (
        <div className="space-y-4">
          {/* Quick Date Range Pills */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-neutral-500 mr-1">Time Period:</span>
            {(
              [
                { id: "all", label: "All Records (All Time)" },
                { id: "week", label: "Past 7 Days (1 Week)" },
                { id: "today", label: "Today Only" },
                { id: "month", label: "This Month" },
                { id: "custom", label: "Custom Date Range" },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setRangePreset(item.id)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 font-semibold transition-all shadow-2xs",
                  rangePreset === item.id
                    ? "bg-gradient-to-r from-[#FF7A70] to-[#FFA07A] text-white font-bold"
                    : "border border-neutral-200/80 bg-white text-neutral-700 hover:bg-neutral-50"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Custom Date Range Pickers (Visible if custom selected) */}
          {rangePreset === "custom" && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200/80 bg-white p-3 text-xs shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-neutral-600">From:</span>
                <Input
                  type="date"
                  className="w-36 text-xs h-8"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-neutral-600">To:</span>
                <Input
                  type="date"
                  className="w-36 text-xs h-8"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Filter Toolbar */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200/80 bg-white p-3.5 shadow-2xs">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
              <Input
                placeholder="Search employee by name or code..."
                className="pl-9 text-xs"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Department */}
            <Select
              className="w-44 text-xs"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
            >
              <option value="">All Departments</option>
              {departments?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>

            {/* Attendance Status */}
            <Select
              className="w-40 text-xs"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as AttendanceStatus | "")}
            >
              <option value="">All Statuses</option>
              <option value="PRESENT">Present</option>
              <option value="LATE">Late Punch</option>
              <option value="HALF_DAY">Half Day (&lt; 4 hrs)</option>
              <option value="ABSENT">Absent</option>
              <option value="ON_LEAVE">On Leave</option>
            </Select>

            {/* Geofence Filter Pill */}
            <button
              type="button"
              onClick={() => setOutsideOnly(!outsideOnly)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-all",
                outsideOnly
                  ? "border-amber-400 bg-amber-50 text-amber-900"
                  : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
              )}
            >
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
              <span>Flagged Outside Geofence</span>
            </button>
          </div>

          {/* KPI Summary Strip */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-6 text-xs">
            <div className="rounded-xl border border-neutral-200/80 bg-white p-3 shadow-2xs">
              <p className="text-[11px] font-medium text-neutral-500">Total Entries</p>
              <p className="mt-1 font-display text-xl font-bold text-neutral-900">
                {allEntriesData?.totalCount ?? 0}
              </p>
            </div>
            <div className="rounded-xl border border-neutral-200/80 bg-white p-3 shadow-2xs">
              <p className="text-[11px] font-medium text-emerald-700">Present (On-Duty)</p>
              <p className="mt-1 font-display text-xl font-bold text-emerald-700">
                {allEntriesData?.summary?.presentCount ?? 0}
              </p>
            </div>
            <div className="rounded-xl border border-neutral-200/80 bg-white p-3 shadow-2xs">
              <p className="text-[11px] font-medium text-amber-700">Late Punches</p>
              <p className="mt-1 font-display text-xl font-bold text-amber-700">
                {allEntriesData?.summary?.lateCount ?? 0}
              </p>
            </div>
            <div className="rounded-xl border border-neutral-200/80 bg-white p-3 shadow-2xs">
              <p className="text-[11px] font-medium text-amber-800">Half Days</p>
              <p className="mt-1 font-display text-xl font-bold text-amber-800">
                {allEntriesData?.summary?.halfDayCount ?? 0}
              </p>
            </div>
            <div className="rounded-xl border border-neutral-200/80 bg-white p-3 shadow-2xs">
              <p className="text-[11px] font-medium text-maroon">Absent</p>
              <p className="mt-1 font-display text-xl font-bold text-maroon">
                {allEntriesData?.summary?.absentCount ?? 0}
              </p>
            </div>
            <div className="rounded-xl border border-neutral-200/80 bg-white p-3 shadow-2xs">
              <p className="text-[11px] font-medium text-primary">Avg Shift Duration</p>
              <p className="mt-1 font-display text-xl font-bold text-primary">
                {allEntriesData?.summary?.avgHours ? `${allEntriesData.summary.avgHours} hrs` : "—"}
              </p>
            </div>
          </div>

          {/* ALL ENTRIES CARDS & TABLE */}
          <div className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-sm">
            {/* MOBILE ENTRIES CARD VIEW (Phones & Tablets) */}
            <div className="block lg:hidden divide-y divide-neutral-100">
              {isAllEntriesLoading && (
                <div className="py-8 text-center text-xs text-neutral-400">Loading all attendance logs...</div>
              )}
              {!isAllEntriesLoading && allEntriesData?.entries.length === 0 && (
                <div className="py-8 text-center text-xs text-neutral-500">No attendance records match the selected filters.</div>
              )}
              {allEntriesData?.entries.map((entry) => {
                const isCheckedIn = Boolean(entry.checkInTime);
                const isCheckedOut = Boolean(entry.checkOutTime);
                const isAutoCheckedOut = Boolean(entry.checkOutTime && entry.notes?.includes("Auto checked out"));

                return (
                  <div key={entry.id} className="p-3.5 space-y-2.5 hover:bg-neutral-50/50 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-neutral-900 text-xs truncate">
                          {fullName(entry.employee.firstName, entry.employee.lastName)}
                        </p>
                        <p className="text-[11px] text-neutral-500 truncate">
                          {entry.employee.employeeCode} · {entry.employee.department?.name ?? "General"}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-[10px] text-neutral-400 font-semibold">{formatDateIST(entry.date)}</span>
                        {entry.status === "PRESENT" && (
                          <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                            Present
                          </span>
                        )}
                        {entry.status === "LATE" && (
                          <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200">
                            Late Punch
                          </span>
                        )}
                        {entry.status === "HALF_DAY" && (
                          <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 border border-amber-300">
                            Half Day
                          </span>
                        )}
                        {entry.status === "ON_LEAVE" && (
                          <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-primary border border-indigo-200">
                            On Leave
                          </span>
                        )}
                        {entry.status === "ABSENT" && (
                          <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-maroon border border-rose-200">
                            Absent
                          </span>
                        )}
                      </div>
                    </div>

                    {isCheckedIn && (
                      <div className="grid grid-cols-3 gap-2 rounded-xl bg-neutral-50 p-2.5 text-xs border border-neutral-200/60">
                        <div>
                          <span className="text-[9px] uppercase font-bold tracking-wider text-neutral-400 block">Punch In</span>
                          <span className="font-semibold text-neutral-900 text-xs flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3 text-primary" />
                            {formatTimeIST(entry.checkInTime)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase font-bold tracking-wider text-neutral-400 block">Punch Out</span>
                          <span className="font-semibold text-neutral-900 text-xs flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3 text-emerald-600" />
                            {isCheckedOut ? formatTimeIST(entry.checkOutTime) : "On Duty"}
                          </span>
                          {isAutoCheckedOut && (
                            <span className="text-[9px] font-bold text-emerald-700 block">⚡ Auto 7 PM</span>
                          )}
                        </div>
                        <div>
                          <span className="text-[9px] uppercase font-bold tracking-wider text-neutral-400 block">Hours</span>
                          <span className="font-bold text-xs mt-0.5 block text-neutral-800">
                            {entry.totalHours != null ? `${entry.totalHours} hrs` : "—"}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs pt-0.5">
                      {isCheckedIn ? (
                        <span className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          entry.withinGeofence
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-amber-50 text-amber-800 border border-amber-300"
                        )}>
                          {entry.withinGeofence ? (
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          ) : (
                            <AlertTriangle className="h-3 w-3 text-amber-600" />
                          )}
                          <span>{entry.withinGeofence ? "In Premises" : "Outside Geofence"}</span>
                        </span>
                      ) : <span />}

                      {entry.checkInLat != null && entry.checkInLng != null && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[11px] px-2 gap-1 border-neutral-200"
                          onClick={() => setSelectedMapLog({
                            lat: entry.checkInLat!,
                            lng: entry.checkInLng!,
                            label: (entry.checkInAddress || "Realty Smartz Private Limited HQ").replace(/sunbreeze/gi, "Realty Smartz Private Limited"),
                            employeeName: fullName(entry.employee.firstName, entry.employee.lastName),
                          })}
                        >
                          <MapPin className="h-3 w-3 text-primary" />
                          <span>View Map</span>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* DESKTOP TABLE */}
            <div className="hidden lg:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-neutral-50/80">
                    <TableHead>Date</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Punch In (IST)</TableHead>
                    <TableHead>Punch Out (IST)</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Geofence Status</TableHead>
                    <TableHead>Location / Pin</TableHead>
                    <TableHead>Notes / Shift Audit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isAllEntriesLoading && (
                    <TableRow>
                      <TableCell colSpan={10} className="py-12 text-center text-xs text-neutral-400">
                        Loading all attendance logs...
                      </TableCell>
                    </TableRow>
                  )}
                  {!isAllEntriesLoading && allEntriesData?.entries.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className="py-12 text-center text-xs text-neutral-500">
                        No attendance records match the selected filters.
                      </TableCell>
                    </TableRow>
                  )}
                  {allEntriesData?.entries.map((entry) => {
                    const isCheckedIn = Boolean(entry.checkInTime);
                    const isCheckedOut = Boolean(entry.checkOutTime);
                    const isAutoCheckedOut = Boolean(
                      entry.checkOutTime && entry.notes?.includes("Auto checked out")
                    );

                    return (
                      <TableRow key={entry.id} className="hover:bg-neutral-50/70 transition-colors">
                        {/* Date */}
                        <TableCell className="whitespace-nowrap text-xs font-semibold text-neutral-900">
                          {formatDateIST(entry.date)}
                        </TableCell>

                        {/* Employee */}
                        <TableCell className="whitespace-nowrap">
                          <p className="font-semibold text-neutral-900 text-xs">
                            {fullName(entry.employee.firstName, entry.employee.lastName)}
                          </p>
                          <p className="text-[11px] text-neutral-500">
                            {entry.employee.employeeCode}
                          </p>
                        </TableCell>

                        {/* Department */}
                        <TableCell className="whitespace-nowrap text-xs text-neutral-600">
                          <p>{entry.employee.department?.name ?? "—"}</p>
                          <p className="text-[10px] text-neutral-400">
                            {entry.employee.designation?.title ?? ""}
                          </p>
                        </TableCell>

                        {/* Status */}
                        <TableCell className="whitespace-nowrap">
                          {entry.status === "PRESENT" && (
                            <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                              Present
                            </span>
                          )}
                          {entry.status === "LATE" && (
                            <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
                              Late Punch
                            </span>
                          )}
                          {entry.status === "HALF_DAY" && (
                            <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 border border-amber-300">
                              Half Day
                            </span>
                          )}
                          {entry.status === "ON_LEAVE" && (
                            <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-primary border border-indigo-200">
                              On Leave
                            </span>
                          )}
                          {entry.status === "ABSENT" && (
                            <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-xs font-semibold text-maroon border border-rose-200">
                              Absent
                            </span>
                          )}
                        </TableCell>

                        {/* Punch In */}
                        <TableCell className="whitespace-nowrap text-xs text-neutral-900">
                          {isCheckedIn ? (
                            <div className="flex items-center gap-1.5 font-medium">
                              <Clock className="h-3.5 w-3.5 text-primary" />
                              <span>{formatTimeIST(entry.checkInTime)}</span>
                            </div>
                          ) : (
                            <span className="text-neutral-400">—</span>
                          )}
                        </TableCell>

                        {/* Punch Out */}
                        <TableCell className="whitespace-nowrap text-xs text-neutral-900">
                          {isCheckedOut ? (
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5 font-medium">
                                <Clock className="h-3.5 w-3.5 text-emerald-600" />
                                <span>{formatTimeIST(entry.checkOutTime)}</span>
                              </div>
                              {isAutoCheckedOut && (
                                <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.2 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                                  ⚡ Auto 7:00 PM
                                </span>
                              )}
                            </div>
                          ) : isCheckedIn ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-primary border border-indigo-200">
                              On Duty (Auto 7 PM)
                            </span>
                          ) : (
                            <span className="text-neutral-400">—</span>
                          )}
                        </TableCell>

                        {/* Total Hours */}
                        <TableCell className="whitespace-nowrap text-xs font-semibold text-neutral-800">
                          {entry.totalHours != null ? `${entry.totalHours} hrs` : "—"}
                        </TableCell>

                        {/* Geofence Status */}
                        <TableCell className="whitespace-nowrap">
                          {!isCheckedIn ? (
                            <span className="text-neutral-400 text-xs">—</span>
                          ) : entry.withinGeofence ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              <span>Inside Office</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-300">
                              <AlertTriangle className="h-3 w-3 text-amber-600" />
                              <span>Outside Geofence</span>
                            </span>
                          )}
                        </TableCell>

                        {/* Location / Pin */}
                        <TableCell className="whitespace-nowrap">
                          {entry.checkInLat != null && entry.checkInLng != null ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs px-2.5 gap-1 border-neutral-200 text-neutral-700 hover:text-primary"
                              onClick={() =>
                                setSelectedMapLog({
                                  lat: entry.checkInLat!,
                                  lng: entry.checkInLng!,
                                  label: (entry.checkInAddress || "Realty Smartz Private Limited HQ").replace(/sunbreeze/gi, "Realty Smartz Private Limited"),
                                  employeeName: fullName(entry.employee.firstName, entry.employee.lastName),
                                })
                              }
                            >
                              <MapPin className="h-3 w-3 text-neutral-400" />
                              <span>Map Pin</span>
                            </Button>
                          ) : (
                            <span className="text-xs text-neutral-400">—</span>
                          )}
                        </TableCell>

                        {/* Notes */}
                        <TableCell className="text-xs text-neutral-500 max-w-[200px] truncate" title={entry.notes || ""}>
                          {entry.notes || "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Bar */}
            {allEntriesData && allEntriesData.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-neutral-200/80 px-4 py-3 text-xs bg-neutral-50/50">
                <span className="text-neutral-500">
                  Showing page {allEntriesData.page} of {allEntriesData.totalPages} ({allEntriesData.totalCount} total entries)
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1"
                    disabled={page >= allEntriesData.totalPages}
                    onClick={() => setPage((p) => Math.min(allEntriesData.totalPages, p + 1))}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DAILY OFFICE ROSTER (Single Day) */}
      {/* ========================================================================= */}
      {activeTab === "daily-roster" && (
        <div className="space-y-4">
          {/* Quick Filter Pills */}
          <div className="flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              onClick={() => setDailyGeofenceFilter("ALL")}
              className={cn(
                "rounded-full px-3.5 py-1.5 font-semibold transition-all",
                dailyGeofenceFilter === "ALL"
                  ? "bg-gradient-to-r from-[#FF7A70] to-[#FFA07A] text-white shadow-xs font-bold"
                  : "border border-neutral-200/80 bg-white text-neutral-700 hover:bg-neutral-50"
              )}
            >
              All Members ({rawDailyRows.length})
            </button>
            <button
              type="button"
              onClick={() => setDailyGeofenceFilter("INSIDE")}
              className={cn(
                "rounded-full px-3.5 py-1.5 font-semibold transition-all",
                dailyGeofenceFilter === "INSIDE"
                  ? "bg-emerald-600 text-white shadow-xs font-bold"
                  : "border border-neutral-200/80 bg-white text-emerald-700 hover:bg-neutral-50"
              )}
            >
              Within Premises ({rawDailyRows.filter((r) => r.log?.checkInTime && r.log.withinGeofence).length})
            </button>
            <button
              type="button"
              onClick={() => setDailyGeofenceFilter("OUTSIDE")}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-semibold transition-all",
                dailyGeofenceFilter === "OUTSIDE"
                  ? "bg-amber-600 text-white shadow-xs font-bold"
                  : "border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
              )}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Flagged Outside ({rawDailyRows.filter((r) => r.log?.checkInTime && !r.log.withinGeofence).length})</span>
            </button>
            <button
              type="button"
              onClick={() => setDailyGeofenceFilter("NOT_CHECKED_IN")}
              className={cn(
                "rounded-full px-3.5 py-1.5 font-semibold transition-all",
                dailyGeofenceFilter === "NOT_CHECKED_IN"
                  ? "bg-neutral-800 text-white shadow-xs font-bold"
                  : "border border-neutral-200/80 bg-white text-neutral-600 hover:bg-neutral-50"
              )}
            >
              Not Checked In ({rawDailyRows.filter((r) => !r.log?.checkInTime).length})
            </button>
          </div>

          {/* Daily Filter Toolbar */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200/80 bg-white p-3.5 shadow-2xs">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
              <Input
                placeholder="Search employee by name or code..."
                className="pl-9 text-xs"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <Input
              type="date"
              className="w-40 text-xs"
              value={dailyDate}
              onChange={(e) => setDailyDate(e.target.value)}
            />

            <Select
              className="w-48 text-xs"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
            >
              <option value="">All Departments</option>
              {departments?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>

          {/* Daily Records Table */}
          <div className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-sm">
            {/* MOBILE CARDS VIEW */}
            <div className="block lg:hidden divide-y divide-neutral-100">
              {isDailyLoading && (
                <div className="py-8 text-center text-xs text-neutral-400">
                  Loading attendance records for {dailyDate}...
                </div>
              )}
              {!isDailyLoading && filteredDailyRows.length === 0 && (
                <div className="py-8 text-center text-xs text-neutral-500">
                  No attendance records match your search or filter for {dailyDate}.
                </div>
              )}
              {filteredDailyRows.map((r) => {
                const log = r.log;
                const hasCheckedIn = Boolean(log?.checkInTime);
                const isCheckedOut = Boolean(log?.checkOutTime);
                const isAuto = Boolean(log?.checkOutTime && log.notes?.includes("Auto checked out"));

                return (
                  <div key={r.employee.id} className="p-4 space-y-3 bg-white hover:bg-neutral-50/50 transition-colors">
                    {/* Header: Name + Code + Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-neutral-900 text-sm truncate">
                          {fullName(r.employee.firstName, r.employee.lastName)}
                        </p>
                        <p className="text-[11px] text-neutral-500 truncate">
                          {r.employee.employeeCode} {r.employee.department?.name ? `• ${r.employee.department.name}` : ""}
                        </p>
                      </div>

                      <div className="shrink-0">
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
                        {(!log || log.status === "ABSENT") && (
                          <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-xs font-semibold text-maroon border border-rose-200">
                            Absent
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Punch Times & Total Hours */}
                    <div className="grid grid-cols-2 gap-2 text-xs bg-neutral-50/80 p-2.5 rounded-xl border border-neutral-100">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-neutral-400 block mb-0.5">Punch In</span>
                        {hasCheckedIn ? (
                          <div className="flex items-center gap-1 font-semibold text-neutral-800">
                            <Clock className="h-3 w-3 text-primary" />
                            <span>{formatTimeIST(log!.checkInTime)}</span>
                          </div>
                        ) : (
                          <span className="text-neutral-400 font-medium">—</span>
                        )}
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-bold text-neutral-400 block mb-0.5">Punch Out</span>
                        {isCheckedOut ? (
                          <div>
                            <div className="flex items-center gap-1 font-semibold text-emerald-700">
                              <Clock className="h-3 w-3 text-emerald-600" />
                              <span>{formatTimeIST(log!.checkOutTime)}</span>
                            </div>
                            {isAuto && (
                              <span className="inline-block text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 rounded border border-emerald-200 mt-0.5">
                                ⚡ Auto 7:00 PM
                              </span>
                            )}
                          </div>
                        ) : hasCheckedIn ? (
                          <span className="text-[11px] font-semibold text-primary">On Duty</span>
                        ) : (
                          <span className="text-neutral-400 font-medium">—</span>
                        )}
                      </div>
                    </div>

                    {/* Geofence & Location */}
                    <div className="flex items-center justify-between text-xs pt-0.5">
                      {!hasCheckedIn ? (
                        <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-500">
                          Not Checked In
                        </span>
                      ) : log?.withinGeofence ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          <span>In Premises</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 border border-amber-300">
                          <AlertTriangle className="h-3 w-3 text-amber-600" />
                          <span>Outside Geofence</span>
                        </span>
                      )}

                      <div className="flex items-center gap-2">
                        {log?.totalHours != null && (
                          <span className="text-xs font-bold text-neutral-700 bg-neutral-100 px-2 py-0.5 rounded-md">
                            {log.totalHours} hrs
                          </span>
                        )}

                        {log?.checkInLat != null && log?.checkInLng != null && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[11px] px-2 gap-1 border-neutral-200"
                            onClick={() =>
                              setSelectedMapLog({
                                lat: log.checkInLat!,
                                lng: log.checkInLng!,
                                label: (log.checkInAddress || "Realty Smartz Private Limited HQ").replace(/sunbreeze/gi, "Realty Smartz Private Limited"),
                                employeeName: fullName(r.employee.firstName, r.employee.lastName),
                              })
                            }
                          >
                            <MapPin className="h-3 w-3 text-primary" />
                            <span>View Pin</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* DESKTOP TABLE */}
            <div className="hidden lg:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-neutral-50/80">
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Punch In (IST)</TableHead>
                    <TableHead>Punch Out (IST)</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Geofence Status</TableHead>
                    <TableHead>Location / Pin</TableHead>
                  </TableRow>
                </TableHeader>
              <TableBody>
                {isDailyLoading && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-xs text-neutral-500">
                      Loading attendance records for {dailyDate}...
                    </TableCell>
                  </TableRow>
                )}
                {!isDailyLoading && filteredDailyRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-xs text-neutral-500">
                      No attendance records match your search or filter for {dailyDate}.
                    </TableCell>
                  </TableRow>
                )}
                {filteredDailyRows.map((r) => {
                  const log = r.log;
                  const hasCheckedIn = Boolean(log?.checkInTime);
                  const isCheckedOut = Boolean(log?.checkOutTime);
                  const isAuto = Boolean(log?.checkOutTime && log.notes?.includes("Auto checked out"));

                  return (
                    <TableRow key={r.employee.id} className="hover:bg-neutral-50/70 transition-colors">
                      <TableCell>
                        <p className="font-semibold text-neutral-900 text-xs">
                          {fullName(r.employee.firstName, r.employee.lastName)}
                        </p>
                        <p className="text-[11px] text-neutral-500">
                          {r.employee.employeeCode}
                        </p>
                      </TableCell>

                      <TableCell className="text-xs text-neutral-600">
                        {r.employee.department?.name ?? "—"}
                      </TableCell>

                      <TableCell>
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
                        {(!log || log.status === "ABSENT") && (
                          <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-xs font-semibold text-maroon border border-rose-200">
                            Absent
                          </span>
                        )}
                      </TableCell>

                      {/* Punch In */}
                      <TableCell className="text-xs text-neutral-900">
                        {hasCheckedIn ? (
                          <div className="flex items-center gap-1.5 font-medium">
                            <Clock className="h-3.5 w-3.5 text-primary" />
                            <span>{formatTimeIST(log!.checkInTime)}</span>
                          </div>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </TableCell>

                      {/* Punch Out */}
                      <TableCell className="text-xs text-neutral-900">
                        {isCheckedOut ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 font-medium">
                              <Clock className="h-3.5 w-3.5 text-emerald-600" />
                              <span>{formatTimeIST(log!.checkOutTime)}</span>
                            </div>
                            {isAuto && (
                              <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.2 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                                ⚡ Auto 7:00 PM
                              </span>
                            )}
                          </div>
                        ) : hasCheckedIn ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-primary border border-indigo-200">
                            On Duty (Auto 7 PM)
                          </span>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </TableCell>

                      {/* Hours */}
                      <TableCell className="text-xs font-semibold text-neutral-800">
                        {log?.totalHours != null ? `${log.totalHours} hrs` : "—"}
                      </TableCell>

                      {/* Geofence Status */}
                      <TableCell>
                        {!hasCheckedIn ? (
                          <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-medium text-neutral-500">
                            Not Checked In
                          </span>
                        ) : log?.withinGeofence ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                            <span>Inside Premises</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-300">
                            <AlertTriangle className="h-3 w-3 text-amber-600" />
                            <span>Outside Geofence</span>
                          </span>
                        )}
                      </TableCell>

                      {/* Location & Map Toggle */}
                      <TableCell>
                        {log?.checkInLat != null && log?.checkInLng != null ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs px-2.5 gap-1 border-neutral-200 text-neutral-700 hover:text-primary"
                            onClick={() =>
                              setSelectedMapLog({
                                lat: log.checkInLat!,
                                lng: log.checkInLng!,
                                label: (log.checkInAddress || "Realty Smartz Private Limited HQ").replace(/sunbreeze/gi, "Realty Smartz Private Limited"),
                                employeeName: fullName(r.employee.firstName, r.employee.lastName),
                              })
                            }
                          >
                            <MapPin className="h-3 w-3 text-neutral-400" />
                            <span>View Pin</span>
                          </Button>
                        ) : (
                          <span className="text-xs text-neutral-400">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          </div>
        </div>
      )}

      {/* Expanded Map Modal / Bottom Sheet */}
      {selectedMapLog && (
        <Card className="border border-neutral-200 bg-white p-4 shadow-lg rounded-2xl animate-in fade-in duration-200">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-[#FF7A70]" />
              <p className="text-xs font-bold text-neutral-900">
                GPS Punch Coordinates: {selectedMapLog.employeeName}
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => setSelectedMapLog(null)}
            >
              ✕ Dismiss
            </Button>
          </div>
          <LocationMap
            lat={selectedMapLog.lat}
            lng={selectedMapLog.lng}
            label={`${selectedMapLog.employeeName} — ${selectedMapLog.label}`}
            height={240}
          />
        </Card>
      )}
    </div>
  );
}
