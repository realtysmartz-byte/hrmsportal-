"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { EMPLOYEE_STATUSES, ROLES } from "@realty-smartz/shared";

type EmployeeFormValues = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
  gender: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  role: (typeof ROLES)[number];
  designationId: string;
  departmentId: string;
  managerId: string;
  dateOfJoining: string;
  dateOfBirth: string;
  address: string;
  profilePhotoUrl: string;
  status: (typeof EMPLOYEE_STATUSES)[number];
  workLocationName: string;
};

const emptyValues: EmployeeFormValues = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  phone: "",
  gender: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  role: "EMPLOYEE",
  designationId: "",
  departmentId: "",
  managerId: "",
  dateOfJoining: "",
  dateOfBirth: "",
  address: "",
  profilePhotoUrl: "",
  status: "ACTIVE",
  workLocationName: "Realty Smartz Private Limited HQ, Gurugram",
};

function toDateInput(value?: Date | string | null) {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toISOString().slice(0, 10);
}

type EmployeeFormProps = {
  mode: "create" | "edit";
  employeeId?: string;
  initial?: Partial<Omit<EmployeeFormValues, "dateOfJoining" | "dateOfBirth">> & {
    dateOfJoining?: Date | string | null;
    dateOfBirth?: Date | string | null;
  };
  onCreated?: () => void;
};

