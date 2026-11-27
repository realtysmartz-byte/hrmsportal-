"use client";

import { userFacingErrorMessage } from "@/lib/user-facing-error";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";
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
  Camera,
  Upload,
  ShieldCheck,
  Building,
  Check,
  X,
  Clock,
  ExternalLink,
  RefreshCw,
  ImageUp,
} from "lucide-react";
import { compressImage } from "@/lib/image-compress";
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
import { toast } from "@/lib/toast";
import { cn, formatDate, fullName, initials } from "@/lib/utils";
import { DOCUMENT_TYPES, isWeeklyOffDay, HALF_DAY_SLOT_LABELS } from "@realty-smartz/shared";
import { LocationMap } from "@/components/LocationMap";
import { AssignLocationCard } from "@/components/AssignLocationCard";
import { KekaAttendancePanel } from "@/components/KekaAttendancePanel";

type TabId =
  | "overview"
  | "job"
  | "attendance"
  | "leave"
  | "documents"
  | "performance"
  | "location";

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

function buildProfileLink(basePath: string, targetId: string): string {
  if (basePath.startsWith("/admin-portal")) {
    const qIdx = basePath.indexOf("?");
    const pathOnly = qIdx >= 0 ? basePath.slice(0, qIdx) : basePath;
    const query = qIdx >= 0 ? basePath.slice(qIdx) : "";
    return `${pathOnly}/${targetId}${query}`;
  }
  return `/employee-portal/directory/${targetId}`;
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

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    if (typeof document !== "undefined") {
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  }, [employeeId, isLoading]);

  const router = useRouter();
  const searchParams = useSearchParams();
  const pageParam = searchParams.get("page") || (typeof window !== "undefined" ? sessionStorage.getItem("admin_employees_page") : null);

  const basePath =
    portal === "admin"
      ? (pageParam && Number(pageParam) > 1 ? `/admin-portal/employees?page=${pageParam}` : "/admin-portal/employees")
      : "/employee-portal/dashboard";
  const editPath =
    portal === "admin" && employeeId
      ? `/admin-portal/employees/${employeeId}/edit${pageParam && Number(pageParam) > 1 ? `?page=${pageParam}` : ""}`
      : undefined;

  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [photoInputUrl, setPhotoInputUrl] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  useBodyScrollLock(showPhotoModal);

  async function onPhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoBusy(true);
    try {
      setPhotoPreview(await compressImage(file));
      setPhotoInputUrl("");
    } catch {
      alert("Could not process this photo. Please try another image.");
    } finally {
      setPhotoBusy(false);
    }
  }

  const deleteMutation = trpc.employee.delete.useMutation({
    onSuccess: () => {
      window.location.href = "/admin-portal/employees";
    },
  });

  const updatePhotoMutation = trpc.employee.updateMyPhoto.useMutation({
    onSuccess: () => {
      utils.employee.profileHub.invalidate({ id: employeeId });
      setShowPhotoModal(false);
      setPhotoPreview(null);
      setPhotoInputUrl("");
    },
  });

  const tabs = useMemo(() => {
    const isAdmin = portal === "admin" && Boolean(data?.access.canManage);
    const all: { id: TabId; label: string; sensitive?: boolean }[] = [
      { id: "overview", label: "About" },
      { id: "job", label: "Job" },
      { id: "attendance", label: "Attendance", sensitive: true },
      {
        id: "location",
        label: "Location",
        sensitive: true,
      },
      { id: "leave", label: "Leave", sensitive: true },
      { id: "documents", label: "Documents", sensitive: true },
      { id: "performance", label: "Performance" },
    ];
    if (!data?.access.canViewSensitive) {
      return all.filter((t) => !t.sensitive);
    }
    return all;
  }, [portal, data?.access.canManage, data?.access.canViewSensitive]);

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
    <div className="w-full max-w-full overflow-hidden bg-[var(--card)] rounded-lg border border-[var(--line)] text-[var(--ink)]">
      {/* Bento Obsidian + Radiant Coral banner */}
      <div className="relative">
        <div
          className="h-32 w-full md:h-44 relative overflow-hidden bg-cover bg-center"
          style={{
            backgroundImage:
              "linear-gradient(135deg, rgba(36, 14, 89, 0.82) 0%, rgba(68, 28, 158, 0.72) 50%, rgba(106, 55, 207, 0.65) 100%), url('/skyscraper-hero.jpg')",
          }}
        >
          {/* Dark mode overlay so banner does not glow */}
          <div className="absolute inset-0 bg-transparent dark:bg-[rgba(11,12,15,0.45)] pointer-events-none" />
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
                  className="gap-1.5 bg-[var(--card)]/90 text-[var(--ink)] border border-[var(--line)] hover:bg-[var(--card)]"
                >
                  <Pencil className="h-3.5 w-3.5 text-[var(--accent)]" />
                  Edit
                </Button>
              </Link>
            )}

            {portal === "admin" && access.canManage && (
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

        <div className="relative px-4 pb-0 pt-0 md:px-6 bg-[var(--card)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
            <div className="-mt-12 sm:-mt-14 relative group shrink-0">
              <div className="flex h-24 w-24 aspect-square shrink-0 items-center justify-center overflow-hidden rounded-full border-[3px] border-[var(--card)] bg-gradient-to-tr from-[#5145CD] to-[#7957FF] font-display text-2xl font-bold text-white shadow-md">
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
              {access.isSelf && (
                <button
                  type="button"
                  onClick={() => setShowPhotoModal(true)}
                  className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--card)] border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--soft)] transition-colors shadow-xs"
                  title="Upload / Change profile photo"
                >
                  <Camera className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="min-w-0 flex-1 pt-3 pb-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-display text-2xl font-black tracking-tight text-[var(--ink)] md:text-3xl">
                  {fullName(emp.firstName, emp.lastName)}
                </h1>
                <StatusBadge status={emp.status} />
                {access.canManage && (
                  <Link
                    href={`/admin-portal/employees/${emp.id}/edit`}
                    className="inline-flex items-center gap-1 rounded-[4px] bg-[var(--field)] hover:bg-[var(--hover)] border border-[var(--line)] px-2 py-0.5 text-[11px] font-semibold text-[var(--ink)] transition-colors"
                    title="Change status or termination date"
                  >
                    <Pencil className="h-3 w-3 text-[var(--muted)]" />
                    <span>Change Status</span>
                  </Link>
                )}
                <span className="inline-flex items-center gap-1.5 rounded-[4px] bg-[var(--active)] border border-[var(--line)] px-2.5 py-0.5 text-xs font-bold text-[var(--accent)] shadow-2xs">
                  <Building className="h-3 w-3 text-[var(--accent)]" />
                  Realty Smartz Pvt Ltd
                </span>
              </div>
              <p className="mt-1 text-sm font-semibold text-[var(--ink)] flex items-center gap-2 flex-wrap">
                <span className="text-[var(--ink)] font-bold">{emp.designation?.title ?? "Designation Pending"}</span>
                {emp.department?.name && (
                  <>
                    <span className="text-[var(--muted)]">•</span>
                    <span className="text-[var(--accent)] font-medium">{emp.department.name} Department</span>
                  </>
                )}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[var(--muted)] font-medium">
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-[var(--muted)]" />
                  <span className="font-semibold text-[var(--ink)]">{emp.email}</span>
                </span>
                {emp.phone && (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-[var(--muted)]" />
                    <span className="text-[var(--ink)]">{emp.phone}</span>
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-[var(--muted)]" />
                  <span className="text-[var(--ink)]">{emp.workLocationName || "Gurugram"}</span>
                </span>
                {emp.dateOfJoining && (
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-[var(--muted)]" />
                    <span className="text-[var(--ink)]">Joined {formatDate(emp.dateOfJoining)}</span>
                  </span>
                )}
                {["RESIGNED", "TERMINATED", "EXIT"].includes(emp.status) && (
                  <span className="inline-flex items-center gap-1.5 font-bold text-[var(--danger)] bg-[var(--soft)] border border-[var(--line)] px-2 py-0.5 rounded-[2px]">
                    <Calendar className="h-3.5 w-3.5 text-[var(--danger)]" />
                    <span>
                      {emp.status === "TERMINATED"
                        ? "Terminated On"
                        : emp.status === "RESIGNED"
                          ? "Resigned On"
                          : "Absconded On"}
                      : {formatDate(emp.statusEffectiveDate)}
                    </span>
                  </span>
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="bg-[var(--soft)] border border-[var(--line)] text-[var(--ink)] rounded-[2px] px-2 py-0.5 text-xs font-semibold">
                  {emp.employeeCode}
                </span>
                <span className="bg-[var(--soft)] border border-[var(--line)] text-[var(--ink)] rounded-[2px] px-2 py-0.5 text-xs font-semibold">
                  {emp.role}
                </span>
                {access.canViewSensitive ? (
                  <div className="flex min-w-[140px] max-w-xs flex-1 items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--line)]">
                      <div
                        className="h-full rounded-full bg-[var(--accent)] transition-all duration-200"
                        style={{ width: `${emp.profileCompletion}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-semibold text-[var(--muted)]">
                      {emp.profileCompletion}% Complete
                    </span>
                  </div>
                ) : (
                  <Badge
                    variant="outline"
                    className="border-[var(--line)] bg-[var(--soft)] text-[11px] font-semibold text-[var(--ink)]"
                  >
                    Colleague Directory
                  </Badge>
                )}

                {/* Photo source indicator & change control for own profile */}
                {access.isSelf && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-[var(--muted)] font-medium">Photo source:</span>
                    <span className="inline-flex items-center rounded-[2px] px-2 py-0.5 text-[10px] font-semibold bg-[var(--soft)] text-[var(--ink)] border border-[var(--line)]">
                      {emp.profilePhotoUrl
                        ? emp.profilePhotoUrl.includes("googleusercontent.com") ||
                          emp.profilePhotoUrl.includes("google")
                          ? "Google Account"
                          : "Custom Upload"
                        : "Initials"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowPhotoModal(true)}
                      className="text-[11px] font-bold text-[var(--accent)] hover:underline"
                    >
                      Change Photo
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Either Limited Colleague Profile View OR Full Tabbed Profile Hub */}
      {!access.canViewSensitive ? (
        <LimitedColleagueProfileView emp={emp} basePath={basePath} />
      ) : (
        <>
          {/* Tabs - Mobile horizontal scrollable */}
          <div className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--card)] overflow-x-auto no-scrollbar scroll-smooth">
            <div className="flex min-w-max gap-0 px-1 md:px-4">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "relative px-4 py-3 text-[14px] font-[600] capitalize transition-colors duration-150 shrink-0 whitespace-nowrap",
                    tab === t.id
                      ? "text-[var(--ink)] font-semibold"
                      : "text-[var(--muted)] hover:text-[var(--ink)]"
                  )}
                >
                  {t.label}
                  {tab === t.id && (
                    <motion.span
                      layoutId="profile-tab"
                      className="absolute inset-x-2 bottom-0 h-[2px] bg-[var(--accent)]"
                    />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[var(--field)] p-4 md:p-6">
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
                {tab === "attendance" && (
                  <AttendanceTab
                    employeeId={emp.id}
                    emp={emp}
                    canManage={portal === "admin" && access.canManage}
                  />
                )}
                {tab === "leave" && (
                  <LeaveTab
                    employeeId={emp.id}
                    canManage={access.canManage}
                    onAdjusted={() => {
                      utils.employee.profileHub.invalidate({ id: emp.id });
                      utils.leave.forEmployee.invalidate({ employeeId: emp.id });
                    }}
                  />
                )}
                {tab === "documents" && (
                  <DocumentsTab
                    employeeId={emp.id}
                    canUpload={access.canEdit}
                  />
                )}
                {tab === "performance" && (
                  <PerformanceTab employeeId={emp.id} />
                )}
                {tab === "location" && (
                  <GpsTrailTab
                    emp={emp}
                    canManage={portal === "admin" && access.canManage}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </>
      )}

      {/* Photo Change Modal for Employee */}
      {showPhotoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto"
          onClick={() => {
            setShowPhotoModal(false);
            setPhotoPreview(null);
            setPhotoInputUrl("");
          }}
        >
          <div
            className="relative w-full max-w-md max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100vh-3.5rem)] my-auto rounded-2xl bg-[var(--card)] p-6 shadow-2xl border border-[var(--line)] overflow-y-auto text-[var(--ink)] animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
              <h3 className="font-display text-base font-bold text-[var(--ink)]">
                Profile Photo Settings
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowPhotoModal(false);
                  setPhotoPreview(null);
                  setPhotoInputUrl("");
                }}
                className="text-[var(--muted)] hover:text-[var(--ink)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* Current Photo Preview & Source */}
              <div className="flex items-center gap-4 p-3 rounded-xl bg-[var(--field)] border border-[var(--line)]">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[var(--line)] bg-[#5D3EBC] text-white font-bold text-lg">
                  {photoPreview || emp.profilePhotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoPreview || emp.profilePhotoUrl || ""}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    initials(emp.firstName, emp.lastName)
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-[var(--muted)] font-medium">Active Photo Source:</p>
                  <p className="text-sm font-bold text-[var(--ink)]">
                    {emp.profilePhotoUrl
                      ? emp.profilePhotoUrl.includes("googleusercontent.com") ||
                        emp.profilePhotoUrl.includes("google")
                        ? "Google Account"
                        : "Custom Upload"
                      : "Default Initials"}
                  </p>
                  <p className="text-[11px] text-[var(--muted)] mt-0.5">
                    Upload a custom photo anytime to customize your profile avatar.
                  </p>
                </div>
              </div>

              {/* Camera / Upload file */}
              <div className="flex gap-2">
                <label className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-[#5D3EBC] px-3 py-2.5 text-xs font-semibold text-white hover:brightness-110">
                  <Camera className="h-4 w-4" />
                  Take Photo
                  <input
                    type="file"
                    accept="image/*"
                    capture="user"
                    className="hidden"
                    onChange={onPhotoFile}
                  />
                </label>
                <label className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--field)] px-3 py-2.5 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--hover)]">
                  <ImageUp className="h-4 w-4" />
                  Upload
                  <input type="file" accept="image/*" className="hidden" onChange={onPhotoFile} />
                </label>
              </div>
              {photoBusy && <p className="text-xs text-[var(--muted)]">Compressing photo…</p>}

              {/* Or Photo URL */}
              <div>
                <Label className="text-xs font-semibold text-[var(--ink)]">Or Image URL</Label>
                <Input
                  type="url"
                  className="mt-1"
                  placeholder="https://..."
                  value={photoInputUrl}
                  onChange={(e) => {
                    setPhotoInputUrl(e.target.value);
                    setPhotoPreview(e.target.value);
                  }}
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--line)]">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowPhotoModal(false);
                    setPhotoPreview(null);
                    setPhotoInputUrl("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="bg-[#5D3EBC] text-white hover:brightness-110"
                  disabled={
                    (!photoPreview && !photoInputUrl) ||
                    updatePhotoMutation.isLoading
                  }
                  onClick={() => {
                    const url = photoPreview || photoInputUrl;
                    if (url) {
                      updatePhotoMutation.mutate({ profilePhotoUrl: url });
                    }
                  }}
                >
                  {updatePhotoMutation.isLoading ? "Saving..." : "Save Photo"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LimitedColleagueProfileView({
  emp,
  basePath,
}: {
  emp: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    workLocationName: string | null;
    designation: { title: string } | null;
    department: { name: string } | null;
    manager: {
      id: string;
      firstName: string;
      lastName: string;
      employeeCode: string;
    } | null;
    dateOfJoining: Date | string | null;
    statusEffectiveDate?: Date | string | null;
    status: string;
    directReports: {
      id: string;
      firstName: string;
      lastName: string;
      employeeCode: string;
      profilePhotoUrl: string | null;
      designation: { title: string } | null;
    }[];
  };
  basePath: string;
}) {
  return (
    <div className="bg-[var(--field)] p-4 md:p-6 space-y-5">
      {/* 3 Bento Cards for Directory Details */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Card 1: Job & Department */}
        <Card className="border-[var(--line)] bg-[var(--card)]">
          <CardHeader className="pb-3 border-b border-[var(--line)]">
            <CardTitle className="text-sm font-bold text-[var(--ink)] flex items-center gap-2">
              <Building className="h-4 w-4 text-primary" />
              Role & Department
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            <InfoRow label="Designation" value={emp.designation?.title ?? "—"} />
            <InfoRow label="Department" value={emp.department?.name ?? "—"} />
            <InfoRow label="Date of Joining" value={formatDate(emp.dateOfJoining)} />
            <InfoRow label="Status" value={emp.status === "EXIT" ? "Absconding" : emp.status.replace("_", " ")} />
            {["RESIGNED", "TERMINATED", "EXIT"].includes(emp.status) && (
              <InfoRow
                label={
                  emp.status === "TERMINATED"
                    ? "Termination Date"
                    : emp.status === "RESIGNED"
                      ? "Resigned On"
                      : "Absconding Date"
                }
                value={formatDate(emp.statusEffectiveDate)}
              />
            )}
          </CardContent>
        </Card>

        {/* Card 2: Work Contact */}
        <Card className="border-[var(--line)] bg-[var(--card)]">
          <CardHeader className="pb-3 border-b border-[var(--line)]">
            <CardTitle className="text-sm font-bold text-[var(--ink)] flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              Work Contact
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            <InfoRow label="Work Email" value={emp.email} />
            <InfoRow label="Work Phone" value={emp.phone || "Company office"} />
            <InfoRow label="Office Location" value={emp.workLocationName || "Gurugram Office"} />
          </CardContent>
        </Card>

        {/* Card 3: Reporting Manager */}
        <Card className="border-[var(--line)] bg-[var(--card)]">
          <CardHeader className="pb-3 border-b border-[var(--line)]">
            <CardTitle className="text-sm font-bold text-[var(--ink)] flex items-center gap-2">
              <Network className="h-4 w-4 text-primary" />
              Reporting Manager
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            <InfoRow
              label="Manager"
              value={
                emp.manager
                  ? fullName(emp.manager.firstName, emp.manager.lastName)
                  : "Leadership Team"
              }
              href={emp.manager ? buildProfileLink(basePath, emp.manager.id) : undefined}
            />
            {emp.manager && (
              <InfoRow label="Manager Code" value={emp.manager.employeeCode} />
            )}
            <InfoRow
              label="Direct Reports"
              value={
                emp.directReports && emp.directReports.length > 0
                  ? `${emp.directReports.length} colleague(s)`
                  : "None"
              }
            />
          </CardContent>
        </Card>
      </div>

      {/* Reporting Hierarchy & Active Direct Reports */}
      {(emp.manager || (emp.directReports && emp.directReports.length > 0)) && (
        <Card className="border-[var(--line)] bg-[var(--card)]">
          <CardHeader className="pb-3 border-b border-[var(--line)]">
            <CardTitle className="text-sm font-bold text-[var(--ink)] flex items-center gap-2">
              <Network className="h-4 w-4 text-primary" />
              Reporting Hierarchy ({emp.directReports?.length ?? 0} Active Team)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {/* Manager -> Current Employee Chain */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {emp.manager && (
                <>
                  <Link
                    href={buildProfileLink(basePath, emp.manager.id)}
                    className="inline-flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--field)] px-3 py-1.5 font-semibold text-[var(--ink)] hover:border-primary/50 transition-colors"
                  >
                    <span className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Manager:</span>
                    <span className="text-primary">{fullName(emp.manager.firstName, emp.manager.lastName)}</span>
                  </Link>
                  <span className="text-[var(--muted)] font-bold">→</span>
                </>
              )}
              <span className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 font-bold text-[var(--ink)]">
                <span>{fullName(emp.firstName, emp.lastName)}</span>
                <span className="text-[10px] font-medium text-[var(--muted)]">
                  ({emp.designation?.title ?? "Employee"})
                </span>
              </span>
            </div>

            {emp.directReports && emp.directReports.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 pt-1">
                {emp.directReports.map((report) => (
                  <Link
                    key={report.id}
                    href={buildProfileLink(basePath, report.id)}
                    className="flex items-center gap-3 rounded-xl border border-[var(--line)] p-3 hover:bg-[var(--hover)] transition-colors"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#5D3EBC] text-xs font-bold text-white">
                      {report.profilePhotoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={report.profilePhotoUrl}
                          alt=""
                          className="h-full w-full rounded-full object-cover"
                        />
                      ) : (
                        initials(report.firstName, report.lastName)
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-xs text-[var(--ink)] truncate">
                        {fullName(report.firstName, report.lastName)}
                      </p>
                      <p className="text-[11px] text-[var(--muted)] truncate">
                        {report.designation?.title ?? "Team Member"} · {report.employeeCode}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
              </div>
            )}
                      )}
        </CardContent>
                </Card>
  )
}

{/* Access Control Notice */ }
<div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-4 text-xs text-[var(--muted)] flex items-start gap-3">
  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--field)] text-[var(--ink)]">
    <ShieldCheck className="h-4 w-4" />
  </div>
  <div>
    <p className="font-semibold text-[var(--ink)]">
      Company Directory · Public Colleague Profile
    </p>
    <p className="mt-0.5 text-[var(--muted)] leading-relaxed">
      Personal records (attendance logs, leave balances, performance reviews, and personal identity documents) are strictly confidential and accessible only to the employee, their direct reporting manager, and HR administrators.
    </p>
  </div>
</div>
            </div >
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
    <div className="flex justify-between gap-4 border-b border-dashed border-[var(--line)] py-2 last:border-0">
      <span className="text-caption text-[var(--muted)]">{label}</span>
      {href && value ? (
        <Link
          href={href}
          className="text-right text-sm font-medium text-teal-600 dark:text-teal-400 transition-colors hover:underline"
        >
          {value}
        </Link>
      ) : (
        <span className="text-right text-sm font-medium text-[var(--ink)]">
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
    statusEffectiveDate: Date | string | null;
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
              href={basePath.startsWith("/admin-portal") && emp.manager ? `${basePath}/${emp.manager.id}` : undefined}
              href={emp.manager ? buildProfileLink(basePath, emp.manager.id) : undefined}
            />
            <InfoRow
              label="Date of joining"
              value={formatDate(emp.dateOfJoining)}
            />
            <InfoRow label="Status" value={emp.status === "EXIT" ? "Absconding" : emp.status.replace("_", " ")} />
            {["RESIGNED", "TERMINATED", "EXIT"].includes(emp.status) && (
              <InfoRow
                label={
                  emp.status === "TERMINATED"
                    ? "Termination Date"
                    : emp.status === "RESIGNED"
                      ? "Resigned On"
                      : "Absconding Date"
                }
                value={formatDate(emp.statusEffectiveDate)}
              />
            )}
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
                      className="flex items-center justify-between rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                    >
                      <span>{formatDate(log.date)}</span>
                      <span className="text-[var(--muted)]">
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
                <p className="text-caption text-[var(--muted)]">No leave requests</p>
              ) : (
                <ul className="space-y-2">
                  {overview.recentLeave.map((req) => (
                    <li
                      key={req.id}
                      className="flex items-center justify-between rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
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
                    className="block rounded-lg border border-[var(--line)] px-3 py-2 text-sm transition-colors duration-150 hover:bg-[var(--hover)]"
                  >
                    <span className="font-medium text-[var(--ink)]">
                      {fullName(r.firstName, r.lastName)}
                    </span>
                    <span className="block text-caption text-[var(--muted)]">
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
    <div className="rounded-[4px] border border-[var(--line)] bg-[var(--card)] p-4 sm:p-5 text-[var(--ink)] shadow-none">
      <p className="text-xs font-semibold text-[var(--muted)]">{label}</p>
      <p className="mt-1 font-display text-[28px] sm:text-[30px] font-bold text-[var(--ink)] leading-tight">
        {value}
      </p>
    </div>
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
    statusEffectiveDate: Date | string | null;
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
                  <CardHeader className="border-b border-[var(--line)] pb-3">
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
                      value={emp.status === "EXIT" ? "Absconding" : emp.status.replace("_", " ")}
                    />
                    {["RESIGNED", "TERMINATED", "EXIT"].includes(emp.status) && (
                      <DetailField
                        label={
                          emp.status === "TERMINATED"
                            ? "Termination Date"
                            : emp.status === "RESIGNED"
                              ? "Resignation Date"
                              : "Absconding Date"
                        }
                        value={formatDate(emp.statusEffectiveDate)}
                      />
                    )}
                    <DetailField label="Business Unit" value="Realty Smartz Private Limited" />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="border-b border-[var(--line)] pb-3">
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
                      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
                        Reporting Manager
                      </p>
                      {emp.manager ? (
                        basePath.startsWith("/admin-portal") ? (
                          <Link
                            href={`${basePath}/${emp.manager.id}`}
                            className="mt-1 inline-flex items-center gap-2 text-sm font-medium text-teal-600 dark:text-teal-400 hover:underline"
                          >
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-50 dark:bg-teal-950/40 text-[10px] font-bold text-teal-800 dark:text-teal-300">
                              {initials(emp.manager.firstName, emp.manager.lastName)}
                            </span>
                            {fullName(emp.manager.firstName, emp.manager.lastName)}
                          </Link>
                        ) : (
                          <div className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-50 dark:bg-teal-950/40 text-[10px] font-bold text-teal-800 dark:text-teal-300">
                              {initials(emp.manager.firstName, emp.manager.lastName)}
                            </span>
                            {fullName(emp.manager.firstName, emp.manager.lastName)}
                          </div>
                        )
                        < Link
                  href={buildProfileLink(basePath, emp.manager.id)}
                      className="mt-1 inline-flex items-center gap-2 text-sm font-medium text-teal-600 dark:text-teal-400 hover:underline"
                >
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-50 dark:bg-teal-950/40 text-[10px] font-bold text-teal-800 dark:text-teal-300">
                        {initials(emp.manager.firstName, emp.manager.lastName)}
                      </span>
                      {fullName(emp.manager.firstName, emp.manager.lastName)}
                    </Link>
                    ) : (
                    <p className="mt-1 text-sm text-[var(--muted)]">—</p>
              )}
                    <Link
                      href={buildProfileLink(basePath, emp.manager.id)}
                      className="mt-1 inline-flex items-center gap-2 text-sm font-medium text-teal-600 dark:text-teal-400 hover:underline"
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-50 dark:bg-teal-950/40 text-[10px] font-bold text-teal-800 dark:text-teal-300">
                        {initials(emp.manager.firstName, emp.manager.lastName)}
                      </span>
                      {fullName(emp.manager.firstName, emp.manager.lastName)}
                    </Link>
                    ) : (
                    <p className="mt-1 text-sm text-[var(--muted)]">—</p>
                    )}
                        <Link
                          href={buildProfileLink(basePath, emp.manager.id)}
                          className="mt-1 inline-flex items-center gap-2 text-sm font-medium text-teal-600 dark:text-teal-400 hover:underline"
                        >
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-50 dark:bg-teal-950/40 text-[10px] font-bold text-teal-800 dark:text-teal-300">
                            {initials(emp.manager.firstName, emp.manager.lastName)}
                          </span>
                          {fullName(emp.manager.firstName, emp.manager.lastName)}
                        </Link>
                      ) : (
                        <p className="mt-1 text-sm text-[var(--muted)]">—</p>
                      )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="border-b border-[var(--line)] pb-3">
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
              <CardHeader className="border-b border-[var(--line)] pb-3">
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
                        className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                      >
                        <p className="font-medium capitalize text-[var(--ink)]">
                          {h.fieldChanged} changed
                        </p>
                        <p className="text-caption text-[var(--muted)]">
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
          </div >
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
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-[var(--ink)]">{value || "—"}</p>
    </div>
  );
}

function AttendanceTab({
  employeeId,
  emp,
  canManage,
}: {
  employeeId: string;
  emp: {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode: string;
    workLocationName: string | null;
    workLocationLat: number | null;
    workLocationLng: number | null;
    designation?: { title: string } | null;
    department?: { name: string } | null;
  };
  canManage: boolean;
}) {
  return (
    <div className="w-full">
      <KekaAttendancePanel
        targetEmployeeId={emp.id}
        employeeName={fullName(emp.firstName, emp.lastName)}
        designation={emp.designation?.title}
        department={emp.department?.name}
        employeeCode={emp.employeeCode}
        workLocationName={emp.workLocationName}
        workLocationLat={emp.workLocationLat}
        workLocationLng={emp.workLocationLng}
        hideHeaderBanner
      />
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
  const { data: allLeaveTypes } = trpc.leave.types.useQuery();
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
    onError: (e) => setError(userFacingErrorMessage(e)),
  });

  const respondMutation = trpc.leave.respond.useMutation({
    onSuccess: () => {
      toast("success", "Leave status updated successfully");
      onAdjusted();
    },
    onError: (e) => setError(userFacingErrorMessage(e)),
  });

  if (isLoading) {
    return <p className="text-caption text-neutral-500">Loading leave…</p>;
  }

  const pendingRequests = (data?.requests ?? []).filter((r) => r.status === "PENDING");
  const availableTypes =
    allLeaveTypes && allLeaveTypes.length > 0
      ? allLeaveTypes
      : (data?.balances.map((b) => b.leaveType) ?? []);

  return (
    <div className="section-gap space-y-4">
      {/* 1. Pending Leave Requests Section (Prominent Highlight) */}
      {pendingRequests.length > 0 && (
        <Card className="border-amber-300 bg-amber-50/40 shadow-xs">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
              <CardTitle className="text-sm font-bold text-amber-900">
                Pending Leave Requests ({pendingRequests.length} Waiting for Review)
              </CardTitle>
            </div>
            <span className="text-[11px] font-semibold text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-200">
              Action Required
            </span>
          </CardHeader>
          <CardContent className="space-y-2.5 pt-0">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-[var(--line)] bg-[var(--card)] shadow-2xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-[var(--ink)]">{req.leaveType.name}</span>
                    <span className="rounded bg-amber-100 dark:bg-amber-950/40 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                      {req.numberOfDays} {req.numberOfDays === 1 ? "day" : "days"} {req.isHalfDay ? `(${req.halfDaySlot})` : ""}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--muted)] font-medium">
                    {formatDate(req.startDate)} → {formatDate(req.endDate)}
                  </div>
                  <div className="text-xs text-[var(--muted)] italic">
                    Reason: &ldquo;{req.reason}&rdquo;
                  </div>
                </div>

                {canManage && (
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold"
                      disabled={respondMutation.isLoading}
                      onClick={() => {
                        const note = window.prompt("Reason for rejection (optional):");
                        respondMutation.mutate({
                          id: req.id,
                          action: "REJECT",
                          approverNote: note || undefined,
                        });
                      }}
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs"
                      disabled={respondMutation.isLoading}
                      onClick={() => {
                        respondMutation.mutate({
                          id: req.id,
                          action: "APPROVE",
                        });
                      }}
                    >
                      Approve (Paid Leave)
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 2. Probation 1-Click Setup Banner */}
      {canManage && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[var(--field)] rounded-xl border border-[var(--line)]">
          <div>
            <span className="text-xs font-bold text-[var(--ink)]">Probation &amp; Quota Policy:</span>
            <span className="text-xs text-[var(--muted)] ml-1.5">
              Probation candidates have 0 leaves allotted. Click below to quickly assign zero leaves.
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={adjust.isLoading}
            className="text-xs border-amber-300 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 font-semibold shadow-2xs"
            onClick={async () => {
              if (!window.confirm("Set probation quota (0 leaves) for all leave types for this candidate?")) return;
              const typesToSet = availableTypes.length > 0 ? availableTypes : (data?.balances.map((b) => b.leaveType) ?? []);
              for (const t of typesToSet) {
                await adjust.mutateAsync({
                  employeeId,
                  leaveTypeId: t.id,
                  allotted: 0,
                  reason: "Probation period - 0 leave quota",
                });
              }
              toast("success", "Probation quota (0 leaves) set successfully!");
            }}
          >
            Set Probation (0 Leaves)
          </Button>
        </div>
      )}

      {/* 3. Leave Balance Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(data?.balances ?? []).map((b) => (
          <Card key={b.id} className="relative overflow-hidden">
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <p className="font-bold text-[var(--ink)] text-sm">{b.leaveType.name}</p>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => {
                      setAdjustTypeId(b.leaveTypeId);
                      setAllotted(String(b.allotted));
                      setReason(`Adjust quota for ${b.leaveType.name}`);
                    }}
                    className="text-[11px] font-semibold text-violet-700 hover:text-violet-800 hover:underline"
                  >
                    Edit Quota
                  </button>
                )}
              </div>
              <p className="mt-2 text-caption text-[var(--muted)]">
                Allotted <span className="font-semibold text-[var(--ink)]">{b.allotted}</span> · Used{" "}
                <span className="font-semibold text-[var(--ink)]">{b.used}</span> · Remaining{" "}
                <span className="font-bold text-teal-600 dark:text-teal-400">{b.remaining}</span>
              </p>
            </CardContent>
          </Card>
        ))}
        {!data?.balances.length && (
          <EmptyState
            title="No leave balances"
            description="No leave balances assigned yet. Use the quota form below to assign leaves or set probation."
            className="sm:col-span-2 lg:col-span-3"
          />
        )}
      </div>

      {/* 4. Adjust Leave Balance Form */}
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold text-[var(--ink)]">Adjust / Assign Leave Quota</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Leave type</Label>
              <Select
                value={adjustTypeId}
                onChange={(e) => setAdjustTypeId(e.target.value)}
              >
                <option value="">Select leave type…</option>
                {availableTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Allotted days (0 for probation)</Label>
              <Input
                type="number"
                min={0}
                value={allotted}
                placeholder="e.g. 0 or 12"
                onChange={(e) => setAllotted(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Reason</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Probation period, Annual quota adjustment"
              />
            </div>
            {error && (
              <p className="text-sm text-maroon-600 sm:col-span-2 lg:col-span-4">
                {error}
              </p>
            )}
            <div className="sm:col-span-2 lg:col-span-4 flex items-center gap-2">
              <Button
                disabled={adjust.isLoading}
                onClick={() => {
                  if (!adjustTypeId || allotted === "" || reason.length < 3) {
                    setError("Select type, allotted days (0 or more), and a reason (3+ chars).");
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
                {adjust.isLoading ? "Saving..." : "Save Quota / Balance"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-xs border-[var(--line)]">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-bold text-[var(--ink)]">Leave History</CardTitle>
            <p className="text-xs text-[var(--muted)] mt-0.5">All submitted leaves, approvals, and reviewer notes</p>
          </div>
          {data?.requests && data.requests.length > 0 && (
            <span className="rounded-full bg-[var(--field)] px-3 py-1 text-xs font-bold text-[var(--ink)] border border-[var(--line)]">
              {data.requests.length} Requests
            </span>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {!data?.requests.length ? (
            <EmptyState
              title="No leave requests submitted"
              description="Leave applications for this employee will show here with full review details."
              className="m-4"
            />
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Leave Type</TableHead>
                      <TableHead>Date Range</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Reviewer / Note</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.requests.map((r) => (
                      <TableRow key={r.id} className="hover:bg-[var(--hover)] transition-colors">
                        <TableCell>
                          <span className="font-semibold text-[var(--ink)] text-xs">
                            {r.leaveType.name}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-[var(--ink)] font-medium">
                          {formatDate(r.startDate)} → {formatDate(r.endDate)}
                        </TableCell>
                        <TableCell className="text-xs font-bold text-[var(--ink)]">
                          {r.isHalfDay
                            ? r.halfDaySlot === "SECOND_HALF"
                              ? HALF_DAY_SLOT_LABELS.SECOND_HALF
                              : HALF_DAY_SLOT_LABELS.FIRST_HALF
                            : `${r.numberOfDays} ${r.numberOfDays === 1 ? "day" : "days"}`}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${r.status === "APPROVED"
                              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                              : r.status === "REJECTED"
                                ? "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                                : r.status === "CANCELLED"
                                  ? "bg-[var(--field)] text-[var(--muted)] border border-[var(--line)]"
                                  : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                              }`}
                          >
                            {r.status === "APPROVED" && <Check className="h-3 w-3" />}
                            {r.status === "REJECTED" && <X className="h-3 w-3" />}
                            {r.status === "PENDING" && <Clock className="h-3 w-3" />}
                            {r.status}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[220px] text-xs text-[var(--muted)] line-clamp-2">
                          {r.reason}
                        </TableCell>
                        <TableCell className="max-w-[200px] text-xs">
                          {r.approvedBy ? (
                            <div>
                              <p className="font-semibold text-[var(--ink)]">
                                {fullName(r.approvedBy.firstName, r.approvedBy.lastName)}
                              </p>
                              {r.approverNote && (
                                <p className="text-[11px] text-[var(--muted)] italic mt-0.5">
                                  {r.approverNote}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-[var(--muted)]">Awaiting review</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards View */}
              <div className="md:hidden divide-y divide-[var(--line)]">
                {data.requests.map((r) => (
                  <div key={r.id} className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-[var(--ink)]">{r.leaveType.name}</span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${r.status === "APPROVED"
                          ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                          : r.status === "REJECTED"
                            ? "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                            : r.status === "CANCELLED"
                              ? "bg-[var(--field)] text-[var(--muted)] border border-[var(--line)]"
                              : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                          }`}
                      >
                        {r.status}
                      </span>
                    </div>

                    <div className="rounded-lg bg-[var(--field)] p-2.5 text-xs space-y-1 border border-[var(--line)]">
                      <div className="flex justify-between">
                        <span className="text-[var(--muted)]">Dates:</span>
                        <span className="font-medium text-[var(--ink)]">
                          {formatDate(r.startDate)} – {formatDate(r.endDate)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--muted)]">Duration:</span>
                        <span className="font-bold text-[#7957FF]">
                          {r.isHalfDay
                            ? r.halfDaySlot === "SECOND_HALF"
                              ? HALF_DAY_SLOT_LABELS.SECOND_HALF
                              : HALF_DAY_SLOT_LABELS.FIRST_HALF
                            : `${r.numberOfDays} ${r.numberOfDays === 1 ? "day" : "days"}`}
                        </span>
                      </div>
                      {r.reason && (
                        <div className="pt-1 border-t border-[var(--line)]">
                          <span className="text-[var(--muted)] text-[11px] block">Reason:</span>
                          <p className="text-[var(--ink)] text-[11px] italic mt-0.5">{r.reason}</p>
                        </div>
                      )}
                      {r.approverNote && (
                        <div className="pt-1 border-t border-[var(--line)]">
                          <span className="text-[var(--muted)] text-[11px] block">Reviewer Note:</span>
                          <p className="text-[var(--ink)] text-[11px] mt-0.5">{r.approverNote}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
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
    onError: (e) => setError(userFacingErrorMessage(e)),
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
              className="cursor-pointer pb-4 hover:bg-[var(--hover)] transition-colors"
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
                  <h3 className="mt-2 text-heading-md font-bold text-[var(--ink)]">
                    {cycle.name}
                  </h3>
                  <p className="mt-1 flex items-center gap-1.5 text-caption text-[var(--muted)]">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>
                      {formatDate(cycle.startDate)} – {formatDate(cycle.endDate)}
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-caption text-[var(--muted)]">Final Rating</p>
                    {item.finalRating != null ? (
                      <div className="flex items-center gap-1 text-base font-bold text-teal-600 dark:text-teal-400">
                        <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
                        <span>{item.finalRating} / 5</span>
                      </div>
                    ) : (
                      <span className="text-caption text-[var(--muted)]">Pending</span>
                    )}
                  </div>

                  <Button variant="ghost" size="icon" className="text-[var(--muted)]">
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
              <CardContent className="border-t border-[var(--line)] pt-6 space-y-6">
                <div>
                  <h4 className="text-sm font-bold text-[var(--ink)] mb-3 flex items-center gap-2">
                    <Target className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                    Cycle Goals ({item.goals.length})
                  </h4>
                  {!item.goals.length ? (
                    <p className="text-caption text-[var(--muted)]">No goals recorded in this cycle.</p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {item.goals.map((g) => (
                        <div
                          key={g.id}
                          className="rounded-xl border border-[var(--line)] bg-[var(--field)] p-3.5 space-y-2"
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
                          <p className="font-semibold text-[var(--ink)] text-sm">
                            {g.title}
                          </p>
                          {g.description && (
                            <p className="text-caption text-[var(--muted)] line-clamp-2">
                              {g.description}
                            </p>
                          )}
                          <div className="space-y-1 pt-1">
                            <div className="flex justify-between text-[11px] text-[var(--muted)]">
                              <span>Progress</span>
                              <span className="font-semibold text-[var(--ink)]">{g.progressPercent}%</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-[var(--line)] overflow-hidden">
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

                <div className="grid gap-4 lg:grid-cols-2 border-t border-[var(--line)] pt-4">
                  <div className="rounded-xl border border-[var(--line)] bg-[var(--field)] p-4 space-y-2">
                    <div className="flex items-center justify-between border-b border-[var(--line)] pb-2">
                      <p className="font-semibold text-[var(--ink)] text-sm">
                        Self-Evaluation
                      </p>
                      {item.selfReview?.rating && (
                        <div className="flex items-center gap-1 text-caption font-bold text-teal-600 dark:text-teal-400">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                          {item.selfReview.rating} / 5
                        </div>
                      )}
                    </div>
                    {item.selfReview ? (
                      <div className="space-y-2 text-caption">
                        <div>
                          <span className="font-semibold text-[var(--ink)]">Strengths: </span>
                          <span className="text-[var(--muted)]">{item.selfReview.strengths || "—"}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-[var(--ink)]">Improvements: </span>
                          <span className="text-[var(--muted)]">{item.selfReview.improvements || "—"}</span>
                        </div>
                        {item.selfReview.comments && (
                          <div>
                            <span className="font-semibold text-[var(--ink)]">Comments: </span>
                            <span className="text-[var(--muted)]">{item.selfReview.comments}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-caption text-[var(--muted)]">No self-evaluation recorded.</p>
                    )}
                  </div>

                  <div className="rounded-xl border border-[var(--line)] bg-[var(--field)] p-4 space-y-2">
                    <div className="flex items-center justify-between border-b border-[var(--line)] pb-2">
                      <p className="font-semibold text-[var(--ink)] text-sm">
                        Manager Evaluation
                      </p>
                      {item.managerReview?.rating && (
                        <div className="flex items-center gap-1 text-caption font-bold text-teal-600 dark:text-teal-400">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                          {item.managerReview.rating} / 5
                        </div>
                      )}
                    </div>
                    {item.managerReview ? (
                      <div className="space-y-2 text-caption">
                        <div>
                          <span className="font-semibold text-[var(--ink)]">Strengths: </span>
                          <span className="text-[var(--muted)]">{item.managerReview.strengths || "—"}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-[var(--ink)]">Areas to Improve: </span>
                          <span className="text-[var(--muted)]">{item.managerReview.improvements || "—"}</span>
                        </div>
                        {item.managerReview.comments && (
                          <div>
                            <span className="font-semibold text-[var(--ink)]">Comments: </span>
                            <span className="text-[var(--muted)]">{item.managerReview.comments}</span>
                          </div>
                        )}
                        <p className="text-[11px] text-[var(--muted)] pt-1">
                          Evaluated by {fullName(item.managerReview.reviewer?.firstName, item.managerReview.reviewer?.lastName)}
                        </p>
                      </div>
                    ) : (
                      <p className="text-caption text-[var(--muted)]">No manager evaluation recorded.</p>
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

function parseAssignedSitesJson(
  raw: unknown
): { name: string; lat: number; lng: number }[] {
  if (!Array.isArray(raw)) return [];
  const out: { name: string; lat: number; lng: number }[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const lat = Number(o.lat);
    const lng = Number(o.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    out.push({ name: String(o.name || "Assigned site"), lat, lng });
    if (out.length >= 3) break;
  }
  return out;
}

function GpsTrailTab({
  emp,
  canManage,
}: {
  emp: {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode: string;
    workLocationName: string | null;
    workLocationLat: number | null;
    workLocationLng: number | null;
    assignedLocations?: unknown;
  };
  canManage: boolean;
}) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedPing, setSelectedPing] = useState<{
    lat: number;
    lng: number;
    label: string;
  } | null>(null);

  const {
    data: pings,
    isLoading,
    refetch,
    isFetching,
  } = trpc.attendance.employeeLocationPings.useQuery({
    employeeId: emp.id,
    date: new Date(date),
    limit: 60,
  });

  const { data: office } = trpc.companySettings.get.useQuery();
  const hasAssignedSite = emp.workLocationLat != null && emp.workLocationLng != null;
  const workplaceName = hasAssignedSite
    ? emp.workLocationName || "Assigned site"
    : `${office?.officeName ?? "Company office"} (default)`;
  const workplaceLat = hasAssignedSite ? emp.workLocationLat : office?.officeLat ?? null;
  const workplaceLng = hasAssignedSite ? emp.workLocationLng : office?.officeLng ?? null;

  const activeLat = selectedPing?.lat ?? pings?.[0]?.lat ?? workplaceLat ?? 0;
  const activeLng = selectedPing?.lng ?? pings?.[0]?.lng ?? workplaceLng ?? 0;
  const activeLabel =
    selectedPing?.label ??
    (pings?.[0]
      ? `Latest Ping: ${new Date(pings[0].capturedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`
      : workplaceName);

  return (
    <div className="space-y-5">
      {/* 1. If HR Admin: Assign Location Card. If Employee: Read-only workplace badge */}
      {canManage ? (
        <AssignLocationCard
          employeeId={emp.id}
          employeeName={fullName(emp.firstName, emp.lastName)}
          currentLocationName={emp.workLocationName}
          currentLat={emp.workLocationLat}
          currentLng={emp.workLocationLng}
          currentSites={parseAssignedSitesJson(emp.assignedLocations)}
          canManage={canManage}
        />
      ) : (
        <div className="rounded-lg border border-[var(--line)] bg-[var(--card)] p-4 flex items-center justify-between gap-3 text-[var(--ink)]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300">
              <Building className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-[var(--ink)]">
                  {workplaceName}
                </h4>
                <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                  Assigned Workplace
                </span>
              </div>
              <p className="text-xs text-[var(--muted)]">
                Official Assigned Workplace (Authorized punch-in location)
              </p>
            </div>
          </div>
          <a
            href={`https://www.google.com/maps?q=${workplaceLat},${workplaceLng}&z=17`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#7957FF] hover:underline"
          >
            <span>View Map</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}

      {/* 2. Interactive Map & Date Selector */}
      <div className="rounded-lg border border-[var(--line)] bg-[var(--card)] p-4 md:p-5 space-y-4 text-[var(--ink)]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-[var(--ink)] flex items-center gap-2">
              <MapPin className="h-4 w-4 text-[#7957FF]" />
              <span>GPS Breadcrumbs Trail</span>
            </h3>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              Automated location captures recorded while on duty.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--field)] px-2.5 py-1.5 text-xs text-[var(--ink)]">
              <Calendar className="h-3.5 w-3.5 text-[var(--muted)]" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-transparent font-medium focus:outline-none"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-8 text-xs gap-1.5 rounded-xl"
            >
              <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </Button>
          </div>
        </div>

        {/* Embedded Map */}
        <div className="rounded-xl overflow-hidden border border-[var(--line)]">
          <LocationMap
            lat={activeLat}
            lng={activeLng}
            label={activeLabel}
            height={280}
          />
        </div>
      </div>

      {/* 3. Timestamps & Coordinates List */}
      <div className="rounded-lg border border-[var(--line)] bg-[var(--card)] overflow-hidden text-[var(--ink)]">
        <div className="p-4 border-b border-[var(--line)] flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
            Recorded GPS Timestamps ({pings?.length ?? 0})
          </h4>
          <span className="text-[11px] text-[var(--muted)] font-medium">
            Background GPS Tracking
          </span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-xs text-[var(--muted)]">
            <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-[var(--muted)]" />
            Loading GPS traces...
          </div>
        ) : !pings || pings.length === 0 ? (
          <div className="p-8 text-center text-xs text-[var(--muted)]">
            <MapPin className="h-8 w-8 text-[var(--muted)] mx-auto mb-2" />
            <p className="font-semibold text-[var(--ink)]">No GPS logs for this date</p>
            <p className="mt-1">
              Staff location is automatically recorded while on duty.
            </p>
          </div>
        ) : (
          <div>
            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <Table>
                <TableHeader className="bg-[var(--soft)]/50">
                  <TableRow>
                    <TableHead className="text-xs font-bold text-[var(--ink)]">Timestamp</TableHead>
                    <TableHead className="text-xs font-bold text-[var(--ink)]">Location Address</TableHead>
                    <TableHead className="text-xs font-bold text-[var(--ink)]">Coordinates</TableHead>
                    <TableHead className="text-xs font-bold text-[var(--ink)]">Location Status</TableHead>
                    <TableHead className="text-right text-xs font-bold text-[var(--ink)]">Google Maps</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pings.map((p) => {
                    const timeStr = new Date(p.capturedAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    });
                    return (
                      <TableRow key={p.id} className="hover:bg-[var(--hover)] transition-colors">
                        <TableCell>
                          <div className="flex items-center gap-1.5 font-semibold text-xs text-[var(--ink)]">
                            <Clock className="h-3.5 w-3.5 text-[var(--muted)]" />
                            <span>{timeStr}</span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <p
                            className="text-xs text-[var(--ink)] font-medium truncate"
                            title={p.address || ""}
                          >
                            {p.address || "Location coordinate recorded"}
                          </p>
                        </TableCell>
                        <TableCell>
                          <span className="tabular-nums text-[11px] text-[var(--ink)] bg-[var(--field)] px-2 py-0.5 rounded border border-[var(--line)]">
                            {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border",
                              p.withinGeofence
                                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                                : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                            )}
                          >
                            <ShieldCheck className="h-3 w-3" />
                            {p.withinGeofence ? "Workplace Location" : "Outside Workplace"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setSelectedPing({
                                  lat: p.lat,
                                  lng: p.lng,
                                  label: `${emp.firstName} at ${timeStr}`,
                                })
                              }
                              className="h-7 text-xs text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/40"
                            >
                              Pin Map
                            </Button>
                            <a
                              href={`https://www.google.com/maps?q=${p.lat},${p.lng}&z=17`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] px-2.5 py-1 text-xs font-semibold text-[#7957FF] hover:bg-[#7957FF]/10 transition-colors"
                            >
                              <span>Google Maps</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards View */}
            <div className="sm:hidden divide-y divide-[var(--line)] p-2 space-y-2">
              {pings.map((p) => {
                const timeStr = new Date(p.capturedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                return (
                  <div key={p.id} className="p-3 bg-[var(--field)] rounded-xl space-y-2 text-[var(--ink)]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-[var(--ink)]">
                        <Clock className="h-3.5 w-3.5 text-[var(--muted)]" />
                        <span>{timeStr}</span>
                      </div>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border",
                          p.withinGeofence
                            ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                            : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                        )}
                      >
                        {p.withinGeofence ? "Workplace" : "Outside"}
                      </span>
                    </div>

                    <p className="text-xs text-[var(--ink)] line-clamp-2">
                      {p.address || "Location coordinate recorded"}
                    </p>

                    <div className="flex items-center justify-between pt-1 text-[11px]">
                      <span className="tabular-nums text-[var(--muted)]">
                        {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
                      </span>
                      <a
                        href={`https://www.google.com/maps?q=${p.lat},${p.lng}&z=17`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-bold text-[#7957FF]"
                      >
                        Open Maps <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
