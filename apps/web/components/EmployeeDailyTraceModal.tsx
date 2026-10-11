"use client";

import { useState, useMemo } from "react";
import {
  MapPin,
  Clock,
  Calendar,
  ExternalLink,
  RefreshCw,
  X,
  LogIn,
  LogOut,
  ShieldCheck,
  ShieldAlert,
  Route,
  Building,
  Navigation,
  CheckCircle2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { LocationMap } from "@/components/LocationMap";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface EmployeeDailyTraceModalProps {
  employeeId: string;
  employeeName: string;
  date: string; // YYYY-MM-DD
  onClose: () => void;
}

export function EmployeeDailyTraceModal({
  employeeId,
  employeeName,
  date,
  onClose,
}: EmployeeDailyTraceModalProps) {
  const { data, isLoading, isError, refetch, isFetching } =
    trpc.attendance.employeeDailyMapTrace.useQuery({
      employeeId,
      date: new Date(date),
    });

  const [selectedEventIndex, setSelectedEventIndex] = useState<number>(0);

  const events = data?.events ?? [];
  const log = data?.log;
  const emp = data?.employee;

  // Selected event or fallback
  const activeEvent = events[selectedEventIndex] ?? events[events.length - 1] ?? null;

  // Generate full Google Maps directions / route link if there are >= 2 points
  const routeUrl = useMemo(() => {
    if (events.length === 0) return null;
    if (events.length === 1) {
      return `https://www.google.com/maps?q=${events[0].lat},${events[0].lng}&z=16`;
    }
    const origin = `${events[0].lat},${events[0].lng}`;
    const destination = `${events[events.length - 1].lat},${events[events.length - 1].lng}`;
    const waypoints = events
      .slice(1, -1)
      .slice(0, 8) // Google Maps supports up to 8-10 waypoints in standard URL
      .map((e) => `${e.lat},${e.lng}`)
      .join("|");

    if (waypoints) {
      return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${encodeURIComponent(waypoints)}&travelmode=driving`;
    }
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
  }, [events]);

  const hasAssignedSite = emp?.workLocationLat != null && emp?.workLocationLng != null;
  const assignedSiteName = hasAssignedSite
    ? emp?.workLocationName || "Assigned site"
    : `${data?.settings?.officeName ?? "Company office"} (default)`;
  const assignedLat = hasAssignedSite ? emp!.workLocationLat : data?.settings?.officeLat ?? null;
  const assignedLng = hasAssignedSite ? emp!.workLocationLng : data?.settings?.officeLng ?? null;
  const mapLat = activeEvent ? activeEvent.lat : assignedLat;
  const mapLng = activeEvent ? activeEvent.lng : assignedLng;

  // Compute total duration if punched in
  const dutyDuration = useMemo(() => {
    if (!log?.checkInTime) return null;
    const end = log.checkOutTime ? new Date(log.checkOutTime).getTime() : Date.now();
    const diffMs = Math.max(0, end - new Date(log.checkInTime).getTime());
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m`;
  }, [log]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-5xl max-h-[92vh] rounded-3xl bg-white shadow-2xl border border-neutral-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 bg-neutral-50/70">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#FF7A70] to-[#FFA07A] text-white shadow-sm font-bold text-sm">
              {employeeName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-neutral-900">{employeeName}</h2>
                <Badge variant="outline" className="text-[10px] font-semibold border-neutral-200 bg-white">
                  {emp?.employeeCode ?? "EMP"}
                </Badge>
                <Badge className="text-[10px] bg-teal-50 text-teal-700 hover:bg-teal-50 border-teal-200">
                  <Calendar className="h-3 w-3 mr-1 inline" />
                  {date}
                </Badge>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                <span>{emp?.department?.name ?? "Department"}</span>
                <span>•</span>
                <span className="flex items-center gap-1 text-neutral-700 font-medium">
                  <Building className="h-3 w-3 text-neutral-400" />
                  Assigned Site: {assignedSiteName}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
              disabled={isFetching}
              className="h-8 text-xs rounded-xl gap-1.5"
            >
              <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/60 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-neutral-400 space-y-3">
            <RefreshCw className="h-8 w-8 animate-spin text-[#FF7A70]" />
            <p className="text-sm font-medium text-neutral-600">Loading daily GPS trace and timestamps...</p>
          </div>
        ) : isError ? (
          <div className="p-8 text-center text-rose-600 text-sm">
            Failed to load trace information. Please try again.
          </div>
        ) : (
          <div className="flex flex-col flex-1 overflow-y-auto lg:overflow-hidden">
            {/* Day KPI Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-4 sm:px-5 py-3 bg-white border-b border-neutral-100 text-xs shrink-0">
              <div className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-100">
                <span className="text-neutral-400 block text-[10px] uppercase font-bold tracking-wider">
                  Punch-In Time
                </span>
                <span className="font-bold text-neutral-900 text-sm flex items-center gap-1 mt-0.5">
                  <LogIn className="h-3.5 w-3.5 text-emerald-600" />
                  {log?.checkInTime
                    ? new Date(log.checkInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : "No Punch In"}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-100">
                <span className="text-neutral-400 block text-[10px] uppercase font-bold tracking-wider">
                  Punch-Out Time
                </span>
                <span className="font-bold text-neutral-900 text-sm flex items-center gap-1 mt-0.5">
                  <LogOut className="h-3.5 w-3.5 text-rose-500" />
                  {log?.checkOutTime
                    ? new Date(log.checkOutTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : log?.checkInTime
                    ? "Currently Active"
                    : "—"}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-100">
                <span className="text-neutral-400 block text-[10px] uppercase font-bold tracking-wider">
                  Duty Duration
                </span>
                <span className="font-bold text-neutral-900 text-sm flex items-center gap-1 mt-0.5">
                  <Clock className="h-3.5 w-3.5 text-teal-600" />
                  {dutyDuration ?? "—"}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-100">
                <span className="text-neutral-400 block text-[10px] uppercase font-bold tracking-wider">
                  Total GPS Trace Pings
                </span>
                <span className="font-bold text-neutral-900 text-sm flex items-center gap-1 mt-0.5">
                  <Route className="h-3.5 w-3.5 text-[#FF7A70]" />
                  {events.length} recorded points
                </span>
              </div>
            </div>

            {/* Split View: Map + Chronological Timeline */}
            <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-0 lg:overflow-hidden">
              {/* Map Column (7 cols) */}
              <div className="lg:col-span-7 flex flex-col p-3.5 sm:p-4 bg-neutral-50/50 border-b lg:border-b-0 lg:border-r border-neutral-100 lg:overflow-y-auto">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-[#FF7A70]" />
                    <span className="text-xs font-bold text-neutral-800">
                      {activeEvent
                        ? `${activeEvent.type.replace("_", " ")} Location`
                        : "Assigned Work Site"}
                    </span>
                  </div>
                  {routeUrl && (
                    <a
                      href={routeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-[#FF7A70] hover:underline"
                    >
                      <Route className="h-3.5 w-3.5" />
                      View Entire Route in Google Maps
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>

                {mapLat != null && mapLng != null && (
                  <div className="rounded-2xl overflow-hidden border border-neutral-200 bg-white shadow-2xs">
                    <LocationMap
                      lat={mapLat}
                      lng={mapLng}
                      label={
                        activeEvent
                          ? `${employeeName} - ${activeEvent.type} at ${new Date(activeEvent.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                          : assignedSiteName
                      }
                      showCard={false}
                      height={280}
                    />
                  </div>
                )}

                {/* Active Point Detail Card */}
                {activeEvent ? (
                  <div className="mt-3 p-3 rounded-xl bg-white border border-neutral-200/80 shadow-2xs space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-neutral-900 flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-neutral-400" />
                        Timestamp:{" "}
                        {new Date(activeEvent.time).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border",
                          activeEvent.withinGeofence
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        )}
                      >
                        {activeEvent.withinGeofence ? (
                          <>
                            <ShieldCheck className="h-3 w-3" /> Workplace Location
                          </>
                        ) : (
                          <>
                            <ShieldAlert className="h-3 w-3" /> Outside Workplace
                          </>
                        )}
                      </span>
                    </div>
                    <p className="text-neutral-600 line-clamp-2">
                      <span className="font-medium text-neutral-400">Address: </span>
                      {activeEvent.address || "Location recorded by mobile GPS"}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-1">
                      <span>
                        Coords: {activeEvent.lat.toFixed(6)}, {activeEvent.lng.toFixed(6)}
                      </span>
                      <a
                        href={`https://www.google.com/maps?q=${activeEvent.lat},${activeEvent.lng}&z=17`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#FF7A70] font-semibold hover:underline flex items-center gap-1"
                      >
                        Open Exact Pin <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 p-3 rounded-xl bg-white border border-neutral-200 text-xs text-neutral-500 text-center">
                    No GPS location recorded for this employee on this date. Showing designated office premise.
                  </div>
                )}
              </div>

              {/* Timeline Column (5 cols) */}
              <div className="lg:col-span-5 flex flex-col p-3.5 sm:p-4 bg-white lg:overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                    Chronological Timeline & Pings
                  </h3>
                  <span className="text-[11px] text-neutral-400">
                    {events.length} event{events.length === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto pr-1 space-y-2 min-h-[220px] max-h-[380px] lg:max-h-[500px]">
                  {events.length === 0 ? (
                    <div className="py-12 text-center text-xs text-neutral-400 space-y-2">
                      <Clock className="h-7 w-7 mx-auto text-neutral-300" />
                      <p className="font-semibold text-neutral-600">No Location Events Recorded</p>
                      <p className="text-[11px]">
                        The employee has not checked in or sent 30-minute location pings for this date.
                      </p>
                    </div>
                  ) : (
                    events.map((event, idx) => {
                      const isSelected = idx === selectedEventIndex;
                      const timeStr = new Date(event.time).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      });

                      let typeBadge = (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded">
                          <Clock className="h-2.5 w-2.5" /> 30m Ping #{idx}
                        </span>
                      );
                      if (event.type === "CHECK_IN") {
                        typeBadge = (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                            <LogIn className="h-2.5 w-2.5" /> Punch In
                          </span>
                        );
                      } else if (event.type === "CHECK_OUT") {
                        typeBadge = (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded">
                            <LogOut className="h-2.5 w-2.5" /> Punch Out
                          </span>
                        );
                      }

                      return (
                        <div
                          key={event.id}
                          onClick={() => setSelectedEventIndex(idx)}
                          className={cn(
                            "cursor-pointer rounded-xl p-3 border transition-all text-xs space-y-1 relative",
                            isSelected
                              ? "border-[#FF7A70] bg-[#FF7A70]/5 shadow-2xs"
                              : "border-neutral-100 hover:border-neutral-200 bg-neutral-50/60"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              {typeBadge}
                              <span className="font-bold text-neutral-800">{timeStr}</span>
                            </div>
                            <span
                              className={cn(
                                "h-2 w-2 rounded-full",
                                event.withinGeofence ? "bg-emerald-500" : "bg-amber-500"
                              )}
                              title={event.withinGeofence ? "Workplace Location" : "Outside Workplace"}
                            />
                          </div>

                          <p className="text-neutral-600 text-[11px] line-clamp-1">
                            {event.address || `${event.lat.toFixed(5)}, ${event.lng.toFixed(5)}`}
                          </p>

                          <div className="flex items-center justify-between text-[10px] text-neutral-400 pt-0.5">
                            <span className="font-mono">
                              {event.lat.toFixed(4)}, {event.lng.toFixed(4)}
                            </span>
                            <span
                              className={cn(
                                "font-medium",
                                event.withinGeofence ? "text-emerald-600" : "text-amber-600"
                              )}
                            >
                              {event.withinGeofence ? "Workplace" : "Outside"}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-neutral-100 bg-neutral-50/80">
          <div className="text-[11px] text-neutral-500 flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-teal-700" />
            <span>Pings automatically log every 30 minutes while employee is signed into the portal.</span>
          </div>
          <Button
            size="sm"
            onClick={onClose}
            className="rounded-xl px-4 text-xs font-semibold bg-neutral-900 text-white hover:bg-neutral-800"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
