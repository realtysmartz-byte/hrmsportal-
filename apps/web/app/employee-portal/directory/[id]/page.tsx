"use client";

import { useParams } from "next/navigation";
import { EmployeeProfileHub } from "@/components/EmployeeProfileHub";

export default function DirectoryProfilePage() {
  const params = useParams<{ id: string }>();
  return <EmployeeProfileHub employeeId={params.id} portal="employee" />;
}
