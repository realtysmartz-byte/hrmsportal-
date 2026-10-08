"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
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
import { isManager } from "@realty-smartz/shared";
import type { Role } from "@realty-smartz/shared";

export default function MyTeamPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const role = (session?.user?.role ?? "EMPLOYEE") as Role;
  const allowed = isManager(role);

  const { data, isLoading } = trpc.attendance.team.useQuery(
    { date: new Date() },
    { enabled: allowed }
  );

  useEffect(() => {
    if (status === "authenticated" && !allowed) {
      router.replace("/employee-portal/dashboard");
    }
  }, [status, allowed, router]);

  if (!allowed) {
    return <p className="text-caption text-neutral-500">Loading...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">My Team</h1>
        <p className="page-subtitle">
          Today&apos;s attendance for your direct reports
        </p>
      </div>
      <div className="rounded-xl border border-neutral-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Check-in</TableHead>
              <TableHead>Workplace</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={4}>Loading...</TableCell>
              </TableRow>
            )}
            {data?.rows.map((r) => (
              <TableRow key={r.employee.id}>
                <TableCell>
                  {fullName(r.employee.firstName, r.employee.lastName)}
                </TableCell>
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
                      {r.log.withinGeofence ? "Workplace" : "Outside"}
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && !data?.rows.length && (
              <TableRow>
                <TableCell colSpan={4} className="text-neutral-500">
                  No direct reports found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
