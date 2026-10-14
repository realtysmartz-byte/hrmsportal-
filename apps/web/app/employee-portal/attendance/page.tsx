"use client";

import { useSession } from "next-auth/react";
import { KekaAttendancePanel } from "@/components/KekaAttendancePanel";

export default function EmployeeAttendancePage() {
  const { data: session } = useSession();

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-1 sm:px-0">
      {/* Page Header */}
      <div>
        <h1 className="text-lg sm:text-xl font-semibold text-neutral-900">
          My Attendance
        </h1>
        <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">
          Keka-style attendance panel · Verified workplace check-ins, shift timings, 30-day records, and GPS Map View.
        </p>
      </div>

      {/* Main Keka-style Attendance Panel */}
      <KekaAttendancePanel
        employeeName={session?.user?.name ?? undefined}
      />
    </div>
  );
}
