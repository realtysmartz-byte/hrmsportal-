"use client";

import { useSession } from "next-auth/react";
import { KekaAttendancePanel } from "@/components/KekaAttendancePanel";

export default function EmployeeAttendancePage() {
  const { data: session } = useSession();

  return (
    <div className="space-y-4 max-w-7xl mx-auto px-1 sm:px-0">
      <h1 className="text-xl sm:text-2xl font-bold text-[var(--ink)]">
        My attendance
      </h1>

      <KekaAttendancePanel
        employeeName={session?.user?.name ?? undefined}
      />
    </div>
  );
}
