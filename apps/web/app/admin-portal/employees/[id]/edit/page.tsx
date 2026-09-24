"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { EmployeeForm } from "@/components/EmployeeForm";
import { trpc } from "@/lib/trpc";
import { canManageEmployees } from "@realty-smartz/shared";
import type { Role } from "@realty-smartz/shared";

export default function EditEmployeePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session, status } = useSession();
  const role = (session?.user?.role ?? "EMPLOYEE") as Role;
  const allowed = canManageEmployees(role);
  const { data: emp, isLoading } = trpc.employee.byId.useQuery({
    id: params.id,
  });

  useEffect(() => {
    if (status === "authenticated" && !allowed) {
      router.replace("/admin-portal/employees");
    }
  }, [status, allowed, router]);

  if (status === "loading" || isLoading || !allowed) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  if (!emp) {
    return <p className="text-brand-maroon">Employee not found.</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Edit Employee</h1>
        <p className="text-muted-foreground">
          Update details for {emp.firstName} {emp.lastName} ({emp.employeeCode})
        </p>
      </div>
      <EmployeeForm
        mode="edit"
        employeeId={emp.id}
        initial={{
          firstName: emp.firstName,
          lastName: emp.lastName,
          email: emp.email,
          phone: emp.phone ?? "",
          gender: emp.gender ?? "",
          emergencyContactName: emp.emergencyContactName ?? "",
          emergencyContactPhone: emp.emergencyContactPhone ?? "",
          role: emp.role,
          designationId: emp.designationId ?? "",
          departmentId: emp.departmentId ?? "",
          managerId: emp.managerId ?? "",
          dateOfJoining: emp.dateOfJoining,
          dateOfBirth: emp.dateOfBirth,
          address: emp.address ?? "",
          profilePhotoUrl: emp.profilePhotoUrl ?? "",
          status: emp.status,
          workLocationName: emp.workLocationName ?? "",
        }}
      />
    </div>
  );
}
