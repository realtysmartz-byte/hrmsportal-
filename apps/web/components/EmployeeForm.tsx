"use client";

import { userFacingErrorMessage } from "@/lib/user-facing-error";
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
import { Camera, ImageUp } from "lucide-react";
import { compressImage } from "@/lib/image-compress";

type EmployeeFormValues = {
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
  gender: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  bloodGroup: string;
  role: (typeof ROLES)[number];
  designationId: string;
  departmentId: string;
  managerId: string;
  dateOfJoining: string;
  dateOfBirth: string;
  statusEffectiveDate: string;
  address: string;
  profilePhotoUrl: string;
  status: (typeof EMPLOYEE_STATUSES)[number];
  workLocationName: string;
  workLocationLat: string;
  workLocationLng: string;
};

const emptyValues: EmployeeFormValues = {
  employeeCode: "",
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  phone: "",
  gender: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  bloodGroup: "",
  role: "EMPLOYEE",
  designationId: "",
  departmentId: "",
  managerId: "",
  dateOfJoining: "",
  dateOfBirth: "",
  statusEffectiveDate: "",
  address: "",
  profilePhotoUrl: "",
  status: "ACTIVE",
  workLocationName: "",
  workLocationLat: "",
  workLocationLng: "",
};

function toDateInput(value?: Date | string | null) {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toISOString().slice(0, 10);
}

type EmployeeFormProps = {
  mode: "create" | "edit";
  employeeId?: string;
  initial?: Partial<
    Omit<
      EmployeeFormValues,
      "dateOfJoining" | "dateOfBirth" | "statusEffectiveDate"
    >
  > & {
    dateOfJoining?: Date | string | null;
    dateOfBirth?: Date | string | null;
    statusEffectiveDate?: Date | string | null;
  };
  onCreated?: () => void;
};

