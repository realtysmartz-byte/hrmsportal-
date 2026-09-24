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

const STATUS_COLOR: Record<string, string> = {
  PRESENT: "bg-brand-teal text-white",
  LATE: "bg-brand-warning text-white",
  HALF_DAY: "bg-brand-warning/80 text-white",
  ABSENT: "bg-brand-maroon text-white",
  ON_LEAVE: "bg-slate-400 text-white",
  HOLIDAY: "bg-slate-300 text-brand-text",
};

export default function EmployeeAttendancePage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState<number | null>(now.getDate());

  const { data } = trpc.attendance.myMonth.useQuery({ year, month });
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDow = new Date(year, month - 1, 1).getDay();

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
    <div className="space-y-4">
      <h1 className="text-lg font-bold">Attendance</h1>
      <CheckInOutCard />

      <div className="grid grid-cols-3 gap-2 text-center">
        <MiniStat label="Present" value={data?.summary.present ?? 0} />
        <MiniStat label="Absent" value={data?.summary.absent ?? 0} />
        <MiniStat label="Avg in" value={data?.summary.averageCheckIn ?? "—"} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-sm">
            {new Date(year, month - 1).toLocaleString("en", {
              month: "short",
              year: "numeric",
            })}
          </CardTitle>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (month === 1) {
                  setMonth(12);
                  setYear((y) => y - 1);
                } else setMonth((m) => m - 1);
              }}
            >
              ‹
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (month === 12) {
                  setMonth(1);
                  setYear((y) => y + 1);
                } else setMonth((m) => m + 1);
              }}
            >
              ›
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <div key={`${d}-${i}`}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDow }).map((_, i) => (
              <div key={`e-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const log = logByDay.get(day);
              const dow = new Date(year, month - 1, day).getDay();
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  className={cn(
                    "flex h-9 items-center justify-center rounded-md text-xs",
                    selectedDay === day && "ring-2 ring-brand-teal",
                    log
                      ? STATUS_COLOR[log.status]
                      : isWeeklyOffDay(dow)
                        ? "bg-slate-100 text-muted-foreground"
                        : "border bg-white"
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {selectedDay != null && (
        <Card>
          <CardContent className="space-y-2 pt-4 text-sm">
            <p className="font-medium">
              {selectedDay}/{month}/{year}
            </p>
            {!selectedLog && (
              <p className="text-muted-foreground">No record</p>
            )}
            {selectedLog && (
              <>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    {selectedLog.status.replace("_", " ")}
                  </Badge>
                  {selectedLog.checkInTime && (
                    <Badge
                      variant={
                        selectedLog.withinGeofence ? "success" : "warning"
                      }
                    >
                      {selectedLog.withinGeofence ? "In geofence" : "Outside"}
                    </Badge>
                  )}
                </div>
                <p>
                  In:{" "}
                  {selectedLog.checkInTime
                    ? new Date(selectedLog.checkInTime).toLocaleTimeString()
                    : "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {selectedLog.checkInAddress || "—"}
                </p>
                <p>
                  Out:{" "}
                  {selectedLog.checkOutTime
                    ? new Date(selectedLog.checkOutTime).toLocaleTimeString()
                    : "—"}
                </p>
                {selectedLog.checkInLat != null &&
                  selectedLog.checkInLng != null && (
                    <LocationMap
                      lat={selectedLog.checkInLat}
                      lng={selectedLog.checkInLng}
                      label={selectedLog.checkInAddress}
                      height={200}
                      className="mt-2"
                    />
                  )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-white p-3">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-lg font-bold text-brand-teal">{value}</p>
    </div>
  );
}
