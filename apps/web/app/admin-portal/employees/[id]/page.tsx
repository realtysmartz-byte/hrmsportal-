"use client";

import { useParams } from "next/navigation";
import { EmployeeProfileHub } from "@/components/EmployeeProfileHub";

export default function AdminEmployeeProfilePage() {
  const params = useParams<{ id: string }>();
  return <EmployeeProfileHub employeeId={params.id} portal="admin" />;
}