export function EmployeeForm({ mode, employeeId, initial, onCreated }: EmployeeFormProps) {
  const router = useRouter();
  const [managerSearch, setManagerSearch] = useState("");
  const [error, setError] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [values, setValues] = useState<EmployeeFormValues>({
    ...emptyValues,
    ...initial,
    dateOfJoining: toDateInput(initial?.dateOfJoining),
    dateOfBirth: toDateInput(initial?.dateOfBirth),
    statusEffectiveDate: toDateInput(initial?.statusEffectiveDate),
    password: "",
    employeeCode: initial?.employeeCode ?? "",
    phone: initial?.phone ?? "",
    gender: initial?.gender ?? "",
    emergencyContactName: initial?.emergencyContactName ?? "",
    emergencyContactPhone: initial?.emergencyContactPhone ?? "",
    bloodGroup: initial?.bloodGroup ?? "",
    designationId: initial?.designationId ?? "",
    departmentId: initial?.departmentId ?? "",
    managerId: initial?.managerId ?? "",
    address: initial?.address ?? "",
    profilePhotoUrl: initial?.profilePhotoUrl ?? "",
    workLocationName: initial?.workLocationName ?? "",
    workLocationLat: initial?.workLocationLat ?? "",
    workLocationLng: initial?.workLocationLng ?? "",
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
    onError: (err) => setError(userFacingErrorMessage(err)),
  });

  const updateMutation = trpc.employee.update.useMutation({
    onSuccess: (emp) => {
      if (emp.statusEmailSent === false) {
        setError(
          "Employee details were saved, but the status email could not be sent. Check SMTP configuration and server mail logs."
        );
        return;
      }
      router.push(`/admin-portal/employees/${emp.id}`);
    },
    onError: (err) => setError(userFacingErrorMessage(err)),
  });

  async function onPhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoBusy(true);
    setError("");
    try {
      setField("profilePhotoUrl", await compressImage(file));
    } catch {
      setError("Could not process this photo. Please try another image.");
    } finally {
      setPhotoBusy(false);
    }
  }

  function setField<K extends keyof EmployeeFormValues>(
    key: K,
    value: EmployeeFormValues[K]
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    const parsedLat = values.workLocationLat.trim() ? parseFloat(values.workLocationLat) : null;
    const parsedLng = values.workLocationLng.trim() ? parseFloat(values.workLocationLng) : null;
    const hasSite = Number.isFinite(parsedLat) && Number.isFinite(parsedLng);
    if (!hasSite && (values.workLocationLat.trim() || values.workLocationLng.trim())) {
      setError("Enter both a valid latitude and longitude for the work location, or leave both empty to use the company office.");
      return;
    }

    const payload = {
      employeeCode: values.employeeCode.trim() || undefined,
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      phone: values.phone || null,
      gender: values.gender || null,
      emergencyContactName: values.emergencyContactName || null,
      emergencyContactPhone: values.emergencyContactPhone || null,
      bloodGroup: values.bloodGroup || null,
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
      workLocationName: hasSite ? values.workLocationName.trim() || null : null,
      workLocationLat: hasSite ? parsedLat : null,
      workLocationLng: hasSite ? parsedLng : null,
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
      statusEffectiveDate: values.statusEffectiveDate
        ? new Date(values.statusEffectiveDate)
        : null,
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
          <Field label="Blood Group">
            <Select
              value={values.bloodGroup}
              onChange={(e) => setField("bloodGroup", e.target.value)}
            >
              <option value="">Select…</option>
              {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </Select>
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
            <Field label="Profile Photo">
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-neutral-200 bg-neutral-50 text-xs text-neutral-400">
                  {values.profilePhotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={values.profilePhotoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    "No photo"
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#5D3EBC] px-3 py-2 text-xs font-semibold text-white">
                    <Camera className="h-4 w-4" />
                    Take Photo
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={onPhotoSelected}
                    />
                  </label>
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700">
                    <ImageUp className="h-4 w-4" />
                    Upload
                    <input type="file" accept="image/*" className="hidden" onChange={onPhotoSelected} />
                  </label>
                  {values.profilePhotoUrl && (
                    <button
                      type="button"
                      onClick={() => setField("profilePhotoUrl", "")}
                      className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
              {photoBusy && <p className="text-xs text-neutral-500">Compressing photo…</p>}
              <Input
                type="url"
                value={values.profilePhotoUrl.startsWith("data:") ? "" : values.profilePhotoUrl}
                onChange={(e) => setField("profilePhotoUrl", e.target.value)}
                placeholder="Or paste an image URL (https://...)"
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
          <Field label="Employee ID">
            <Input
              value={values.employeeCode}
              onChange={(e) => setField("employeeCode", e.target.value.toUpperCase())}
              placeholder={mode === "create" ? "Leave blank to auto-generate (e.g. RS-0061)" : ""}
              maxLength={30}
            />
          </Field>
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
          {mode === "edit" &&
            ["RESIGNED", "TERMINATED", "EXIT"].includes(values.status) && (
              <Field
                label={
                  values.status === "TERMINATED"
                    ? "Termination Date"
                    : "Date of Exit"
                }
              >
                <Input
                  type="date"
                  value={values.statusEffectiveDate}
                  onChange={(e) =>
                    setField("statusEffectiveDate", e.target.value)
                  }
                />
              </Field>
            )}
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
          {/* Work Mode & Assigned Workplace Location Allocation */}
          <div className="sm:col-span-2 rounded-lg border border-neutral-200 bg-neutral-50/70 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <Label className="text-sm font-bold text-neutral-900 flex items-center gap-1.5">
                  <span>📍 Assigned Work & Punch-In Location</span>
                  <span className="rounded-full bg-[#5D3EBC]/10 px-2 py-0.5 text-[10px] font-bold text-[#5D3EBC]">
                    Workplace Verified
                  </span>
                </Label>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Staff can only punch in at this designated workplace. Leave empty to use the company office from Company Settings.
                </p>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setField("workLocationName", "");
                    setField("workLocationLat", "");
                    setField("workLocationLng", "");
                  }}
                  className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-100 transition-colors"
                >
                  🏢 Use Company Office
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (navigator.geolocation) {
                      navigator.geolocation.getCurrentPosition(
                        (pos) => {
                          setField("workLocationLat", String(pos.coords.latitude));
                          setField("workLocationLng", String(pos.coords.longitude));
                          if (!values.workLocationName) {
                            setField("workLocationName", "Allocated Remote Site");
                          }
                        },
                        () => alert("Could not fetch device GPS coordinates."),
                        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
                      );
                    }
                  }}
                  className="rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-800 hover:bg-teal-100 transition-colors"
                >
                  📍 Detect Device GPS
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1 sm:col-span-1">
                <Label className="text-xs font-medium text-neutral-700">Location / Site Name</Label>
                <Input
                  placeholder="e.g. REALTY SMARTZ PVT LTD or Site A"
                  value={values.workLocationName}
                  onChange={(e) => setField("workLocationName", e.target.value)}
                  className="text-xs h-9 bg-white"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-neutral-700">Latitude</Label>
                <Input
                  placeholder="28.3997196"
                  value={values.workLocationLat}
                  onChange={(e) => setField("workLocationLat", e.target.value)}
                  className="text-xs h-9 tabular-nums bg-white"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-neutral-700">Longitude</Label>
                <Input
                  placeholder="77.0385682"
                  value={values.workLocationLng}
                  onChange={(e) => setField("workLocationLng", e.target.value)}
                  className="text-xs h-9 tabular-nums bg-white"
                />
              </div>
            </div>

            {values.workLocationLat && values.workLocationLng && (
              <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-1 border-t border-neutral-200/60">
                <span>Coordinates: {values.workLocationLat}, {values.workLocationLng}</span>
                <a
                  href={`https://www.google.com/maps?q=${values.workLocationLat},${values.workLocationLng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#5D3EBC] font-semibold hover:underline"
                >
                  Verify on Google Maps →
                </a>
              </div>
            )}
          </div>
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
