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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { fullName } from "@/lib/utils";
import { canViewTeamAttendance } from "@realty-smartz/shared";
import type { Role } from "@realty-smartz/shared";
import { LocationMap } from "@/components/LocationMap";

export default function TeamAttendancePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const role = (session?.user?.role ?? "EMPLOYEE") as Role;
  const allowed = canViewTeamAttendance(role);

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [departmentId, setDepartmentId] = useState("");
  const [geofenceFilter, setGeofenceFilter] = useState<"ALL" | "INSIDE" | "OUTSIDE" | "NOT_CHECKED_IN">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<"name" | "status" | "geofence">("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [mapEmployeeId, setMapEmployeeId] = useState<string | null>(null);

  const { data: departments } = trpc.department.list.useQuery(undefined, {
    enabled: allowed,
  });
  const { data, isLoading } = trpc.attendance.team.useQuery(
    {
      date: new Date(date),
      departmentId: departmentId || undefined,
      outsideGeofenceOnly: geofenceFilter === "OUTSIDE" ? true : undefined,
    },
    { enabled: allowed }
  );

  const [googleSheetResult, setGoogleSheetResult] = useState<string | null>(null);

  const syncGoogleSheet = trpc.googleSheets.syncDailyReport.useMutation({
    onSuccess: (res) => {
      setGoogleSheetResult(
        `Daily attendance for "${date}" synced successfully (${res.rowCount} records).`
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

  const rawRows = useMemo(() => data?.rows ?? [], [data]);

  // Client-side filtering and sorting for instant responsiveness
  const filteredAndSortedRows = useMemo(() => {
    let result = [...rawRows];

    // Search query filter
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

    // Geofence status filter
    if (geofenceFilter === "INSIDE") {
      result = result.filter((r) => r.log?.checkInTime && r.log.withinGeofence);
    } else if (geofenceFilter === "OUTSIDE") {
      result = result.filter((r) => r.log?.checkInTime && !r.log.withinGeofence);
    } else if (geofenceFilter === "NOT_CHECKED_IN") {
      result = result.filter((r) => !r.log?.checkInTime);
    }

    // Sorting
    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === "name") {
        comparison = a.employee.firstName.localeCompare(b.employee.firstName);
      } else if (sortField === "status") {
        const sA = a.log?.status ?? "ABSENT";
        const sB = b.log?.status ?? "ABSENT";
        comparison = sA.localeCompare(sB);
      } else if (sortField === "geofence") {
        const gA = a.log ? (a.log.withinGeofence ? 1 : 0) : -1;
        const gB = b.log ? (b.log.withinGeofence ? 1 : 0) : -1;
        comparison = gA - gB;
      }
      return sortAsc ? comparison : -comparison;
    });

    return result;
  }, [rawRows, searchQuery, geofenceFilter, sortField, sortAsc]);

  const outsideGeofenceCount = useMemo(() => {
    return rawRows.filter((r) => r.log?.checkInTime && !r.log.withinGeofence).length;
  }, [rawRows]);

  const insideCount = useMemo(() => {
    return rawRows.filter((r) => r.log?.checkInTime && r.log.withinGeofence).length;
  }, [rawRows]);

  function exportCsv() {
    const header = [
      "Employee Code",
      "Name",
      "Department",
      "Status",
      "Check In",
      "Geofence Status",
      "Address",
    ];
    const lines = filteredAndSortedRows.map((r) => {
      const log = r.log;
      return [
        r.employee.employeeCode,
        fullName(r.employee.firstName, r.employee.lastName),
        r.employee.department?.name ?? "",
        log?.status ?? "ABSENT",
        log?.checkInTime ? new Date(log.checkInTime).toLocaleTimeString() : "",
        log ? (log.withinGeofence ? "Within Premises" : "Outside Geofence") : "Not Checked In",
        log?.checkInAddress ?? "",
      ]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(",");
    });
    const blob = new Blob([[header.join(","), ...lines].join("\n")], {
      type: "text/csv",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `realty-smartz-attendance-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleSort(field: "name" | "status" | "geofence") {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  }

  if (status === "loading" || !allowed) {
    return <p className="text-sm text-neutral-500">Loading team attendance...</p>;
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto overflow-hidden">
      {/* 1. TOP HEADER (Dashboards V3 Style) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
            <span>Realty Smartz Private Limited</span>
            <span>·</span>
            <span className="text-[#FF7A70] font-bold">Real-Time Telemetry</span>
          </div>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900">
            Team Attendance & Geofencing
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-neutral-500">
            Real-time workplace verification, punch times, and premise boundary compliance
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            className="gap-2 text-xs border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-semibold"
            disabled={syncGoogleSheet.isLoading}
            onClick={() => syncGoogleSheet.mutate({ date })}
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            {syncGoogleSheet.isLoading ? "Creating Tab..." : `Sync "${date}" to Google Sheet`}
          </Button>
          <Button variant="outline" className="gap-2 text-xs" onClick={exportCsv}>
            <Download className="h-4 w-4 text-neutral-500" />
            Export CSV
          </Button>
        </div>
      </div>

      {googleSheetResult && (
        <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900 font-medium">
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

      {/* 2. QUICK SUMMARY PILL BAR */}
      <div className="flex flex-wrap gap-2 text-xs">
        <button
          type="button"
          onClick={() => setGeofenceFilter("ALL")}
          className={`rounded-full px-3.5 py-1.5 font-semibold transition-all ${
            geofenceFilter === "ALL"
              ? "bg-gradient-to-r from-[#FF7A70] to-[#FFA07A] text-white shadow-xs font-bold"
              : "border border-neutral-200/80 bg-white text-neutral-700 hover:bg-neutral-50"
          }`}
        >
          All Members ({rawRows.length})
        </button>
        <button
          type="button"
          onClick={() => setGeofenceFilter("INSIDE")}
          className={`rounded-full px-3.5 py-1.5 font-semibold transition-all ${
            geofenceFilter === "INSIDE"
              ? "bg-emerald-600 text-white shadow-xs font-bold"
              : "border border-neutral-200/80 bg-white text-emerald-700 hover:bg-neutral-50"
          }`}
        >
          Within Premises ({insideCount})
        </button>
        <button
          type="button"
          onClick={() => setGeofenceFilter("OUTSIDE")}
          className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-semibold transition-all ${
            geofenceFilter === "OUTSIDE"
              ? "bg-amber-600 text-white shadow-xs font-bold"
              : "border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
          }`}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>Flagged / Outside Geofence ({outsideGeofenceCount})</span>
        </button>
        <button
          type="button"
          onClick={() => setGeofenceFilter("NOT_CHECKED_IN")}
          className={`rounded-full px-3.5 py-1.5 font-semibold transition-all ${
            geofenceFilter === "NOT_CHECKED_IN"
              ? "bg-neutral-800 text-white shadow-xs font-bold"
              : "border border-neutral-200/80 bg-white text-neutral-600 hover:bg-neutral-50"
          }`}
        >
          Not Checked In ({rawRows.filter((r) => !r.log?.checkInTime).length})
        </button>
      </div>

      {/* Filter Toolbar */}
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
          value={date}
          onChange={(e) => setDate(e.target.value)}
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

      {/* Attendance Records Table */}
      <div className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer hover:text-neutral-900"
                onClick={() => handleSort("name")}
              >
                <div className="flex items-center gap-1.5">
                  <span>Employee</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead>Department</TableHead>
              <TableHead
                className="cursor-pointer hover:text-neutral-900"
                onClick={() => handleSort("status")}
              >
                <div className="flex items-center gap-1.5">
                  <span>Status</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead>Check In / Out</TableHead>
              {/* Dedicated Geofence Column with clear icon+color badge */}
              <TableHead
                className="cursor-pointer hover:text-neutral-900"
                onClick={() => handleSort("geofence")}
              >
                <div className="flex items-center gap-1.5">
                  <span>Geofence Status</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead>Location / Map</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-xs text-neutral-500">
                  Loading attendance records...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && filteredAndSortedRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-xs text-neutral-500">
                  No attendance records match your search or filter.
                </TableCell>
              </TableRow>
            )}
            {filteredAndSortedRows.map((r) => {
              const log = r.log;
              const hasCheckedIn = Boolean(log?.checkInTime);
              const withinGeofence = Boolean(log?.withinGeofence);

              return (
                <TableRow key={r.employee.id} className="hover:bg-neutral-50/70 transition-colors">
                  {/* Employee Name & Code */}
                  <TableCell>
                    <p className="font-semibold text-neutral-900 text-xs">
                      {fullName(r.employee.firstName, r.employee.lastName)}
                    </p>
                    <p className="text-[11px] text-neutral-500">
                      {r.employee.employeeCode}
                    </p>
                  </TableCell>

                  {/* Department */}
                  <TableCell className="text-xs text-neutral-600">
                    {r.employee.department?.name ?? "—"}
                  </TableCell>

                  {/* Status Badge */}
                  <TableCell>
                    {log?.status === "PRESENT" && (
                      <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                        Present
                      </span>
                    )}
                    {log?.status === "LATE" && (
                      <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
                        Late
                      </span>
                    )}
                    {log?.status === "HALF_DAY" && (
                      <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
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

                  {/* Check In / Out Timestamps */}
                  <TableCell className="text-xs text-neutral-700">
                    {hasCheckedIn ? (
                      <div>
                        <p className="font-medium">
                          In: {new Date(log!.checkInTime!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                        {log?.checkOutTime && (
                          <p className="text-[11px] text-neutral-500">
                            Out: {new Date(log.checkOutTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            {log.totalHours != null && ` (${log.totalHours}h)`}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-neutral-400">—</span>
                    )}
                  </TableCell>

                  {/* Dedicated Geofence Badge Column */}
                  <TableCell>
                    {!hasCheckedIn ? (
                      <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-medium text-neutral-500">
                        Not Checked In
                      </span>
                    ) : withinGeofence ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        <span>Inside Premises</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-300 shadow-2xs">
                        <AlertTriangle className="h-3 w-3 text-amber-600" />
                        <span>Outside Geofence</span>
                      </span>
                    )}
                  </TableCell>

                  {/* Location & Map Toggle */}
                  <TableCell>
                    {log?.checkInLat != null && log?.checkInLng != null ? (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-2.5 gap-1 border-neutral-200 text-neutral-700 hover:text-primary"
                          onClick={() =>
                            setMapEmployeeId((id) =>
                              id === r.employee.id ? null : r.employee.id
                            )
                          }
                        >
                          <MapPin className="h-3 w-3 text-neutral-400" />
                          {mapEmployeeId === r.employee.id ? "Close Map" : "View Pin"}
                        </Button>
                      </div>
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

      {/* Expanded Map Drawer/Card */}
      {mapEmployeeId &&
        (() => {
          const row = rawRows.find((r) => r.employee.id === mapEmployeeId);
          const log = row?.log;
          if (!log?.checkInLat || !log?.checkInLng) return null;
          return (
            <Card className="border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-neutral-800">
                  Punch Coordinates for {fullName(row!.employee.firstName, row!.employee.lastName)}
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs"
                  onClick={() => setMapEmployeeId(null)}
                >
                  Dismiss
                </Button>
              </div>
              <LocationMap
                lat={log.checkInLat}
                lng={log.checkInLng}
                label={`${fullName(row!.employee.firstName, row!.employee.lastName)} — ${log.checkInAddress || "Check-in point"}`}
                height={220}
              />
            </Card>
          );
        })()}
    </div>
  );
}
