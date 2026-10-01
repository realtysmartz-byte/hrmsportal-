"use client";

import { useMemo, useState } from "react";
import { CheckInOutCard } from "@/components/CheckInOutCard";
import { LocationMap } from "@/components/LocationMap";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { isWeeklyOffDay, formatTimeIST } from "@realty-smartz/shared";
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Zap,
  History,
} from "lucide-react";

export default function EmployeeAttendancePage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState<number | null>(now.getDate());

  const { data } = trpc.attendance.myMonth.useQuery({ year, month });
  const { data: recentWeek, isLoading: isWeekLoading } =
    trpc.attendance.myRecentWeek.useQuery();

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDow = new Date(year, month - 1, 1).getDay();

  const isCurrentMonth =
    now.getFullYear() === year && now.getMonth() + 1 === month;
  const todayDate = now.getDate();

  const selectedDateObj = useMemo(() => {
    if (selectedDay == null) return new Date();
    return new Date(year, month - 1, selectedDay);
  }, [year, month, selectedDay]);

  const { data: locationPings } = trpc.attendance.myLocationPings.useQuery({
    date: selectedDateObj,
    limit: 48,
  });

  const logByDay = useMemo(() => {
    const map = new Map<number, NonNullable<typeof data>["logs"][number]>();
    for (const log of data?.logs ?? []) {
      map.set(new Date(log.date).getUTCDate(), log);
    }
    return map;
  }, [data]);

  const selectedLog =
    selectedDay != null ? logByDay.get(selectedDay) ?? null : null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto overflow-hidden">
      {/* Page Header */}
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900">
          My Attendance
        </h1>
        <p className="text-sm text-neutral-500">
          Realty Smartz Private Limited · Daily check-ins, 1-week punch log, monthly calendar, and punctuality records
        </p>
      </div>

      {/* Check In / Out Card */}
      <CheckInOutCard />

      {/* 1-Week (Past 7 Days) Daily Punch In / Punch Out Record */}
      <Card className="border border-neutral-200/80 bg-white shadow-sm overflow-hidden">
        <CardHeader className="border-b border-neutral-100 bg-neutral-50/50 pb-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <History className="h-4 w-4" />
              </span>
              <div>
                <CardTitle className="font-display text-base font-bold text-neutral-900">
                  Past 7 Days Punch Record (1 Week)
                </CardTitle>
                <p className="text-xs text-neutral-500">
                  Live punch-in times, punch-out times, total hours worked, and shift status
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-neutral-500 font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Auto Punch-Out at 7:00 PM IST Active</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-neutral-200/80 bg-neutral-50/80 text-neutral-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-4 py-3">Date & Day</th>
                  <th className="px-4 py-3">Attendance Status</th>
                  <th className="px-4 py-3">Punch In</th>
                  <th className="px-4 py-3">Punch Out</th>
                  <th className="px-4 py-3">Total Hours</th>
                  <th className="px-4 py-3">Geofence / Location</th>
                  <th className="px-4 py-3">Notes / Audit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {isWeekLoading && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-xs text-neutral-400">
                      Loading your 7-day attendance records...
                    </td>
                  </tr>
                )}
                {!isWeekLoading && recentWeek?.map((day) => {
                  const log = day.log;
                  const isCheckedIn = Boolean(log?.checkInTime);
                  const isCheckedOut = Boolean(log?.checkOutTime);

                  return (
                    <tr
                      key={day.dateStr}
                      className={cn(
                        "hover:bg-neutral-50/60 transition-colors",
                        day.isToday && "bg-primary/5 font-medium"
                      )}
                    >
                      {/* Date & Day */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="font-semibold text-neutral-900">
                              {day.fullDayName}
                            </p>
                            <p className="text-[11px] text-neutral-500">
                              {day.formattedDate}
                            </p>
                          </div>
                          {day.isToday && (
                            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                              Today
                            </span>
                          )}
                          {day.isWeeklyOff && !log && (
                            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-500">
                              Weekly Off (Tue)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        {!log ? (
                          day.isWeeklyOff ? (
                            <span className="inline-flex items-center rounded-md bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold text-neutral-600">
                              Weekly Off
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-md bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-maroon border border-rose-200">
                              Absent
                            </span>
                          )
                        ) : log.status === "PRESENT" ? (
                          <span className="inline-flex items-center rounded-md bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                            Present
                          </span>
                        ) : log.status === "LATE" ? (
                          <span className="inline-flex items-center rounded-md bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
                            Late Punch
                          </span>
                        ) : log.status === "HALF_DAY" ? (
                          <span className="inline-flex items-center rounded-md bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 border border-amber-300">
                            Half Day (&lt; 4 hrs)
                          </span>
                        ) : log.status === "ON_LEAVE" ? (
                          <span className="inline-flex items-center rounded-md bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-primary border border-indigo-200">
                            On Leave
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold text-neutral-600">
                            {log.status}
                          </span>
                        )}
                      </td>

                      {/* Punch In */}
                      <td className="px-4 py-3.5">
                        {isCheckedIn ? (
                          <div className="flex items-center gap-1.5 font-semibold text-neutral-900">
                            <Clock className="h-3.5 w-3.5 text-primary" />
                            <span>{formatTimeIST(log!.checkInTime)}</span>
                          </div>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>

                      {/* Punch Out */}
                      <td className="px-4 py-3.5">
                        {isCheckedOut ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 font-semibold text-neutral-900">
                              <Clock className="h-3.5 w-3.5 text-emerald-600" />
                              <span>{formatTimeIST(log!.checkOutTime)}</span>
                            </div>
                            {log!.isAutoCheckedOut && (
                              <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.2 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                                ⚡ Auto 7:00 PM
                              </span>
                            )}
                          </div>
                        ) : isCheckedIn ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-primary border border-indigo-200 animate-pulse">
                            On Duty (Auto 7 PM)
                          </span>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>

                      {/* Total Hours */}
                      <td className="px-4 py-3.5 font-semibold text-neutral-900">
                        {log?.totalHours != null ? (
                          <span className={cn(
                            log.totalHours >= 8 ? "text-emerald-700" : log.totalHours < 4 ? "text-amber-700" : "text-neutral-800"
                          )}>
                            {log.totalHours} hrs
                          </span>
                        ) : (
                          <span className="text-neutral-400 font-normal">—</span>
                        )}
                      </td>

                      {/* Geofence / Location */}
                      <td className="px-4 py-3.5">
                        {isCheckedIn ? (
                          <div className="space-y-0.5">
                            <span className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                              log!.withinGeofence
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-amber-50 text-amber-800 border border-amber-300"
                            )}>
                              {log!.withinGeofence ? (
                                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              ) : (
                                <AlertTriangle className="h-3 w-3 text-amber-600" />
                              )}
                              <span>{log!.withinGeofence ? "Inside Office" : "Outside Geofence"}</span>
                            </span>
                            {log?.checkInAddress && (
                              <p className="text-[10px] text-neutral-400 truncate max-w-[180px]" title={log.checkInAddress.replace(/sunbreeze/gi, "Realty Smartz Private Limited")}>
                                {log.checkInAddress.replace(/sunbreeze/gi, "Realty Smartz Private Limited")}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>

                      {/* Notes / Audit */}
                      <td className="px-4 py-3.5 text-neutral-600 text-[11px]">
                        {log?.notes ? (
                          <span className="truncate max-w-[200px] block" title={log.notes}>
                            {log.notes}
                          </span>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>


      {/* Mini Stats Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat label="Days Present" value={data?.summary.present ?? 0} color="text-emerald-700" />
        <MiniStat label="Days Absent" value={data?.summary.absent ?? 0} color="text-maroon" />
        <MiniStat label="Avg Check-in" value={data?.summary.averageCheckIn ?? "—"} color="text-primary" />
        <MiniStat label="Outside Geofence" value={data?.summary.outsideGeofence ?? 0} color="text-amber-700" />
      </div>

      {/* Calendar Card */}
      <Card className="border border-neutral-200/80 bg-white shadow-2xs">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <CardTitle className="font-display text-base font-bold text-neutral-900">
              {new Date(year, month - 1).toLocaleString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </CardTitle>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => {
                if (month === 1) {
                  setMonth(12);
                  setYear((y) => y - 1);
                } else setMonth((m) => m - 1);
              }}
              title="Previous Month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => {
                if (month === 12) {
                  setMonth(1);
                  setYear((y) => y + 1);
                } else setMonth((m) => m + 1);
              }}
              title="Next Month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Day of Week Headers */}
          <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-semibold uppercase tracking-wider text-neutral-500">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
              <div key={`${d}-${i}`} className="py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Day Cells Grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: firstDow }).map((_, i) => (
              <div key={`empty-${i}`} className="h-11 rounded-lg" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const log = logByDay.get(day);
              const dow = new Date(year, month - 1, day).getDay();
              const isToday = isCurrentMonth && day === todayDate;
              const isSelected = selectedDay === day;
              const isWeekend = isWeeklyOffDay(dow);

              let statusStyles = "bg-white text-neutral-700 border border-neutral-200/80 hover:bg-neutral-50";
              if (log) {
                switch (log.status) {
                  case "PRESENT":
                    statusStyles = "bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs";
                    break;
                  case "LATE":
                    statusStyles = "bg-amber-500 text-white hover:bg-amber-600 shadow-2xs";
                    break;
                  case "HALF_DAY":
                    statusStyles = "bg-amber-600 text-white hover:bg-amber-700 shadow-2xs";
                    break;
                  case "ABSENT":
                    statusStyles = "bg-maroon text-white hover:bg-maroon-700 shadow-2xs";
                    break;
                  case "ON_LEAVE":
                    statusStyles = "bg-indigo-100 text-primary font-medium hover:bg-indigo-200";
                    break;
                  case "HOLIDAY":
                    statusStyles = "bg-neutral-200 text-neutral-700 hover:bg-neutral-300";
                    break;
                }
              } else if (isWeekend) {
                statusStyles = "bg-neutral-100/80 text-neutral-400 border border-neutral-100";
              }

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  className={cn(
                    "relative flex h-11 flex-col items-center justify-center rounded-lg text-xs font-medium transition-all",
                    statusStyles,
                    // Today's cell gets a distinct ring/border to stand out
                    isToday && "ring-2 ring-primary ring-offset-2 font-bold",
                    isSelected && !isToday && "ring-2 ring-neutral-900 ring-offset-1"
                  )}
                >
                  <span>{day}</span>
                  {isToday && (
                    <span className="absolute bottom-1 h-1 w-1 rounded-full bg-current opacity-80" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Calendar Color Legend */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-3 border-t border-neutral-100 text-xs text-neutral-600">
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-md bg-emerald-600 shadow-2xs" />
              <span>Present</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-md bg-amber-500 shadow-2xs" />
              <span>Late / Half Day</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-md bg-maroon shadow-2xs" />
              <span>Absent</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-md bg-indigo-100 border border-indigo-200" />
              <span>On Leave</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-md bg-neutral-100 border border-neutral-200" />
              <span>Weekend / Off</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selected Day Detail Card */}
      {selectedDay != null && (
        <Card className="border border-neutral-200/80 bg-white shadow-2xs">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-neutral-900">
                Log Details: {new Date(year, month - 1, selectedDay).toLocaleDateString("en-US", {
                  weekday: "long",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </CardTitle>
              {isCurrentMonth && selectedDay === todayDate && (
                <Badge variant="outline" className="border-primary text-primary font-semibold">
                  Today
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-0 text-sm">
            {!selectedLog ? (
              <p className="text-xs text-neutral-500 py-2">
                No attendance punches logged for this date.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="font-medium">
                    {selectedLog.status.replace("_", " ")}
                  </Badge>
                  {selectedLog.checkInTime && (
                    <Badge variant={selectedLog.withinGeofence ? "success" : "warning"}>
                      {selectedLog.withinGeofence ? "Within Office Geofence" : "Outside Usual Location"}
                    </Badge>
                  )}
                  {selectedLog.totalHours != null && (
                    <Badge variant="outline">
                      {selectedLog.totalHours} hrs worked
                    </Badge>
                  )}
                </div>

                <div className="grid gap-2 sm:grid-cols-2 text-xs text-neutral-700 bg-neutral-50 p-3 rounded-lg border border-neutral-200/60">
                  <div>
                    <span className="font-semibold text-neutral-900">Check In:</span>{" "}
                    {selectedLog.checkInTime
                      ? new Date(selectedLog.checkInTime).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </div>
                  <div>
                    <span className="font-semibold text-neutral-900">Check Out:</span>{" "}
                    {selectedLog.checkOutTime
                      ? new Date(selectedLog.checkOutTime).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </div>
                  {selectedLog.checkInAddress && (
                    <div className="col-span-full flex items-start gap-1 pt-1 text-neutral-600">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-neutral-400 mt-0.5" />
                      <span className="truncate">{selectedLog.checkInAddress}</span>
                    </div>
                  )}
                </div>

                {selectedLog.checkInLat != null && selectedLog.checkInLng != null && (
                  <div className="overflow-hidden rounded-xl border border-neutral-200">
                    <LocationMap
                      lat={selectedLog.checkInLat}
                      lng={selectedLog.checkInLng}
                      label={selectedLog.checkInAddress || "Check-in point"}
                      height={180}
                    />
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 30-Minute Automated Location History Card */}
      <Card className="rounded-2xl border border-neutral-200/80 bg-white shadow-2xs">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                <MapPin className="h-4 w-4" />
              </span>
              <CardTitle className="text-base font-bold text-neutral-900">
                30-Minute Location History
              </CardTitle>
            </div>
            <Badge variant="outline" className="text-[10px] font-semibold text-teal-700 border-teal-200 bg-teal-50/50">
              Auto-tracked every 30m
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {!locationPings || locationPings.length === 0 ? (
            <p className="text-xs text-neutral-400 py-4 text-center">
              No location traces recorded for this day. Location traces are captured every 30 minutes while you are signed in.
            </p>
          ) : (
            <div className="divide-y divide-neutral-100 max-h-64 overflow-y-auto">
              {locationPings.map((ping) => (
                <div key={ping.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <Clock className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                    <span className="font-semibold text-neutral-800 shrink-0">
                      {new Date(ping.capturedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="text-neutral-500 truncate" title={ping.address || ""}>
                      {ping.address || `${ping.lat.toFixed(4)}, ${ping.lng.toFixed(4)}`}
                    </span>
                  </div>
                  <a
                    href={`https://www.google.com/maps?q=${ping.lat},${ping.lng}&z=16`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#FF7A70] hover:underline font-semibold shrink-0 text-[11px]"
                  >
                    Map &rarr;
                  </a>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MiniStat({
  label,
  value,
  color = "text-primary",
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-200/80 bg-white p-3.5 shadow-2xs">
      <p className="text-[11px] font-medium text-neutral-500">{label}</p>
      <p className={cn("mt-1 font-display text-2xl font-bold tracking-tight", color)}>
        {value}
      </p>
    </div>
  );
}
