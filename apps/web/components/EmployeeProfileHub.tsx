"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Calendar,
  FileText,
  Mail,
  MapPin,
  Network,
  Pencil,
  Phone,
  Trash2,
  Star,
  Target,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { cn, formatDate, fullName, initials } from "@/lib/utils";
import { DOCUMENT_TYPES, isWeeklyOffDay } from "@realty-smartz/shared";
import { LocationMap } from "@/components/LocationMap";

type TabId =
  | "overview"
  | "job"
  | "attendance"
  | "leave"
  | "documents"
  | "performance";

const DOC_LABELS: Record<string, string> = {
  PAN_CARD: "PAN Card",
  AADHAR_CARD: "Aadhar Card",
  OFFER_LETTER: "Offer Letter",
  EDUCATIONAL_CERTIFICATE: "Educational Certificate",
  OTHER: "Other",
};

const STATUS_COLOR: Record<string, string> = {
  PRESENT: "bg-emerald-600 text-white",
  LATE: "bg-amber-500 text-white",
  HALF_DAY: "bg-amber-600 text-white",
  ABSENT: "bg-maroon text-white",
  ON_LEAVE: "bg-indigo-100 text-primary font-medium",
  HOLIDAY: "bg-neutral-200 text-neutral-700",
};

function formatTime(value?: Date | string | null) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function EmployeeProfileHub({
  employeeId,
  portal,
}: {
  employeeId: string;
  portal: "admin" | "employee";
}) {
  const [tab, setTab] = useState<TabId>("overview");
  const utils = trpc.useUtils();

  const { data, isLoading, error } = trpc.employee.profileHub.useQuery({
    id: employeeId,
  });

  const basePath =
    portal === "admin" ? "/admin-portal/employees" : "/employee-portal/directory";
  const orgChartPath =
    portal === "admin"
      ? `/admin-portal/org-chart?highlight=${employeeId}`
      : `/employee-portal/org-chart?highlight=${employeeId}`;
  const editPath =
    portal === "admin"
      ? `/admin-portal/employees/${employeeId}/edit`
      : undefined;

  const deleteMutation = trpc.employee.delete.useMutation({
    onSuccess: () => {
      window.location.href = "/admin-portal/employees";
    },
  });

  const tabs = useMemo(() => {
    const all: { id: TabId; label: string; sensitive?: boolean }[] = [
      { id: "overview", label: "About" },
      { id: "job", label: "Job" },
      { id: "attendance", label: "Attendance", sensitive: true },
      { id: "leave", label: "Leave", sensitive: true },
      { id: "documents", label: "Documents", sensitive: true },
      { id: "performance", label: "Performance" },
    ];
    if (!data?.access.canViewSensitive) {
      return all.filter((t) => !t.sensitive);
    }
    return all;
  }, [data?.access.canViewSensitive]);

  if (isLoading) return <PageSkeleton />;

  if (error || !data) {
    return (
      <div className="section-gap">
        <p className="text-maroon-600">Employee not found.</p>
        <Link href={basePath}>
          <Button variant="outline">Back</Button>
        </Link>
      </div>
    );
  }

  const { employee: emp, access, overview, jobHistory } = data;

  return (
    <div className="w-full max-w-full overflow-hidden bg-white rounded-2xl border border-neutral-200/80 shadow-2xs">
      {/* Bento Obsidian + Radiant Coral banner */}
      <div className="relative">
        <div
          className="h-28 w-full md:h-36 relative overflow-hidden"
          style={{
            background:
              "linear-gradient(135deg, #11121A 0%, #181926 50%, #2A1722 100%)",
          }}
        >
          <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 50%, rgba(255,122,112,0.4) 0%, transparent 40%), radial-gradient(circle at 80% 20%, rgba(255,160,122,0.3) 0%, transparent 35%)",
            }}
          />
          <div className="absolute left-3 top-3 z-10 flex gap-2">
            <Link href={basePath}>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-white hover:bg-white/15"
                aria-label="Back"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <div className="absolute right-3 top-3 z-10 flex flex-wrap justify-end gap-2">
            {access.canEdit && editPath && (
              <Link href={editPath}>
                <Button
                  size="sm"
                  variant="secondary"
                  className="gap-1.5 bg-white/95 text-neutral-900 hover:bg-white shadow-2xs"
                >
                  <Pencil className="h-3.5 w-3.5 text-[#FF7A70]" />
                  Edit
                </Button>
              </Link>
            )}
            <Link href={orgChartPath}>
              <Button
                size="sm"
                variant="secondary"
                className="gap-1.5 bg-white/95 text-neutral-900 hover:bg-white shadow-2xs"
              >
                <Network className="h-3.5 w-3.5 text-[#FF7A70]" />
                Org Chart
              </Button>
            </Link>
            {access.canManage && (
              <Button
                size="sm"
                variant="destructive"
                className="gap-1.5"
                disabled={deleteMutation.isLoading}
                onClick={() => {
                  if (
                    confirm(
                      `Delete ${fullName(emp.firstName, emp.lastName)}? This cannot be undone.`
                    )
                  ) {
                    deleteMutation.mutate({ id: emp.id });
                  }
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        <div className="relative px-4 pb-0 pt-0 md:px-6">
          <div className="-mt-10 flex flex-col gap-4 sm:-mt-12 sm:flex-row sm:items-end sm:gap-5">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-gradient-to-tr from-[#FF7A70] to-[#FFA07A] font-display text-xl font-bold text-white shadow-md md:h-24 md:w-24 md:text-2xl">
              {emp.profilePhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={emp.profilePhotoUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                initials(emp.firstName, emp.lastName)
              )}
            </div>
            <div className="min-w-0 flex-1 pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-xl font-bold tracking-tight text-neutral-900 md:text-2xl">
                  {fullName(emp.firstName, emp.lastName)}
                </h1>
                <StatusBadge status={emp.status} />
              </div>
              <p className="mt-0.5 text-sm text-neutral-600 font-medium">
                {emp.designation?.title ?? "No designation"}
                {emp.department?.name ? ` · ${emp.department.name}` : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500 font-medium">
                <span className="inline-flex items-center gap-1">
                  <Mail className="h-3 w-3 text-neutral-400" />
                  {emp.email}
                </span>
                {emp.phone && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3 w-3 text-neutral-400" />
                    {emp.phone}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-neutral-400" />
                  {emp.workLocationName || "Gurugram"}
                </span>
                {emp.dateOfJoining && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-neutral-400" />
                    Joined {formatDate(emp.dateOfJoining)}
                  </span>
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Badge variant="outline">{emp.employeeCode}</Badge>
                <Badge variant="secondary">{emp.role}</Badge>
                <div className="flex min-w-[140px] max-w-xs flex-1 items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#FF7A70] to-[#FFA07A] transition-all duration-200"
                      style={{ width: `${emp.profileCompletion}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-semibold text-neutral-600">
                    {emp.profileCompletion}% Complete
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-0 z-20 border-b border-neutral-200/80 bg-white/95 backdrop-blur-md px-2 md:px-4">
        <div className="flex min-w-max gap-0 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "relative px-4 py-3.5 text-xs font-semibold uppercase tracking-wider transition-colors duration-150",
                tab === t.id
                  ? "text-[#FF7A70] font-bold"
                  : "text-neutral-500 hover:text-neutral-800"
              )}
            >
              {t.label}
              {tab === t.id && (
                <motion.span
                  layoutId="profile-tab"
                  className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-gradient-to-r from-[#FF7A70] to-[#FFA07A]"
                />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-neutral-50/80 p-4 md:p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {tab === "overview" && (
              <OverviewTab
                emp={emp}
                overview={overview}
                basePath={basePath}
                canViewSensitive={access.canViewSensitive}
              />
            )}
            {tab === "job" && (
              <JobTab emp={emp} jobHistory={jobHistory} basePath={basePath} />
            )}
            {tab === "attendance" && access.canViewSensitive && (
              <AttendanceTab employeeId={emp.id} />
            )}
            {tab === "leave" && access.canViewSensitive && (
              <LeaveTab
                employeeId={emp.id}
                canManage={access.canManage}
                onAdjusted={() => {
                  utils.employee.profileHub.invalidate({ id: emp.id });
                  utils.leave.forEmployee.invalidate({ employeeId: emp.id });
                }}
              />
            )}
            {tab === "documents" && access.canViewSensitive && (
              <DocumentsTab
                employeeId={emp.id}
                canUpload={access.canEdit}
              />
            )}
            {tab === "performance" && (
              <PerformanceTab employeeId={emp.id} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  href,
}: {
  label: string;
  value?: string | null;
  href?: string;
}) {
  return (
    <div className="flex justify-between gap-4 border-b border-dashed border-neutral-100 py-2 last:border-0">
      <span className="text-caption text-neutral-500">{label}</span>
      {href && value ? (
        <Link
          href={href}
          className="text-right text-sm font-medium text-teal-700 transition-colors hover:text-teal-800"
        >
          {value}
        </Link>
      ) : (
        <span className="text-right text-sm font-medium text-neutral-800">
          {value || "—"}
        </span>
      )}
    </div>
  );
}

function OverviewTab({
  emp,
  overview,
  basePath,
  canViewSensitive,
}: {
  emp: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    gender: string | null;
    dateOfBirth: Date | string | null;
    address: string | null;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
    designation: { title: string } | null;
    department: { name: string } | null;
    manager: {
      id: string;
      firstName: string;
      lastName: string;
      employeeCode: string;
    } | null;
    dateOfJoining: Date | string | null;
    status: string;
    directReports: { id: string; firstName: string; lastName: string; employeeCode: string; designation: { title: string } | null }[];
  };
  overview: {
    attendancePct: number | null;
    leaveDaysRemaining: number | null;
    daysSinceJoining: number | null;
    recentAttendance: {
      id: string;
      date: Date | string;
      checkInTime: Date | string | null;
      status: string;
    }[];
    recentLeave: {
      id: string;
      status: string;
      startDate: Date | string;
      endDate: Date | string;
      leaveType: { name: string };
    }[];
  };
  basePath: string;
  canViewSensitive: boolean;
}) {
  return (
    <div className="section-gap">
      {canViewSensitive && (
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard
            label="Attendance this month"
            value={
              overview.attendancePct != null
                ? `${overview.attendancePct}%`
                : "—"
            }
          />
          <StatCard
            label="Leave days remaining"
            value={
              overview.leaveDaysRemaining != null
                ? String(overview.leaveDaysRemaining)
                : "—"
            }
          />
          <StatCard
            label="Days since joining"
            value={
              overview.daysSinceJoining != null
                ? String(overview.daysSinceJoining)
                : "—"
            }
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Primary Details</CardTitle>
          </CardHeader>
          <CardContent>
            <InfoRow
              label="Name"
              value={fullName(emp.firstName, emp.lastName)}
            />
            <InfoRow label="DOB" value={formatDate(emp.dateOfBirth)} />
            <InfoRow label="Gender" value={emp.gender} />
            <InfoRow label="Phone" value={emp.phone} />
            <InfoRow label="Personal email" value={emp.email} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Job Details</CardTitle>
          </CardHeader>
          <CardContent>
            <InfoRow label="Designation" value={emp.designation?.title} />
            <InfoRow label="Department" value={emp.department?.name} />
            <InfoRow
              label="Manager"
              value={
                emp.manager
                  ? fullName(emp.manager.firstName, emp.manager.lastName)
                  : null
              }
              href={emp.manager ? `${basePath}/${emp.manager.id}` : undefined}
            />
            <InfoRow
              label="Date of joining"
              value={formatDate(emp.dateOfJoining)}
            />
            <InfoRow label="Status" value={emp.status.replace("_", " ")} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact & Address</CardTitle>
          </CardHeader>
          <CardContent>
            <InfoRow label="Address" value={emp.address} />
            <InfoRow
              label="Emergency contact"
              value={emp.emergencyContactName}
            />
            <InfoRow
              label="Emergency phone"
              value={emp.emergencyContactPhone}
            />
          </CardContent>
        </Card>
      </div>

      {canViewSensitive && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent check-ins</CardTitle>
            </CardHeader>
            <CardContent>
              {overview.recentAttendance.length === 0 ? (
                <p className="text-caption text-neutral-500">No attendance yet</p>
              ) : (
                <ul className="space-y-2">
                  {overview.recentAttendance.map((log) => (
                    <li
                      key={log.id}
                      className="flex items-center justify-between rounded-lg border border-neutral-100 px-3 py-2 text-sm"
                    >
                      <span>{formatDate(log.date)}</span>
                      <span className="text-neutral-500">
                        {formatTime(log.checkInTime)} · {log.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent leave</CardTitle>
            </CardHeader>
            <CardContent>
              {overview.recentLeave.length === 0 ? (
                <p className="text-caption text-neutral-500">No leave requests</p>
              ) : (
                <ul className="space-y-2">
                  {overview.recentLeave.map((req) => (
                    <li
                      key={req.id}
                      className="flex items-center justify-between rounded-lg border border-neutral-100 px-3 py-2 text-sm"
                    >
                      <span>
                        {req.leaveType.name} · {formatDate(req.startDate)}
                      </span>
                      <Badge variant="secondary">{req.status}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {emp.directReports.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Direct Reports ({emp.directReports.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 sm:grid-cols-2">
              {emp.directReports.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`${basePath}/${r.id}`}
                    className="block rounded-lg border border-neutral-200 px-3 py-2 text-sm transition-colors duration-150 hover:bg-neutral-50"
                  >
                    <span className="font-medium">
                      {fullName(r.firstName, r.lastName)}
                    </span>
                    <span className="block text-caption text-neutral-500">
                      {r.designation?.title ?? "—"} · {r.employeeCode}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border border-neutral-200/80 bg-white shadow-2xs">
      <CardContent className="p-4 sm:p-5">
        <p className="text-xs font-medium text-neutral-500">{label}</p>
        <p className="mt-1 font-display text-2xl font-bold text-primary">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function JobTab({
  emp,
  jobHistory,
  basePath,
}: {
  emp: {
    designation: { title: string } | null;
    department: { name: string } | null;
    manager: {
      id: string;
      firstName: string;
      lastName: string;
      employeeCode: string;
    } | null;
    dateOfJoining: Date | string | null;
    status: string;
    role: string;
    workLocationName: string | null;
  };
  jobHistory: {
    id: string;
    fieldChanged: string;
    oldValue: string | null;
    newValue: string | null;
    effectiveDate: Date | string;
    changedBy: { firstName: string; lastName: string } | null;
  }[];
  basePath: string;
}) {
  return (
    <div className="section-gap">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="border-b border-neutral-100 pb-3">
            <CardTitle className="text-base">Job Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 pt-5 sm:grid-cols-2">
            <DetailField
              label="Date of Joining"
              value={formatDate(emp.dateOfJoining)}
            />
            <DetailField
              label="Job Title"
              value={emp.designation?.title}
            />
            <DetailField label="Department" value={emp.department?.name} />
            <DetailField
              label="Location"
              value={emp.workLocationName || "Gurugram"}
            />
            <DetailField label="Worker Type" value="Full Time" />
            <DetailField
              label="Role"
              value={emp.role.replace("_", " ")}
            />
            <DetailField
              label="Employee Status"
              value={emp.status.replace("_", " ")}
            />
            <DetailField label="Business Unit" value="Realty Smartz Private Limited" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-neutral-100 pb-3">
            <CardTitle className="text-base">Organization</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            <DetailField label="Business Unit" value="Realty Smartz Private Limited" />
            <DetailField label="Department" value={emp.department?.name} />
            <DetailField
              label="Location"
              value={emp.workLocationName || "Gurugram"}
            />
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">
                Reporting Manager
              </p>
              {emp.manager ? (
                <Link
                  href={`${basePath}/${emp.manager.id}`}
                  className="mt-1 inline-flex items-center gap-2 text-sm font-medium text-teal-700 hover:underline"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-50 text-[10px] font-bold text-teal-800">
                    {initials(emp.manager.firstName, emp.manager.lastName)}
                  </span>
                  {fullName(emp.manager.firstName, emp.manager.lastName)}
                </Link>
              ) : (
                <p className="mt-1 text-sm text-neutral-800">—</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b border-neutral-100 pb-3">
          <CardTitle className="text-base">Employee Time</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 pt-5 sm:grid-cols-2 lg:grid-cols-3">
          <DetailField label="Weekly Off" value="Tuesday" />
          <DetailField
            label="Working days"
            value="Mon, Wed, Thu, Fri, Sat, Sun"
          />
          <DetailField label="Leave Policy" value="General Policy" />
          <DetailField
            label="Attendance Tracking"
            value="Enabled · every 30 min while signed in"
          />
          <DetailField label="Holiday List" value="National Holidays" />
          <DetailField label="Shift" value="General Shift" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-neutral-100 pb-3">
          <CardTitle className="text-base">Job history</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {jobHistory.length === 0 ? (
            <EmptyState
              title="No job changes yet"
              description="Designation, department, and manager changes will appear here."
              className="border-0 bg-transparent py-8"
            />
          ) : (
            <ul className="space-y-3">
              {jobHistory.map((h) => (
                <li
                  key={h.id}
                  className="rounded-lg border border-neutral-100 px-3 py-2 text-sm"
                >
                  <p className="font-medium capitalize text-neutral-800">
                    {h.fieldChanged} changed
                  </p>
                  <p className="text-caption text-neutral-500">
                    {h.oldValue || "—"} → {h.newValue || "—"} ·{" "}
                    {formatDate(h.effectiveDate)}
                    {h.changedBy
                      ? ` · by ${fullName(h.changedBy.firstName, h.changedBy.lastName)}`
                      : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-neutral-900">{value || "—"}</p>
    </div>
  );
}

function AttendanceTab({ employeeId }: { employeeId: string }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [page, setPage] = useState(1);
  const [mapLogId, setMapLogId] = useState<string | null>(null);

  const { data: monthData, isLoading: monthLoading } =
    trpc.attendance.forEmployeeMonth.useQuery({
      employeeId,
      year,
      month,
    });
  const { data: history, isLoading: histLoading } =
    trpc.attendance.forEmployeeHistory.useQuery({
      employeeId,
      year,
      month,
      page,
      pageSize: 15,
    });

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDow = new Date(year, month - 1, 1).getDay();
  const logByDay = useMemo(() => {
    const map = new Map<number, NonNullable<typeof monthData>["logs"][number]>();
    for (const log of monthData?.logs ?? []) {
      map.set(new Date(log.date).getUTCDate(), log);
    }
    return map;
  }, [monthData]);

  const stats = history?.allTimeSummary;

  return (
    <div className="section-gap">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Present (all time)" value={String(stats?.present ?? 0)} />
        <StatCard label="Absent (all time)" value={String(stats?.absent ?? 0)} />
        <StatCard
          label="Avg check-in"
          value={stats?.averageCheckIn ?? "—"}
        />
        <StatCard
          label="Outside geofence"
          value={String(stats?.outsideGeofence ?? 0)}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            {new Date(year, month - 1).toLocaleString("en", {
              month: "long",
              year: "numeric",
            })}
          </CardTitle>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setPage(1);
                if (month === 1) {
                  setMonth(12);
                  setYear((y) => y - 1);
                } else setMonth((m) => m - 1);
              }}
            >
              ‹
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setPage(1);
                if (month === 12) {
                  setMonth(1);
                  setYear((y) => y + 1);
                } else setMonth((m) => m + 1);
              }}
            >
              ›
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {monthLoading ? (
            <p className="text-caption text-neutral-500">Loading calendar…</p>
          ) : (
            <>
              <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] text-neutral-500">
                {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                  <div key={`${d}-${i}`}>{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDow }).map((_, i) => (
                  <div key={`e-${i}`} />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const log = logByDay.get(day);
                  const dow = new Date(year, month - 1, day).getDay();
                  return (
                    <div
                      key={day}
                      className={cn(
                        "flex h-9 items-center justify-center rounded-md text-xs transition-colors duration-150",
                        log
                          ? STATUS_COLOR[log.status]
                          : isWeeklyOffDay(dow)
                            ? "bg-neutral-100 text-neutral-400"
                            : "border border-neutral-200 bg-white"
                      )}
                    >
                      {day}
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-caption text-neutral-500">
                <span>Present: {monthData?.summary.present ?? 0}</span>
                <span>Absent: {monthData?.summary.absent ?? 0}</span>
                <span>Avg in: {monthData?.summary.averageCheckIn ?? "—"}</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Attendance log</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {histLoading ? (
            <p className="px-5 py-8 text-caption text-neutral-500">Loading…</p>
          ) : !history?.logs.length ? (
            <EmptyState
              title="No attendance records"
              description="Check-ins for this month will appear here."
              className="m-4"
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Check-in</TableHead>
                    <TableHead>Check-out</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Geofence</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Map</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(log.date)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{formatTime(log.checkInTime)}</div>
                        <div className="max-w-[180px] truncate text-caption text-neutral-500">
                          {log.checkInAddress || "—"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{formatTime(log.checkOutTime)}</div>
                        <div className="max-w-[180px] truncate text-caption text-neutral-500">
                          {log.checkOutAddress || "—"}
                        </div>
                      </TableCell>
                      <TableCell>
                        {log.totalHours != null ? `${log.totalHours}h` : "—"}
                      </TableCell>
                      <TableCell>
                        {log.checkInTime ? (
                          <Badge
                            variant={log.withinGeofence ? "success" : "warning"}
                          >
                            {log.withinGeofence ? "Inside" : "Outside"}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {log.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {log.checkInLat != null && log.checkInLng != null ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setMapLogId((id) =>
                                id === log.id ? null : log.id
                              )
                            }
                          >
                            {mapLogId === log.id ? "Hide" : "Map"}
                          </Button>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {mapLogId &&
                (() => {
                  const log = history.logs.find((l) => l.id === mapLogId);
                  if (
                    !log ||
                    log.checkInLat == null ||
                    log.checkInLng == null
                  ) {
                    return null;
                  }
                  return (
                    <div className="border-t border-neutral-100 p-4">
                      <LocationMap
                        lat={log.checkInLat}
                        lng={log.checkInLng}
                        label={log.checkInAddress}
                        height={220}
                      />
                    </div>
                  );
                })()}
            </div>
          )}
          {history && history.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-neutral-100 px-5 py-3">
              <p className="text-caption text-neutral-500">
                Page {history.page} of {history.totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= history.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LeaveTab({
  employeeId,
  canManage,
  onAdjusted,
}: {
  employeeId: string;
  canManage: boolean;
  onAdjusted: () => void;
}) {
  const { data, isLoading } = trpc.leave.forEmployee.useQuery({ employeeId });
  const [adjustTypeId, setAdjustTypeId] = useState("");
  const [allotted, setAllotted] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const adjust = trpc.leave.adjustBalance.useMutation({
    onSuccess: () => {
      setAdjustTypeId("");
      setAllotted("");
      setReason("");
      setError("");
      onAdjusted();
    },
    onError: (e) => setError(e.message),
  });

  if (isLoading) {
    return <p className="text-caption text-neutral-500">Loading leave…</p>;
  }

  return (
    <div className="section-gap">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(data?.balances ?? []).map((b) => (
          <Card key={b.id}>
            <CardContent className="pt-5">
              <p className="font-medium text-neutral-800">{b.leaveType.name}</p>
              <p className="mt-2 text-caption text-neutral-500">
                Allotted {b.allotted} · Used {b.used} · Remaining{" "}
                <span className="font-semibold text-teal-700">{b.remaining}</span>
              </p>
            </CardContent>
          </Card>
        ))}
        {!data?.balances.length && (
          <EmptyState
            title="No leave balances"
            description="Balances are created when leave types exist for the current year."
            className="sm:col-span-2 lg:col-span-3"
          />
        )}
      </div>

      {canManage && (data?.balances.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Adjust leave balance</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Leave type</Label>
              <Select
                value={adjustTypeId}
                onChange={(e) => setAdjustTypeId(e.target.value)}
              >
                <option value="">Select…</option>
                {data?.balances.map((b) => (
                  <option key={b.leaveTypeId} value={b.leaveTypeId}>
                    {b.leaveType.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>New allotted</Label>
              <Input
                type="number"
                min={0}
                value={allotted}
                onChange={(e) => setAllotted(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Reason</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Correction reason"
              />
            </div>
            {error && (
              <p className="text-sm text-maroon-600 sm:col-span-2 lg:col-span-4">
                {error}
              </p>
            )}
            <div className="sm:col-span-2 lg:col-span-4">
              <Button
                disabled={adjust.isLoading}
                onClick={() => {
                  if (!adjustTypeId || !allotted || reason.length < 3) {
                    setError("Select type, allotted days, and a reason (3+ chars).");
                    return;
                  }
                  adjust.mutate({
                    employeeId,
                    leaveTypeId: adjustTypeId,
                    allotted: Number(allotted),
                    reason,
                  });
                }}
              >
                Save adjustment
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Leave history</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!data?.requests.length ? (
            <EmptyState
              title="No leave requests"
              description="Leave applications for this employee will show here."
              className="m-4"
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Approver</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.requests.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.leaveType.name}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatDate(r.startDate)} → {formatDate(r.endDate)}
                      </TableCell>
                      <TableCell>{r.numberOfDays}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{r.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {r.approvedBy
                          ? fullName(r.approvedBy.firstName, r.approvedBy.lastName)
                          : "—"}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-caption text-neutral-500">
                        {r.approverNote || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DocumentsTab({
  employeeId,
  canUpload,
}: {
  employeeId: string;
  canUpload: boolean;
}) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.employee.documents.useQuery({ employeeId });
  const [documentType, setDocumentType] =
    useState<(typeof DOCUMENT_TYPES)[number]>("PAN_CARD");
  const [title, setTitle] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [error, setError] = useState("");

  const upload = trpc.employee.uploadDocument.useMutation({
    onSuccess: () => {
      setTitle("");
      setFileUrl("");
      setError("");
      utils.employee.documents.invalidate({ employeeId });
    },
    onError: (e) => setError(e.message),
  });

  const remove = trpc.employee.deleteDocument.useMutation({
    onSuccess: () => utils.employee.documents.invalidate({ employeeId }),
  });

  function onFile(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setFileUrl(String(reader.result || ""));
      if (!title) setTitle(file.name);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="section-gap">
      {canUpload && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload document</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Document type</Label>
              <Select
                value={documentType}
                onChange={(e) =>
                  setDocumentType(
                    e.target.value as (typeof DOCUMENT_TYPES)[number]
                  )
                }
              >
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {DOC_LABELS[t]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Title (optional)</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>File</Label>
              <Input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,image/*"
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-caption text-neutral-500">
                Or paste a URL below if the file is already hosted.
              </p>
              <Input
                placeholder="https://… or data URL"
                value={fileUrl.startsWith("data:") ? "" : fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
              />
              {fileUrl.startsWith("data:") && (
                <p className="text-caption text-teal-700">File ready to upload</p>
              )}
            </div>
            {error && (
              <p className="text-sm text-maroon-600 sm:col-span-2">{error}</p>
            )}
            <div className="sm:col-span-2">
              <Button
                disabled={upload.isLoading || !fileUrl}
                onClick={() =>
                  upload.mutate({
                    employeeId,
                    documentType,
                    title: title || null,
                    fileUrl,
                  })
                }
              >
                Upload
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documents</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="px-5 py-8 text-caption text-neutral-500">Loading…</p>
          ) : !data?.length ? (
            <EmptyState
              title="No documents yet"
              description="Identity and employment documents will be listed here."
              className="m-4"
            />
          ) : (
            <ul className="divide-y divide-neutral-100">
              {data.map((doc) => (
                <li
                  key={doc.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {DOC_LABELS[doc.documentType] ?? doc.documentType}
                        {doc.title ? ` — ${doc.title}` : ""}
                      </p>
                      <p className="text-caption text-neutral-500">
                        Uploaded {formatDate(doc.uploadedAt)}
                        {doc.uploadedBy
                          ? ` by ${fullName(doc.uploadedBy.firstName, doc.uploadedBy.lastName)}`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <a href={doc.fileUrl} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="outline">
                        View
                      </Button>
                    </a>
                    {canUpload && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm("Delete this document?")) {
                            remove.mutate({ id: doc.id });
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-maroon-600" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PerformanceTab({ employeeId }: { employeeId: string }) {
  const { data: cycles, isLoading } = trpc.performance.employeeHistory.useQuery({
    employeeId,
  });

  const [expandedCycleId, setExpandedCycleId] = useState<string | null>(null);

  if (isLoading) {
    return <p className="p-6 text-caption text-neutral-500">Loading performance history…</p>;
  }

  if (!cycles?.length) {
    return (
      <EmptyState
        title="No performance cycles recorded"
        description="Performance evaluations, goals, and ratings from closed cycles will appear here."
      />
    );
  }

  return (
    <div className="space-y-4">
      {cycles.map((item) => {
        const cycle = item.cycle;
        const isExpanded = expandedCycleId === cycle.id;
        const isClosed = cycle.status === "CLOSED";

        return (
          <Card key={cycle.id} className="overflow-hidden transition-all">
            <CardHeader
              className="cursor-pointer pb-4 hover:bg-neutral-50/50"
              onClick={() =>
                setExpandedCycleId(isExpanded ? null : cycle.id)
              }
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant={isClosed ? "secondary" : "success"}>
                      {cycle.status}
                    </Badge>
                    <Badge variant="outline">{cycle.cycleType}</Badge>
                  </div>
                  <h3 className="mt-2 text-heading-md font-bold text-neutral-900">
                    {cycle.name}
                  </h3>
                  <p className="mt-1 flex items-center gap-1.5 text-caption text-neutral-500">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>
                      {formatDate(cycle.startDate)} – {formatDate(cycle.endDate)}
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-caption text-neutral-500">Final Rating</p>
                    {item.finalRating != null ? (
                      <div className="flex items-center gap-1 text-base font-bold text-teal-800">
                        <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
                        <span>{item.finalRating} / 5</span>
                      </div>
                    ) : (
                      <span className="text-caption text-neutral-400">Pending</span>
                    )}
                  </div>

                  <Button variant="ghost" size="icon" className="text-neutral-400">
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5" />
                    ) : (
                      <ChevronDown className="h-5 w-5" />
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="border-t border-neutral-100 pt-6 space-y-6">
                <div>
                  <h4 className="text-sm font-bold text-neutral-800 mb-3 flex items-center gap-2">
                    <Target className="h-4 w-4 text-teal-600" />
                    Cycle Goals ({item.goals.length})
                  </h4>
                  {!item.goals.length ? (
                    <p className="text-caption text-neutral-500">No goals recorded in this cycle.</p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {item.goals.map((g) => (
                        <div
                          key={g.id}
                          className="rounded-xl border border-neutral-200 bg-white p-3.5 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <Badge variant="outline">{g.category}</Badge>
                            <Badge
                              variant={
                                g.status === "COMPLETED"
                                  ? "success"
                                  : g.status === "IN_PROGRESS"
                                    ? "warning"
                                    : "secondary"
                              }
                            >
                              {g.status.replace("_", " ")}
                            </Badge>
                          </div>
                          <p className="font-semibold text-neutral-900 text-sm">
                            {g.title}
                          </p>
                          {g.description && (
                            <p className="text-caption text-neutral-600 line-clamp-2">
                              {g.description}
                            </p>
                          )}
                          <div className="space-y-1 pt-1">
                            <div className="flex justify-between text-[11px] text-neutral-500">
                              <span>Progress</span>
                              <span className="font-semibold">{g.progressPercent}%</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-neutral-100 overflow-hidden">
                              <div
                                className="h-full bg-teal-600 rounded-full"
                                style={{ width: `${g.progressPercent}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid gap-4 lg:grid-cols-2 border-t border-neutral-100 pt-4">
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-4 space-y-2">
                    <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
                      <p className="font-semibold text-neutral-900 text-sm">
                        Self-Evaluation
                      </p>
                      {item.selfReview?.rating && (
                        <div className="flex items-center gap-1 text-caption font-bold text-teal-800">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                          {item.selfReview.rating} / 5
                        </div>
                      )}
                    </div>
                    {item.selfReview ? (
                      <div className="space-y-2 text-caption">
                        <div>
                          <span className="font-semibold text-neutral-700">Strengths: </span>
                          <span className="text-neutral-600">{item.selfReview.strengths || "—"}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-neutral-700">Improvements: </span>
                          <span className="text-neutral-600">{item.selfReview.improvements || "—"}</span>
                        </div>
                        {item.selfReview.comments && (
                          <div>
                            <span className="font-semibold text-neutral-700">Comments: </span>
                            <span className="text-neutral-600">{item.selfReview.comments}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-caption text-neutral-400">No self-evaluation recorded.</p>
                    )}
                  </div>

                  <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-4 space-y-2">
                    <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
                      <p className="font-semibold text-neutral-900 text-sm">
                        Manager Evaluation
                      </p>
                      {item.managerReview?.rating && (
                        <div className="flex items-center gap-1 text-caption font-bold text-teal-800">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                          {item.managerReview.rating} / 5
                        </div>
                      )}
                    </div>
                    {item.managerReview ? (
                      <div className="space-y-2 text-caption">
                        <div>
                          <span className="font-semibold text-neutral-700">Strengths: </span>
                          <span className="text-neutral-600">{item.managerReview.strengths || "—"}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-neutral-700">Areas to Improve: </span>
                          <span className="text-neutral-600">{item.managerReview.improvements || "—"}</span>
                        </div>
                        {item.managerReview.comments && (
                          <div>
                            <span className="font-semibold text-neutral-700">Comments: </span>
                            <span className="text-neutral-600">{item.managerReview.comments}</span>
                          </div>
                        )}
                        <p className="text-[11px] text-neutral-400 pt-1">
                          Evaluated by {fullName(item.managerReview.reviewer?.firstName, item.managerReview.reviewer?.lastName)}
                        </p>
                      </div>
                    ) : (
                      <p className="text-caption text-neutral-400">No manager evaluation recorded.</p>
                    )}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}

