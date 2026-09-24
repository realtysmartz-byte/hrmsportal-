"use client";

import { useSession } from "next-auth/react";
import { EmployeeProfileHub } from "@/components/EmployeeProfileHub";
import { PageSkeleton } from "@/components/ui/skeleton";

export default function MyProfilePage() {
  const { data: session, status } = useSession();

  if (status === "loading" || !session?.user?.id) {
    return <PageSkeleton />;
  }

  return (
    <EmployeeProfileHub employeeId={session.user.id} portal="employee" />
  );
}
