"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  const [outsideOnly, setOutsideOnly] = useState(false);
  const [mapEmployeeId, setMapEmployeeId] = useState<string | null>(null);

  const { data: departments } = trpc.department.list.useQuery(undefined, {
    enabled: allowed,
  });
  const { data, isLoading } = trpc.attendance.team.useQuery(
    {
      date: new Date(date),
      departmentId: departmentId || undefined,
      outsideGeofenceOnly: outsideOnly || undefined,
    },
    { enabled: allowed }
  );

  useEffect(() => {
    if (status === "authenticated" && !allowed) {
      router.replace("/admin-portal/dashboard");
    }
  }, [status, allowed, router]);

  const rows = useMemo(() => data?.rows ?? [], [data]);

  function exportCsv() {
    const header = [
      "Employee Code",
      "Name",
      "Department",
      "Status",
      "Check In",
      "Within Geofence",
      "Address",
    ];
    const lines = rows.map((r) => {
      const log = r.log;
      return [
        r.employee.employeeCode,
        fullName(r.employee.firstName, r.employee.lastName),
        r.employee.department?.name ?? "",
        log?.status ?? "ABSENT",
        log?.checkInTime ? new Date(log.checkInTime).toLocaleTimeString() : "",
        log ? (log.withinGeofence ? "Yes" : "No") : "",
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
    a.download = `attendance-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (status === "loading" || !allowed) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team Attendance</h1>
          <p className="text-muted-foreground">
            Review daily attendance and out-of-geofence check-ins
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={exportCsv}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          type="date"
          className="w-44"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <Select
          className="w-48"
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
        >
          <option value="">All departments</option>
          {departments?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={outsideOnly}
            onChange={(e) => setOutsideOnly(e.target.checked)}
          />
          Outside geofence only
        </label>
      </div>

      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Check-in</TableHead>
              <TableHead>Geofence</TableHead>
              <TableHead>Map</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6}>Loading...</TableCell>
              </TableRow>
            )}
            {!isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  No records for this filter.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.employee.id}>
                <TableCell>
                  <p className="font-medium">
                    {fullName(r.employee.firstName, r.employee.lastName)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.employee.employeeCode}
                  </p>
                </TableCell>
                <TableCell>{r.employee.department?.name ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {(r.log?.status ?? "ABSENT").replace("_", " ")}
                  </Badge>
                </TableCell>
                <TableCell>
                  {r.log?.checkInTime
                    ? new Date(r.log.checkInTime).toLocaleTimeString()
                    : "—"}
                </TableCell>
                <TableCell>
                  {!r.log?.checkInTime ? (
                    "—"
                  ) : (
                    <Badge
                      variant={r.log.withinGeofence ? "success" : "warning"}
                    >
                      {r.log.withinGeofence ? "Inside" : "Outside"}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {r.log?.checkInLat != null && r.log?.checkInLng != null ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setMapEmployeeId((id) =>
                          id === r.employee.id ? null : r.employee.id
                        )
                      }
                    >
                      {mapEmployeeId === r.employee.id ? "Hide" : "Map"}
                    </Button>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {mapEmployeeId &&
        (() => {
          const row = rows.find((r) => r.employee.id === mapEmployeeId);
          const log = row?.log;
          if (!log?.checkInLat || !log?.checkInLng) return null;
          return (
            <LocationMap
              lat={log.checkInLat}
              lng={log.checkInLng}
              label={`${fullName(row!.employee.firstName, row!.employee.lastName)} — ${log.checkInAddress || ""}`}
              height={240}
            />
          );
        })()}
    </div>
  );
}
