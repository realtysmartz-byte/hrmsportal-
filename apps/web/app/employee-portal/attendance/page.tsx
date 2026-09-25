"use client";

import { useMemo, useState } from "react";
import { CheckInOutCard } from "@/components/CheckInOutCard";
import { LocationMap } from "@/components/LocationMap";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { isWeeklyOffDay } from "@realty-smartz/shared";
import { ChevronLeft, ChevronRight, MapPin, Calendar, Clock } from "lucide-react";

export default function EmployeeAttendancePage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState<number | null>(now.getDate());

  const { data } = trpc.attendance.myMonth.useQuery({ year, month });
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDow = new Date(year, month - 1, 1).getDay();

  const isCurrentMonth =
    now.getFullYear() === year && now.getMonth() + 1 === month;
  const todayDate = now.getDate();

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
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900">
          My Attendance
        </h1>
        <p className="text-sm text-neutral-500">
          Realty Smartz Private Limited · Daily check-ins, monthly calendar, and punctuality records
        </p>
      </div>

      {/* Check In / Out Card */}
      <CheckInOutCard />

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