export function EmployeeForm({ mode, employeeId, initial, onCreated }: EmployeeFormProps) {
  const router = useRouter();
  const [managerSearch, setManagerSearch] = useState("");
  const [error, setError] = useState("");
  const [values, setValues] = useState<EmployeeFormValues>({
    ...emptyValues,
    ...initial,
    dateOfJoining: toDateInput(initial?.dateOfJoining),
    dateOfBirth: toDateInput(initial?.dateOfBirth),
    password: "",
    phone: initial?.phone ?? "",
    gender: initial?.gender ?? "",
    emergencyContactName: initial?.emergencyContactName ?? "",
    emergencyContactPhone: initial?.emergencyContactPhone ?? "",
    designationId: initial?.designationId ?? "",
    departmentId: initial?.departmentId ?? "",
    managerId: initial?.managerId ?? "",
    address: initial?.address ?? "",
    profilePhotoUrl: initial?.profilePhotoUrl ?? "",
    workLocationName:
      initial?.workLocationName ?? "Realty Smartz Private Limited HQ, Gurugram",
  });

  const { data: departments } = trpc.department.list.useQuery();
  const { data: designations } = trpc.designation.list.useQuery();
  const { data: managers } = trpc.employee.managerOptions.useQuery();

  const filteredManagers = useMemo(() => {
    const q = managerSearch.trim().toLowerCase();
    const list = (managers ?? []).filter((m) => m.id !== employeeId);
    if (!q) return list;
    return list.filter((m) => {
      const label = `${m.firstName} ${m.lastName} ${m.employeeCode}`.toLowerCase();
      return label.includes(q);
    });
  }, [managers, managerSearch, employeeId]);

  const createMutation = trpc.employee.create.useMutation({
    onSuccess: (emp) => {
      onCreated?.();
      router.push(`/admin-portal/employees/${emp.id}`);
    },
    onError: (err) => setError(err.message),
  });

  const updateMutation = trpc.employee.update.useMutation({
    onSuccess: (emp) => router.push(`/admin-portal/employees/${emp.id}`),
    onError: (err) => setError(err.message),
  });

  function setField<K extends keyof EmployeeFormValues>(
    key: K,
    value: EmployeeFormValues[K]
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    const payload = {
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      phone: values.phone || null,
      gender: values.gender || null,
      emergencyContactName: values.emergencyContactName || null,
      emergencyContactPhone: values.emergencyContactPhone || null,
      role: values.role,
      designationId: values.designationId || null,
      departmentId: values.departmentId || null,
      managerId: values.managerId || null,
      dateOfJoining: values.dateOfJoining
        ? new Date(values.dateOfJoining)
        : null,
      dateOfBirth: values.dateOfBirth ? new Date(values.dateOfBirth) : null,
      address: values.address || null,
      profilePhotoUrl: values.profilePhotoUrl || null,
      status: values.status,
      workLocationName: values.workLocationName || null,
    };

    if (mode === "create") {
      if (!values.password) {
        setError("Password is required for new employees");
        return;
      }
      createMutation.mutate({ ...payload, password: values.password });
      return;
    }

    if (!employeeId) return;
    updateMutation.mutate({
      id: employeeId,
      ...payload,
      password: values.password || undefined,
    });
  }

  const busy = createMutation.isLoading || updateMutation.isLoading;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Personal Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="First Name" required>
            <Input
              value={values.firstName}
              onChange={(e) => setField("firstName", e.target.value)}
              required
            />
          </Field>
          <Field label="Last Name" required>
            <Input
              value={values.lastName}
              onChange={(e) => setField("lastName", e.target.value)}
              required
            />
          </Field>
          <Field label="Email" required>
            <Input
              type="email"
              value={values.email}
              onChange={(e) => setField("email", e.target.value)}
              required
            />
          </Field>
          <Field
            label={mode === "create" ? "Password" : "Password (leave blank to keep)"}
            required={mode === "create"}
          >
            <Input
              type="password"
              value={values.password}
              onChange={(e) => setField("password", e.target.value)}
              required={mode === "create"}
              minLength={6}
            />
          </Field>
          <Field label="Phone">
            <Input
              value={values.phone}
              onChange={(e) => setField("phone", e.target.value)}
            />
          </Field>
          <Field label="Gender">
            <Select
              value={values.gender}
              onChange={(e) => setField("gender", e.target.value)}
            >
              <option value="">Select…</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </Select>
          </Field>
          <Field label="Date of Birth">
            <Input
              type="date"
              value={values.dateOfBirth}
              onChange={(e) => setField("dateOfBirth", e.target.value)}
            />
          </Field>
          <Field label="Emergency contact name">
            <Input
              value={values.emergencyContactName}
              onChange={(e) =>
                setField("emergencyContactName", e.target.value)
              }
            />
          </Field>
          <Field label="Emergency contact phone">
            <Input
              value={values.emergencyContactPhone}
              onChange={(e) =>
                setField("emergencyContactPhone", e.target.value)
              }
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Address">
              <Textarea
                value={values.address}
                onChange={(e) => setField("address", e.target.value)}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Profile Photo URL">
              <Input
                type="url"
                value={values.profilePhotoUrl}
                onChange={(e) => setField("profilePhotoUrl", e.target.value)}
                placeholder="https://..."
              />
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-xs text-neutral-500 font-medium">Photo source:</span>
                {values.profilePhotoUrl ? (
                  <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-neutral-100 text-neutral-800 border border-neutral-200">
                    {values.profilePhotoUrl.includes("googleusercontent.com") || values.profilePhotoUrl.includes("google")
                      ? "Google Account"
                      : "Custom Upload"}
                  </span>
                ) : (
                  <span className="text-xs text-neutral-400">None set (uses initials)</span>
                )}
              </div>
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Work Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Role">
            <Select
              value={values.role}
              onChange={(e) =>
                setField("role", e.target.value as EmployeeFormValues["role"])
              }
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select
              value={values.status}
              onChange={(e) =>
                setField(
                  "status",
                  e.target.value as EmployeeFormValues["status"]
                )
              }
            >
              {EMPLOYEE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Department">
            <Select
              value={values.departmentId}
              onChange={(e) => setField("departmentId", e.target.value)}
            >
              <option value="">Select department</option>
              {departments?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Designation">
            <Select
              value={values.designationId}
              onChange={(e) => setField("designationId", e.target.value)}
            >
              <option value="">Select designation</option>
              {designations?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date of Joining">
            <Input
              type="date"
              value={values.dateOfJoining}
              onChange={(e) => setField("dateOfJoining", e.target.value)}
            />
          </Field>
          <Field label="Work Location">
            <Input
              value={values.workLocationName}
              onChange={(e) => setField("workLocationName", e.target.value)}
            />
          </Field>
          <div className="sm:col-span-2 space-y-2">
            <Label>Manager</Label>
            <Input
              placeholder="Search managers..."
              value={managerSearch}
              onChange={(e) => setManagerSearch(e.target.value)}
            />
            <Select
              value={values.managerId}
              onChange={(e) => setField("managerId", e.target.value)}
            >
              <option value="">No manager (top-level)</option>
              {filteredManagers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.firstName} {m.lastName} ({m.employeeCode})
                  {m.designation?.title ? ` — ${m.designation.title}` : ""}
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      {error && (
        <p className="text-sm text-brand-maroon" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={busy}>
          {busy
            ? "Saving..."
            : mode === "create"
              ? "Create Employee"
              : "Save Changes"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={busy}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required ? " *" : ""}
      </Label>
      {children}
    </div>
  );
}
