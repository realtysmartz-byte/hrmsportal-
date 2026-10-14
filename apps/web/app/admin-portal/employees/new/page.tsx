"use client";

import { Suspense, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { EmployeeForm } from "@/components/EmployeeForm";
import { canManageEmployees } from "@realty-smartz/shared";
import type { Role } from "@realty-smartz/shared";
import { trpc } from "@/lib/trpc";

function NewEmployeeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const role = (session?.user?.role ?? "EMPLOYEE") as Role;
  const allowed = canManageEmployees(role);

  const hireFrom = searchParams.get("hireFrom");
  const firstName =
    searchParams.get("firstName") ??
    searchParams.get("name")?.split(" ")[0] ??
    "";
  const lastName =
    searchParams.get("lastName") ??
    searchParams.get("name")?.split(" ").slice(1).join(" ") ??
    "";
  const email = searchParams.get("email") ?? "";
  const phone = searchParams.get("phone") ?? "";

  const updateStage = trpc.recruitment.updateStage.useMutation();

  useEffect(() => {
    if (status === "authenticated" && !allowed) {
      router.replace("/admin-portal/employees");
    }
  }, [status, allowed, router]);

  if (status === "loading" || !allowed) {
    return <p className="text-caption text-neutral-500">Loading...</p>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 overflow-hidden">
      <div>
        <h1 className="text-lg sm:text-xl font-semibold text-neutral-900">
          {hireFrom ? "Hire Candidate → Employee" : "Add New Employee"}
        </h1>
        <p className="mt-0.5 text-xs sm:text-sm text-neutral-500">
          {hireFrom
            ? "Pre-filled from ATS candidate. Confirm details and generate company account."
            : "Register a team member. Employee code is generated automatically."}
        </p>
      </div>
      <EmployeeForm
        mode="create"
        initial={{
          firstName,
          lastName,
          email,
          phone,
        }}
        onCreated={() => {
          if (hireFrom) {
            updateStage.mutate({
              id: hireFrom,
              currentStage: "HIRED",
            });
          }
        }}
      />
    </div>
  );
}

export default function NewEmployeePage() {
  return (
    <Suspense fallback={<p className="text-caption text-neutral-500">Loading...</p>}>
      <NewEmployeeInner />
    </Suspense>
  );
}
