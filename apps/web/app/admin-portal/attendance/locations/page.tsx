"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import {
  MapPin,
  Calendar,
  Search,
  ExternalLink,
  RefreshCw,
  Clock,
  Users,
  Navigation,
  ShieldCheck,
  Building,
  CheckCircle2,
  AlertCircle,
  LogIn,
  LogOut,
  Route,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { LocationMap } from "@/components/LocationMap";
import { AssignLocationCard } from "@/components/AssignLocationCard";
import { EmployeeDailyTraceModal } from "@/components/EmployeeDailyTraceModal";
import { cn } from "@/lib/utils";

function parseSites(raw: unknown): { name: string; lat: number; lng: number }[] {
  if (!Array.isArray(raw)) return [];
  const out: { name: string; lat: number; lng: number }[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const lat = Number(o.lat);
    const lng = Number(o.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    out.push({ name: String(o.name || "Assigned site"), lat, lng });
    if (out.length >= 3) break;
  }
  return out;
}

export default function LocationTracingPage() {
  const { data: session } = useSession();
  const { data: office } = trpc.companySettings.get.useQuery();
  const officeLabel = `${office?.officeName ?? "Company office"} (default)`;
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"overview" | "traces">("overview");
  const [activeMapPing, setActiveMapPing] = useState<{
    lat: number;
    lng: number;
    label: string;
    address: string;
  } | null>(null);
  const [assignStaffTarget, setAssignStaffTarget] = useState<{
    id: string;
    name: string;
    locationName: string | null;
    lat: number | null;
    lng: number | null;
    sites?: { name: string; lat: number; lng: number }[] | null;
  } | null>(null);
  const [traceModalEmployee, setTraceModalEmployee] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // 1. Fetch live personnel overview (all employees with today's status & latest GPS)
  const {
    data: allStaff,
    isLoading: isStaffLoading,
    refetch: refetchStaff,
    isFetching: isStaffFetching,
  } = trpc.attendance.livePersonnelOverview.useQuery({
    date: new Date(date),
  });

  // 2. Fetch detailed 30-minute location traces
  const {
    data: pings,
    isLoading: isPingsLoading,
    refetch: refetchPings,
    isFetching: isPingsFetching,
  } = trpc.attendance.allLocationPings.useQuery({
    date: new Date(date),
    employeeId: selectedEmployeeId || undefined,
    limit: 150,
  });

  const isRefreshing = isStaffFetching || isPingsFetching;

  const handleRefresh = () => {
    void refetchStaff();
    void refetchPings();
  };

  // Filter staff by search query & selected employee
  const filteredStaff = (allStaff ?? []).filter((item) => {
    if (selectedEmployeeId && item.employee.id !== selectedEmployeeId) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const name = `${item.employee.firstName} ${item.employee.lastName}`.toLowerCase();
    const code = (item.employee.employeeCode ?? "").toLowerCase();
    const dept = (item.employee.department?.name ?? "").toLowerCase();
    const site = (item.employee.workLocationName ?? "").toLowerCase();
    return name.includes(q) || code.includes(q) || dept.includes(q) || site.includes(q);
  });

  // Filter traces by search query
  const filteredPings = (pings ?? []).filter((p) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const name = `${p.employee?.firstName ?? ""} ${p.employee?.lastName ?? ""}`.toLowerCase();
    const code = (p.employee?.employeeCode ?? "").toLowerCase();
    const addr = (p.address ?? "").toLowerCase();
    return name.includes(query) || code.includes(query) || addr.includes(query);
  });

  // KPI Calculations
  const totalEmployees = allStaff?.length ?? 0;
  const presentToday = (allStaff ?? []).filter((s) => Boolean(s.todayAttendance?.checkInTime)).length;
  const totalPings = pings?.length ?? 0;
  const activeGpsPinging = new Set((pings ?? []).map((p) => p.employeeId)).size;

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-1 sm:px-0">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#5D3EBC] text-white">
              <MapPin className="h-4 w-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-[#5D3EBC]">
              REALTY SMARTZ PVT LTD · Personnel GPS Monitoring
            </span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900">
            Employee Location & GPS Tracking
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">
            Real-time live location, assigned workplace verification, and 30-minute interval breadcrumb traces.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="gap-2 rounded-xl text-xs h-9 font-medium"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>{isRefreshing ? "Updating…" : "Refresh Data"}</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-4 border-neutral-200/80 bg-white/90 rounded-lg flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              Total Employees
            </p>
            <p className="text-xl sm:text-2xl font-extrabold text-neutral-900">{totalEmployees}</p>
            <p className="text-[10px] text-neutral-500">Active roster</p>
          </div>
        </Card>

        <Card className="p-4 border-neutral-200/80 bg-white/90 rounded-lg flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <LogIn className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              Checked In Today
            </p>
            <p className="text-xl sm:text-2xl font-extrabold text-emerald-800">{presentToday}</p>
            <p className="text-[10px] text-neutral-500">Punch-in logged</p>
          </div>
        </Card>

        <Card className="p-4 border-neutral-200/80 bg-white/90 rounded-lg flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
            <Navigation className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              30-Min GPS Traces
            </p>
            <p className="text-xl sm:text-2xl font-extrabold text-neutral-900">{totalPings}</p>
            <p className="text-[10px] text-neutral-500">Interval captures today</p>
          </div>
        </Card>

        <Card className="p-4 border-neutral-200/80 bg-white/90 rounded-lg flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
            <Building className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              Workplace Verification
            </p>
            <p className="text-xl sm:text-2xl font-extrabold text-neutral-900">Active</p>
            <p className="text-[10px] text-neutral-500">Office & site policy</p>
          </div>
        </Card>
      </div>

      {/* View Switcher & Filter Controls */}
      <div className="rounded-lg border border-neutral-200/80 bg-white p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* View Toggle Tabs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 p-1 bg-neutral-100 rounded-xl w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setViewMode("overview")}
              className={cn(
                "px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all text-center",
                viewMode === "overview"
                  ? "bg-white text-neutral-900"
                  : "text-neutral-500 hover:text-neutral-800"
              )}
            >
              👥 All Employees ({filteredStaff.length})
            </button>
            <button
              type="button"
              onClick={() => setViewMode("traces")}
              className={cn(
                "px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all text-center",
                viewMode === "traces"
                  ? "bg-white text-neutral-900"
                  : "text-neutral-500 hover:text-neutral-800"
              )}
            >
              📍 30-Min GPS Traces ({filteredPings.length})
            </button>
          </div>

          {/* Date Selector */}
          <div className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50/80 px-3 py-1.5 text-xs text-neutral-700 min-w-0">
            <Calendar className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-transparent font-medium text-xs focus:outline-none"
            />
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
          {/* Employee Filter */}
          <div className="w-full sm:w-64">
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50/80 px-3 py-2 text-xs font-medium text-neutral-700 focus:outline-none focus:ring-2 focus:ring-[#5D3EBC]/30"
            >
              <option value="">All Employees ({allStaff?.length ?? 0})</option>
              {(allStaff ?? []).map((item) => (
                <option key={item.employee.id} value={item.employee.id}>
                  {item.employee.firstName} {item.employee.lastName} ({item.employee.employeeCode})
                </option>
              ))}
            </select>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
            <Input
              placeholder="Search by employee name, code, department or site location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs h-9 rounded-xl border-neutral-200 w-full"
            />
          </div>
        </div>
      </div>

      {/* Location Map Preview Modal (if selected) */}
      {activeMapPing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl rounded-xl bg-white p-5 border border-neutral-200">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-neutral-900">{activeMapPing.label}</h3>
                  <p className="text-xs text-neutral-500 line-clamp-1">{activeMapPing.address}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveMapPing(null)}
                className="rounded-full p-1 text-neutral-400 hover:bg-neutral-100 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 rounded-lg overflow-hidden border border-neutral-200">
              <LocationMap
                lat={activeMapPing.lat}
                lng={activeMapPing.lng}
                label={activeMapPing.label}
                showCard={false}
                height={300}
              />
            </div>

            <div className="mt-4 flex justify-between items-center text-xs text-neutral-500">
              <span>
                Coordinates: {activeMapPing.lat.toFixed(5)}, {activeMapPing.lng.toFixed(5)}
              </span>
              <a
                href={`https://www.google.com/maps?q=${activeMapPing.lat},${activeMapPing.lng}&z=17`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-[#5D3EBC] hover:underline"
              >
                Open in Google Maps <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Assign Location Modal for Admin */}
      {assignStaffTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl rounded-xl bg-white p-5 sm:p-6 border border-neutral-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 mb-4">
              <div>
                <h3 className="font-bold text-base text-neutral-900">
                  Admin Work Site Allocation
                </h3>
                <p className="text-xs text-neutral-500">
                  Assign official project or office location for {assignStaffTarget.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAssignStaffTarget(null)}
                className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <AssignLocationCard
              employeeId={assignStaffTarget.id}
              employeeName={assignStaffTarget.name}
              currentLocationName={assignStaffTarget.locationName}
              currentLat={assignStaffTarget.lat}
              currentLng={assignStaffTarget.lng}
              currentSites={assignStaffTarget.sites}
              canManage={true}
              onUpdated={() => {
                void refetchStaff();
                void refetchPings();
              }}
            />
          </div>
        </div>
      )}

      {/* Full Day GPS Trace & Timestamps Modal */}
      {traceModalEmployee && (
        <EmployeeDailyTraceModal
          employeeId={traceModalEmployee.id}
          employeeName={traceModalEmployee.name}
          date={date}
          onClose={() => setTraceModalEmployee(null)}
        />
      )}

      {/* VIEW 1: All Employees Live Status */}
      {viewMode === "overview" && (
        <Card className="rounded-lg border border-neutral-200/80 bg-white overflow-hidden">
          {isStaffLoading ? (
            <div className="py-16 text-center text-xs text-neutral-400">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto text-neutral-300 mb-2" />
              Loading employee status and location data...
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="py-16 text-center text-xs text-neutral-400">
              <Users className="h-8 w-8 text-neutral-300 mx-auto mb-2" />
              <p className="font-semibold text-neutral-700 text-sm">No Employees Found</p>
              <p className="text-neutral-400 mt-1">Try adjusting your search query or filters.</p>
            </div>
          ) : (
            <div>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader className="bg-neutral-50/80">
                    <TableRow>
                      <TableHead className="text-xs font-bold text-neutral-700">Employee</TableHead>
                      <TableHead className="text-xs font-bold text-neutral-700">Assigned Work Site</TableHead>
                      <TableHead className="text-xs font-bold text-neutral-700">Today's Punch Status</TableHead>
                      <TableHead className="text-xs font-bold text-neutral-700">Latest 30-Min GPS Ping</TableHead>
                      <TableHead className="text-right text-xs font-bold text-neutral-700">Map Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStaff.map(({ employee: emp, todayAttendance: att, latestPing: ping }) => {
                      const empName = `${emp.firstName} ${emp.lastName}`;
                      const initial = emp.firstName?.[0] ?? "E";

                      const isSiteAssigned = emp.workLocationLat != null && emp.workLocationLng != null;
                      const siteName = isSiteAssigned ? emp.workLocationName || "Assigned site" : officeLabel;
                      const siteLat = (isSiteAssigned ? emp.workLocationLat : office?.officeLat) ?? 0;
                      const siteLng = (isSiteAssigned ? emp.workLocationLng : office?.officeLng) ?? 0;

                      // Real device position first; workplace only when nothing was captured today
                      const targetLat = ping?.lat ?? att?.checkInLat ?? siteLat;
                      const targetLng = ping?.lng ?? att?.checkInLng ?? siteLng;
                      const targetLabel = ping
                        ? `30-Min Ping at ${new Date(ping.capturedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                        : att?.checkInTime
                          ? `Punch-in at ${new Date(att.checkInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                          : siteName;

                      return (
                        <TableRow key={emp.id} className="hover:bg-neutral-50/60 transition-colors">
                          {/* Employee */}
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#5D3EBC] font-bold text-xs text-white">
                                {initial}
                              </div>
                              <div>
                                <p className="font-semibold text-xs text-neutral-900 leading-tight">
                                  {empName}
                                </p>
                                <p className="text-[10px] text-neutral-400">
                                  {emp.employeeCode} · {emp.department?.name ?? "General"}
                                </p>
                              </div>
                            </div>
                          </TableCell>

                          {/* Assigned Site */}
                          <TableCell>
                            <div className="space-y-0.5">
                              <p className="text-xs font-medium text-neutral-800 flex items-center gap-1">
                                <Building className="h-3 w-3 text-neutral-400" />
                                <span>{siteName}</span>
                              </p>
                              <p className="text-[10px] tabular-nums text-neutral-400">
                                {siteLat.toFixed(4)}, {siteLng.toFixed(4)} · Assigned Workplace
                              </p>
                            </div>
                          </TableCell>

                          {/* Today's Punch Status */}
                          <TableCell>
                            {att?.checkInTime ? (
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={cn(
                                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border",
                                      att.withinGeofence
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                        : "bg-amber-50 text-amber-700 border-amber-200"
                                    )}
                                  >
                                    <ShieldCheck className="h-3 w-3" />
                                    {att.status} · {att.withinGeofence ? "Workplace" : "Outside"}
                                  </span>
                                </div>
                                <p className="text-[10px] text-neutral-500">
                                  In: {new Date(att.checkInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                  {att.checkOutTime
                                    ? ` · Out: ${new Date(att.checkOutTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                                    : " · Active"}
                                </p>
                              </div>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-500">
                                Not punched in
                              </span>
                            )}
                          </TableCell>

                          {/* Latest Ping */}
                          <TableCell>
                            {ping ? (
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1 text-xs text-neutral-800 font-medium">
                                  <Clock className="h-3 w-3 text-neutral-400" />
                                  <span>
                                    {new Date(ping.capturedAt).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                  <span
                                    className={cn(
                                      "h-1.5 w-1.5 rounded-full ml-1",
                                      ping.withinGeofence ? "bg-emerald-500" : "bg-amber-500"
                                    )}
                                  />
                                </div>
                                <p className="text-[10px] text-neutral-400 truncate max-w-[200px]" title={ping.address || ""}>
                                  {ping.address || `${ping.lat.toFixed(4)}, ${ping.lng.toFixed(4)}`}
                                </p>
                              </div>
                            ) : (
                              <span className="text-[11px] text-neutral-400 italic">
                                No ping recorded today
                              </span>
                            )}
                          </TableCell>

                          {/* Map Action */}
                          <TableCell className="text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setActiveMapPing({
                                    lat: targetLat,
                                    lng: targetLng,
                                    label: `${empName} (${targetLabel})`,
                                    address: ping?.address || att?.checkInAddress || siteName,
                                  })
                                }
                                className="h-7 px-2 text-xs text-neutral-700 hover:bg-neutral-50 rounded-lg border-neutral-200"
                                title="View Map Pin"
                              >
                                <MapPin className="h-3 w-3 text-[#5D3EBC] mr-1" />
                                Pin
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => setTraceModalEmployee({ id: emp.id, name: empName })}
                                className="h-7 px-2 text-xs gap-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold"
                                title="View Full Day Trace"
                              >
                                <Route className="h-3 w-3" />
                                <span>Trace</span>
                              </Button>
                              <Button
                                size="sm"
                                onClick={() =>
                                  setAssignStaffTarget({
                                    id: emp.id,
                                    name: empName,
                                    locationName: emp.workLocationName,
                                    lat: emp.workLocationLat,
                                    lng: emp.workLocationLng,
                                    sites: parseSites(emp.assignedLocations),
                                  })
                                }
                                className="h-7 px-2 text-xs gap-1 bg-[#5D3EBC] hover:bg-[#FF6559] text-white rounded-lg font-semibold"
                                title="Assign Official Workplace"
                              >
                                <Navigation className="h-3 w-3" />
                                <span>Assign</span>
                              </Button>
                              <a
                                href={`https://www.google.com/maps?q=${targetLat},${targetLng}&z=17`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center justify-center h-7 px-2 rounded-lg border border-neutral-200 text-xs font-semibold text-[#5D3EBC] hover:bg-[#5D3EBC]/10 transition-colors"
                                title="Open in Google Maps"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards View */}
              <div className="md:hidden divide-y divide-neutral-100 p-2 space-y-2.5">
                {filteredStaff.map(({ employee: emp, todayAttendance: att, latestPing: ping }) => {
                  const empName = `${emp.firstName} ${emp.lastName}`;
                  const isSiteAssigned = emp.workLocationLat != null && emp.workLocationLng != null;
                  const siteName = isSiteAssigned ? emp.workLocationName || "Assigned site" : officeLabel;
                  const siteLat = (isSiteAssigned ? emp.workLocationLat : office?.officeLat) ?? 0;
                  const siteLng = (isSiteAssigned ? emp.workLocationLng : office?.officeLng) ?? 0;

                  const targetLat = ping?.lat ?? att?.checkInLat ?? siteLat;
                  const targetLng = ping?.lng ?? att?.checkInLng ?? siteLng;
                  const targetLabel = ping
                    ? `Ping at ${new Date(ping.capturedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                    : att?.checkInTime
                      ? `Punch at ${new Date(att.checkInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                      : siteName;

                  return (
                    <div key={emp.id} className="p-3 bg-neutral-50/60 rounded-xl space-y-2 border border-neutral-100">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-xs text-neutral-900">{empName}</p>
                          <p className="text-[10px] text-neutral-400">
                            {emp.employeeCode} · {emp.department?.name ?? "General"}
                          </p>
                        </div>
                        {att?.checkInTime ? (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border",
                              att.withinGeofence
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            )}
                          >
                            {att.status}
                          </span>
                        ) : (
                          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-500 font-medium">
                            Not in
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-neutral-700 space-y-1 bg-white p-2.5 rounded-lg border border-neutral-100">
                        <div className="flex items-center justify-between">
                          <span className="text-neutral-400">Assigned Site:</span>
                          <span className="font-semibold text-neutral-800">{siteName}</span>
                        </div>
                        {att?.checkInTime && (
                          <div className="flex items-center justify-between">
                            <span className="text-neutral-400">Punch Time:</span>
                            <span>
                              {new Date(att.checkInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              {att.checkOutTime ? ` – ${new Date(att.checkOutTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : " (Active)"}
                            </span>
                          </div>
                        )}
                        {ping && (
                          <div className="flex items-center justify-between">
                            <span className="text-neutral-400">Latest 30m Ping:</span>
                            <span className="font-medium text-teal-800">
                              {new Date(ping.capturedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:flex sm:items-center sm:justify-end gap-1.5 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setActiveMapPing({
                              lat: targetLat,
                              lng: targetLng,
                              label: `${empName} (${targetLabel})`,
                              address: ping?.address || att?.checkInAddress || siteName,
                            })
                          }
                          className="h-7 text-xs text-neutral-700 border-neutral-200 px-2 font-semibold"
                        >
                          <MapPin className="h-3 w-3 mr-1 text-[#5D3EBC]" />
                          Pin Map
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setTraceModalEmployee({ id: emp.id, name: empName })}
                          className="h-7 text-xs gap-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold px-2"
                        >
                          <Route className="h-3 w-3" />
                          <span>Day Trace</span>
                        </Button>
                        <Button
                          size="sm"
                          onClick={() =>
                            setAssignStaffTarget({
                              id: emp.id,
                              name: empName,
                              locationName: emp.workLocationName,
                              lat: emp.workLocationLat,
                              lng: emp.workLocationLng,
                              sites: parseSites(emp.assignedLocations),
                            })
                          }
                          className="h-7 text-xs gap-1 bg-[#5D3EBC] hover:bg-[#FF6559] text-white rounded-lg font-semibold px-2"
                        >
                          <Navigation className="h-3 w-3" />
                          <span>Assign Site</span>
                        </Button>
                        <a
                          href={`https://www.google.com/maps?q=${targetLat},${targetLng}&z=17`}
                          target="_blank"
                          rel="noreferrer"
                          className="h-7 inline-flex items-center justify-center gap-1 rounded-lg border border-neutral-200 px-2 text-xs font-semibold text-[#5D3EBC] hover:bg-[#5D3EBC]/10 transition-colors"
                        >
                          <span>Google Maps</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* VIEW 2: Detailed 30-Minute Location Traces */}
      {viewMode === "traces" && (
        <Card className="rounded-lg border border-neutral-200/80 bg-white overflow-hidden">
          {isPingsLoading ? (
            <div className="py-16 text-center text-xs text-neutral-400">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto text-neutral-300 mb-2" />
              Loading 30-minute location traces...
            </div>
          ) : filteredPings.length === 0 ? (
            <div className="py-16 text-center text-xs text-neutral-400">
              <MapPin className="h-8 w-8 text-neutral-300 mx-auto mb-2" />
              <p className="font-semibold text-neutral-700 text-sm">No GPS Traces Found</p>
              <p className="text-neutral-400 mt-1 max-w-sm mx-auto">
                No GPS pings were recorded for this date and filter. Personnel pings are generated automatically every 30 minutes while signed in.
              </p>
            </div>
          ) : (
            <div>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader className="bg-neutral-50/80">
                    <TableRow>
                      <TableHead className="text-xs font-bold text-neutral-700">Employee</TableHead>
                      <TableHead className="text-xs font-bold text-neutral-700">Trace Time</TableHead>
                      <TableHead className="text-xs font-bold text-neutral-700">Location Address</TableHead>
                      <TableHead className="text-xs font-bold text-neutral-700">Coordinates</TableHead>
                      <TableHead className="text-xs font-bold text-neutral-700">Perimeter Status</TableHead>
                      <TableHead className="text-right text-xs font-bold text-neutral-700">Google Maps</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPings.map((ping) => {
                      const empName = ping.employee
                        ? `${ping.employee.firstName} ${ping.employee.lastName}`
                        : "Unknown";
                      const initial = ping.employee?.firstName?.[0] ?? "U";
                      const timeStr = new Date(ping.capturedAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      });

                      return (
                        <TableRow key={ping.id} className="hover:bg-neutral-50/60 transition-colors">
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#5D3EBC] font-bold text-xs text-white">
                                {initial}
                              </div>
                              <div>
                                <p className="font-semibold text-xs text-neutral-900 leading-tight">
                                  {empName}
                                </p>
                                <p className="text-[10px] text-neutral-400">
                                  {ping.employee?.employeeCode ?? "RS-EMP"} · {ping.employee?.department?.name ?? "General"}
                                </p>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-1.5 text-xs text-neutral-700 font-medium">
                              <Clock className="h-3 w-3 text-neutral-400" />
                              <span>{timeStr}</span>
                            </div>
                          </TableCell>

                          <TableCell className="max-w-[280px]">
                            <p
                              className="text-xs text-neutral-800 font-medium truncate"
                              title={ping.address ?? "Location coordinate recorded"}
                            >
                              {ping.address || "Street location recorded"}
                            </p>
                          </TableCell>

                          <TableCell>
                            <span className="tabular-nums text-[11px] text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded">
                              {ping.lat.toFixed(5)}, {ping.lng.toFixed(5)}
                            </span>
                          </TableCell>

                          <TableCell>
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border",
                                ping.withinGeofence
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-amber-50 text-amber-700 border-amber-200"
                              )}
                            >
                              <ShieldCheck className="h-3 w-3" />
                              {ping.withinGeofence ? "Workplace Location" : "Outside Workplace"}
                            </span>
                          </TableCell>

                          <TableCell className="text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setActiveMapPing({
                                    lat: ping.lat,
                                    lng: ping.lng,
                                    label: `${empName} at ${timeStr}`,
                                    address: ping.address || "Location coordinate",
                                  })
                                }
                                className="h-7 px-2 text-xs text-neutral-700 hover:bg-neutral-50 rounded-lg border-neutral-200"
                                title="View Map Pin"
                              >
                                <MapPin className="h-3 w-3 text-[#5D3EBC] mr-1" />
                                Pin
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => setTraceModalEmployee({ id: ping.employeeId, name: empName })}
                                className="h-7 px-2 text-xs gap-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold"
                                title="View Full Day Trace"
                              >
                                <Route className="h-3 w-3" />
                                <span>Trace</span>
                              </Button>
                              <a
                                href={`https://www.google.com/maps?q=${ping.lat},${ping.lng}&z=17`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center justify-center h-7 px-2 rounded-lg border border-neutral-200 text-xs font-semibold text-[#5D3EBC] hover:bg-[#5D3EBC]/10 transition-colors"
                                title="Open in Google Maps"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards View */}
              <div className="md:hidden divide-y divide-neutral-100 p-2 space-y-2">
                {filteredPings.map((ping) => {
                  const empName = ping.employee
                    ? `${ping.employee.firstName} ${ping.employee.lastName}`
                    : "Unknown";
                  const timeStr = new Date(ping.capturedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <div key={ping.id} className="p-3 bg-neutral-50/50 rounded-xl space-y-2 border border-neutral-100">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-xs text-neutral-900">{empName}</p>
                          <p className="text-[10px] text-neutral-400">{ping.employee?.employeeCode}</p>
                        </div>
                        <div className="flex items-center gap-1 text-xs font-semibold text-neutral-700">
                          <Clock className="h-3.5 w-3.5 text-neutral-400" />
                          <span>{timeStr}</span>
                        </div>
                      </div>

                      <p className="text-xs text-neutral-700 line-clamp-2">
                        {ping.address || "Location coordinate recorded"}
                      </p>

                      <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border",
                            ping.withinGeofence
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          )}
                        >
                          {ping.withinGeofence ? "Workplace" : "Outside"}
                        </span>

                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setActiveMapPing({
                                lat: ping.lat,
                                lng: ping.lng,
                                label: `${empName} at ${timeStr}`,
                                address: ping.address || "Location coordinate",
                              })
                            }
                            className="h-7 text-xs text-neutral-700 border-neutral-200 px-2 font-semibold"
                          >
                            <MapPin className="h-3 w-3 mr-1 text-[#5D3EBC]" />
                            Pin
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => setTraceModalEmployee({ id: ping.employeeId, name: empName })}
                            className="h-7 text-xs gap-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold px-2"
                          >
                            <Route className="h-3 w-3" />
                            <span>Trace</span>
                          </Button>
                          <a
                            href={`https://www.google.com/maps?q=${ping.lat},${ping.lng}&z=17`}
                            target="_blank"
                            rel="noreferrer"
                            className="h-7 inline-flex items-center justify-center gap-1 rounded-lg border border-neutral-200 px-2 text-xs font-semibold text-[#5D3EBC] hover:bg-[#5D3EBC]/10 transition-colors"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
