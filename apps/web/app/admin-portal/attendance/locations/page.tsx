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

export default function LocationTracingPage() {
  const { data: session } = useSession();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeMapPing, setActiveMapPing] = useState<{
    lat: number;
    lng: number;
    label: string;
    address: string;
  } | null>(null);

  // Fetch employees for filter dropdown
  const { data: employeesData } = trpc.employee.list.useQuery({
    pageSize: 100,
  });

  // Fetch location traces
  const {
    data: pings,
    isLoading,
    refetch,
    isFetching,
  } = trpc.attendance.allLocationPings.useQuery({
    date: new Date(date),
    employeeId: selectedEmployeeId || undefined,
    limit: 150,
  });

  // Filtered by search query (employee name, code, or address)
  const filteredPings = (pings ?? []).filter((p) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const name = `${p.employee?.firstName ?? ""} ${p.employee?.lastName ?? ""}`.toLowerCase();
    const code = (p.employee?.employeeCode ?? "").toLowerCase();
    const addr = (p.address ?? "").toLowerCase();
    return name.includes(query) || code.includes(query) || addr.includes(query);
  });

  // Quick Stats
  const totalPings = pings?.length ?? 0;
  const uniqueEmployees = new Set((pings ?? []).map((p) => p.employeeId)).size;
  const latestPingTime = pings?.[0]?.capturedAt
    ? new Date(pings[0].capturedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "None today";

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-[#FF7A70] to-[#FFA07A] text-white shadow-sm">
              <MapPin className="h-4 w-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-[#FF7A70]">
              Personnel GPS Monitoring
            </span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900">
            30-Minute Location Traces
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">
            Automated location logs captured every 30 minutes while staff members are active.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-2 rounded-xl text-xs h-9 font-medium"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            <span>{isFetching ? "Updating…" : "Refresh"}</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
        <Card className="p-4 sm:p-5 border-neutral-200/80 bg-white/90 shadow-2xs rounded-2xl flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <Navigation className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Total GPS Traces
            </p>
            <p className="text-2xl font-extrabold text-neutral-900">{totalPings}</p>
            <p className="text-[11px] text-neutral-500">Every 30m automatic interval</p>
          </div>
        </Card>

        <Card className="p-4 sm:p-5 border-neutral-200/80 bg-white/90 shadow-2xs rounded-2xl flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Active Personnel
            </p>
            <p className="text-2xl font-extrabold text-neutral-900">{uniqueEmployees}</p>
            <p className="text-[11px] text-neutral-500">Employees reporting location</p>
          </div>
        </Card>

        <Card className="p-4 sm:p-5 border-neutral-200/80 bg-white/90 shadow-2xs rounded-2xl flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Latest Ping
            </p>
            <p className="text-2xl font-extrabold text-neutral-900">{latestPingTime}</p>
            <p className="text-[11px] text-neutral-500">Most recent trace received</p>
          </div>
        </Card>
      </div>

      {/* Filter Controls Bar */}
      <div className="rounded-2xl border border-neutral-200/80 bg-white p-3.5 sm:p-4 shadow-2xs flex flex-wrap items-center gap-3">
        {/* Date Filter */}
        <div className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50/80 px-3 py-1.5 text-xs text-neutral-700 min-w-0">
          <Calendar className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-transparent font-medium text-xs focus:outline-none"
          />
        </div>

        {/* Employee Dropdown Filter */}
        <div className="min-w-0 sm:min-w-[200px]">
          <select
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
            className="w-full rounded-xl border border-neutral-200 bg-neutral-50/80 px-3 py-2 text-xs font-medium text-neutral-700 focus:outline-none focus:ring-2 focus:ring-[#FF7A70]/30"
          >
            <option value="">All Employees</option>
            {(employeesData?.items ?? []).map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.firstName} {emp.lastName} ({emp.employeeCode})
              </option>
            ))}
          </select>
        </div>

        {/* Search Input */}
        <div className="relative min-w-0 flex-1 sm:min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
          <Input
            placeholder="Search by name, employee code or location address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs h-9 rounded-xl border-neutral-200"
          />
        </div>
      </div>

      {/* Location Map Preview Modal (if selected) */}
      {activeMapPing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl rounded-3xl bg-white p-5 shadow-2xl border border-neutral-200">
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

            <div className="mt-4">
              <LocationMap
                lat={activeMapPing.lat}
                lng={activeMapPing.lng}
                label={activeMapPing.label}
                height={300}
              />
            </div>

            <div className="mt-4 flex justify-between items-center text-xs text-neutral-500">
              <span>Coordinates: {activeMapPing.lat.toFixed(5)}, {activeMapPing.lng.toFixed(5)}</span>
              <a
                href={`https://www.google.com/maps?q=${activeMapPing.lat},${activeMapPing.lng}&z=16`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-[#FF7A70] hover:underline"
              >
                Open in Google Maps <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Main Location Logs Table & Cards */}
      <Card className="rounded-2xl border border-neutral-200/80 bg-white shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-xs text-neutral-400">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-neutral-300 mb-2" />
            Loading location traces...
          </div>
        ) : filteredPings.length === 0 ? (
          <div className="py-16 text-center text-xs text-neutral-400">
            <MapPin className="h-8 w-8 text-neutral-300 mx-auto mb-2" />
            <p className="font-semibold text-neutral-700 text-sm">No Location Traces Found</p>
            <p className="text-neutral-400 mt-1 max-w-sm mx-auto">
              No GPS pings were recorded for this date and filter. Personnel pings are generated automatically every 30 minutes while signed in.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-neutral-50/80">
                <TableRow>
                  <TableHead className="text-xs font-bold text-neutral-700">Employee</TableHead>
                  <TableHead className="text-xs font-bold text-neutral-700">Trace Time</TableHead>
                  <TableHead className="text-xs font-bold text-neutral-700">Location Address</TableHead>
                  <TableHead className="text-xs font-bold text-neutral-700">Coordinates</TableHead>
                  <TableHead className="text-xs font-bold text-neutral-700">Accuracy</TableHead>
                  <TableHead className="text-right text-xs font-bold text-neutral-700">Action</TableHead>
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
                      {/* Employee Info */}
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[#FF7A70] to-[#FFA07A] font-bold text-xs text-white shadow-2xs">
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

                      {/* Time */}
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-xs text-neutral-700 font-medium">
                          <Clock className="h-3 w-3 text-neutral-400" />
                          <span>{timeStr}</span>
                        </div>
                      </TableCell>

                      {/* Address */}
                      <TableCell className="max-w-[280px]">
                        <p className="text-xs text-neutral-800 font-medium truncate" title={ping.address ?? "Location coordinate recorded"}>
                          {ping.address || "Street location recorded"}
                        </p>
                      </TableCell>

                      {/* Coordinates */}
                      <TableCell>
                        <span className="font-mono text-[11px] text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded">
                          {ping.lat.toFixed(5)}, {ping.lng.toFixed(5)}
                        </span>
                      </TableCell>

                      {/* Accuracy */}
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="text-[10px] font-semibold text-neutral-600 border-neutral-200"
                        >
                          {ping.accuracyM ? `±${Math.round(ping.accuracyM)}m` : "GPS standard"}
                        </Badge>
                      </TableCell>

                      {/* Action */}
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setActiveMapPing({
                              lat: ping.lat,
                              lng: ping.lng,
                              label: `${empName} at ${timeStr}`,
                              address: ping.address || "Location coordinate",
                            })
                          }
                          className="h-8 gap-1.5 text-xs font-semibold text-[#FF7A70] hover:bg-[#FF7A70]/10"
                        >
                          <MapPin className="h-3.5 w-3.5" />
                          <span>View Map</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
