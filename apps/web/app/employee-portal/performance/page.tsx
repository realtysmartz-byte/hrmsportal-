"use client";

import { useState, useEffect, FormEvent } from "react";
import { useSession } from "next-auth/react";
import { canAccessAdminPortal } from "@realty-smartz/shared";
import type { Role } from "@realty-smartz/shared";
import { trpc } from "@/lib/trpc";
import { userFacingErrorMessage } from "@/lib/user-facing-error";
import {
  Target,
  Plus,
  TrendingUp,
  Award,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Banknote,
  Sparkles,
  X,
  Check,
  ChevronRight,
  Phone,
  PhoneCall,
  FileText,
  ShieldCheck,
  ShieldAlert,
  Percent,
  Briefcase,
  Code2,
  AlertCircle,
  FileCheck2,
  ExternalLink,
  Loader2,
  Users,
  Compass,
  ArrowUpRight,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function EmployeeTargetsPage() {
  const { data: session, status } = useSession();
  const role = (session?.user?.role || "EMPLOYEE") as Role;

  const utils = trpc.useUtils();
  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedTargetId, setSelectedTargetId] = useState<string>("");
  const [selectedItemId, setSelectedItemId] = useState<string>("");

  // Activity Submission Form State
  const [activityType, setActivityType] = useState<
    "SITE_VISIT" | "BOOKING" | "CALL_LEAD" | "QUALIFIED_LEAD" | "TASK_COMPLETION" | "OTHER"
  >("SITE_VISIT");
  const [deliverableTitle, setDeliverableTitle] = useState("");
  const [projectName, setProjectName] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [unitNumber, setUnitNumber] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [revenueAmount, setRevenueAmount] = useState("");
  const [activityDate, setActivityDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Lock background screen scroll when modal is open
  useEffect(() => {
    if (!showLogModal) return;

    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, [showLogModal]);

  const { data: myTargets, isLoading } = trpc.target.myTargets.useQuery();
  const { data: teamData } = trpc.target.myTeamPerformance.useQuery();

  const activeTarget = myTargets?.[0] || null;

  // Set default selected target and target item when modal opens
  useEffect(() => {
    if (myTargets && myTargets.length > 0 && !selectedTargetId) {
      setSelectedTargetId(myTargets[0].id);
      if (myTargets[0].items && myTargets[0].items.length > 0) {
        setSelectedItemId(myTargets[0].items[0].id);
      }
    }
  }, [myTargets, selectedTargetId]);

  const logActivityMutation = trpc.target.logActivity.useMutation({
    onSuccess: () => {
      setSuccessMessage("Deliverable submitted successfully! Sent to manager verification queue.");
      utils.target.myTargets.invalidate();
      setTimeout(() => {
        setShowLogModal(false);
        setSuccessMessage("");
        setDeliverableTitle("");
        setProjectName("");
        setClientName("");
        setClientPhone("");
        setUnitNumber("");
        setQuantity("1");
        setRevenueAmount("");
        setNotes("");
        setProofUrl("");
        setFormError("");
      }, 1500);
    },
    onError: (err) => {
      setFormError(userFacingErrorMessage(err));
    },
  });

  const deleteActivityMutation = trpc.target.deleteActivity.useMutation({
    onSuccess: () => {
      utils.target.myTargets.invalidate();
    },
  });

  function handleSubmitActivity(e: FormEvent) {
    e.preventDefault();
    setFormError("");

    const targetToUse = selectedTargetId || activeTarget?.id;
    if (!targetToUse) {
      setFormError("No active target sheet selected.");
      return;
    }

    logActivityMutation.mutate({
      targetId: targetToUse,
      targetItemId: selectedItemId || null,
      activityType,
      title: deliverableTitle.trim() || undefined,
      projectName: projectName.trim() || undefined,
      clientName: clientName.trim() || undefined,
      clientPhone: clientPhone.trim() || undefined,
      unitNumber: unitNumber.trim() || undefined,
      quantity: parseFloat(quantity) || 1,
      revenueAmount: parseFloat(revenueAmount) || 0,
      activityDate: new Date(activityDate),
      notes: notes.trim() || undefined,
      proofUrl: proofUrl.trim() || undefined,
    });
  }

  function openLogModalForItem(item?: any) {
    if (item) {
      setSelectedItemId(item.id);
      const cat = (item.category || "").toUpperCase();
      const titleLower = (item.title || "").toLowerCase();
      if (cat === "PRESALES" || titleLower.includes("call")) {
        setActivityType("CALL_LEAD");
      } else if (titleLower.includes("lead")) {
        setActivityType("QUALIFIED_LEAD");
      } else if (titleLower.includes("booking") || titleLower.includes("revenue")) {
        setActivityType("BOOKING");
      } else if (titleLower.includes("visit")) {
        setActivityType("SITE_VISIT");
      } else {
        setActivityType("TASK_COMPLETION");
      }
      setDeliverableTitle(item.title);
    }
    setShowLogModal(true);
  }

  if (status !== "loading" && !isLoading && (!myTargets || myTargets.length === 0)) {
    return (
      <div className="mx-auto max-w-xl py-16 px-4 text-center space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-50 text-[#0284C7] border border-sky-200 shadow-xs">
          <Target className="h-8 w-8" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl font-bold text-neutral-900 tracking-tight">
            No Active Targets Assigned Yet
          </h2>
          <p className="text-xs text-neutral-500 max-w-md mx-auto leading-relaxed">
            Your performance scorecard and milestone targets will appear here once assigned by management. You will receive an instant notification when your targets are configured.
          </p>
        </div>
      </div>
    );
  }

  const assignedCompany = activeTarget?.companyName || "Realty Smartz";

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      {/* Sleek Executive Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200/80 pb-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight">
              My Performance Scorecard
            </h1>
            <span className="rounded-full bg-sky-50 text-[#0284C7] border border-sky-300 px-3 py-0.5 text-xs font-bold flex items-center gap-1.5">
              <Compass className="h-3 w-3" />
              {assignedCompany}
            </span>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            Real-time tracking for Attendance Discipline (10%) and Role Deliverables (90%).
          </p>
        </div>

        <Button
          onClick={() => openLogModalForItem()}
          className="bg-[#0284C7] hover:bg-[#0369A1] text-white font-bold text-xs rounded-xl gap-2 shadow-xs shrink-0 h-9 px-4"
        >
          <Plus className="h-4 w-4" />
          Log Work Deliverable
        </Button>
      </div>

      {/* Target Sheet Switcher (if multiple exist) */}
      {myTargets && myTargets.length > 1 && (
          <Card className="p-3.5 rounded-[4px] bg-[var(--card)] border border-[var(--line)] shadow-none flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[var(--accent)]" />
                <span className="text-xs font-bold text-[var(--ink)]">
                  Select Scorecard Period:
                </span>
            </div>
            <select
              value={selectedTargetId || activeTarget?.id}
              onChange={(e) => setSelectedTargetId(e.target.value)}
              className="rounded-[4px] border border-[var(--line)] bg-[var(--field)] px-3 py-1.5 text-xs font-bold text-[var(--ink)] outline-none focus:border-[var(--accent)] shadow-xs"
            >
              {myTargets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} ({t.companyName || "Realty Smartz"}) • Score: {t.totalScore}%
                </option>
              ))}
            </select>
          </Card>
      )}

          {isLoading ? (
              <Card className="p-16 text-center rounded-[4px] bg-[var(--card)] border border-[var(--line)] shadow-none space-y-4">
                <Loader2 className="h-10 w-10 text-[var(--accent)] animate-spin mx-auto" />
                <h3 className="font-bold text-[var(--ink)] text-sm">Loading Scorecard...</h3>
              </Card>
              ) : !activeTarget ? null : (
              <div className="space-y-6">
                {/* Executive Performance Hero Card */}
                  <Card className="rounded-[4px] border border-[var(--line)] bg-[var(--card)] p-6 shadow-none space-y-5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="rounded-[2px] bg-[var(--soft)] border border-[var(--line)] px-2.5 py-0.5 text-xs font-semibold text-[var(--ink)]">
                              {activeTarget.title}
                            </span>
                            <span className="text-xs text-neutral-400">
                              ({formatDate(activeTarget.startDate)} – {formatDate(activeTarget.endDate)})
                            </span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <h2 className="text-3xl font-black text-neutral-900 tracking-tight">
                            {activeTarget.totalScore}%
                          </h2>
                          <span className="text-xs font-semibold text-neutral-400">Total Completion Index</span>
                        </div>
                        <p className="text-xs text-neutral-500 max-w-md">
                          Calculated live: verified activities earn exact pro-rata score towards your 100% total.
                        </p>
                      </div>

                      {/* Status and Incentive Box */}
                      <div className="flex items-center gap-4 border-t md:border-t-0 pt-4 md:pt-0 border-neutral-100 justify-between md:justify-end">
                        <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200/80 text-right min-w-[140px]">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
                            Achievement Status
                          </span>
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase mt-1 ${activeTarget.totalScore >= 80
                                ? "bg-emerald-100 text-emerald-800"
                                : activeTarget.totalScore >= 50
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                          >
                            {activeTarget.totalScore >= 80
                              ? "Exceeding Target"
                              : activeTarget.totalScore >= 50
                                ? "On Track"
                                : "In Progress"}
                          </span>
                        </div>

                        {activeTarget.incentiveAmount > 0 && (
                          <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/70 text-right min-w-[140px]">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                              Target Bonus
                            </span>
                            <strong className="text-base font-black text-emerald-800 block mt-0.5">
                              {formatCurrency(activeTarget.incentiveAmount)}
                            </strong>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Split Progress Bar */}
                    <div className="pt-4 border-t border-neutral-100 space-y-2">
                      <div className="flex justify-between text-xs font-bold text-neutral-600">
                        <span className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-[#38BDF8] inline-block" />
                          Attendance Discipline:{" "}
                          <strong className="text-sky-800">{activeTarget.discipline.score}% / 10%</strong>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-[#0284C7] inline-block" />
                          Role Deliverables:{" "}
                          <strong className="text-[#0284C7]">
                            {Math.max(0, Math.round((activeTarget.totalScore - activeTarget.discipline.score) * 10) / 10)}% / 90%
                          </strong>
                        </span>
                      </div>

                      <div className="h-2.5 w-full rounded-full bg-neutral-100 flex overflow-hidden p-0.5">
                        <div
                          className="h-full rounded-l-full bg-[#38BDF8] transition-all duration-300"
                          style={{ width: `${activeTarget.discipline.score}%` }}
                        />
                        <div
                          className="h-full rounded-r-full bg-[#0284C7] transition-all duration-300"
                          style={{
                            width: `${Math.min(90, activeTarget.totalScore - activeTarget.discipline.score)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </Card>

                  {/* TEAM LEADER SECTION (IF USER IS A TEAM LEADER) */}
                  {teamData && teamData.isTeamLeader && (
                    <Card className="rounded-2xl border border-sky-200 bg-sky-50/30 p-5 shadow-xs space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-sky-100 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-xl bg-sky-100 text-[#0284C7]">
                            <Users className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="font-bold text-neutral-900 text-sm">
                              My Team's Live Performance
                            </h3>
                            <p className="text-xs text-neutral-500">
                              Overview of reporting members under your supervision ({teamData.memberCount} members).
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="text-[10px] text-neutral-400 font-bold uppercase block">Team Revenue</span>
                            <strong className="text-emerald-700 text-sm font-black">
                              {formatCurrency(teamData.summary.teamAchievedRevenue)} / {formatCurrency(teamData.summary.teamTargetRevenue)}
                            </strong>
                          </div>
                        </div>
                      </div>

                      {/* Reporting Members Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {teamData.directReports.map((member: any) => {
                          const mTarget = teamData.teamTargets.find((t: any) => t.employeeId === member.id);
                          return (
                            <div
                              key={member.id}
                              className="p-3 rounded-[4px] border border-[var(--line)] bg-[var(--card)] space-y-1.5 text-xs shadow-none"
                            >
                              <div className="flex justify-between items-center">
                                  <strong className="font-bold text-[var(--ink)] truncate">
                                    {member.firstName} {member.lastName}
                                  </strong>
                                    <span className="font-mono text-[10px] text-[var(--muted)]">
                                      {member.employeeCode || "RS"}
                                    </span>
                                  </div>
                                    <span className="text-[11px] text-[var(--muted)] block truncate">
                                      {member.designation?.title || "Staff"}
                                    </span>
                                    {mTarget ? (
                                      <div className="pt-1 space-y-1">
                                        <div className="flex justify-between text-[11px]">
                                            <span className="text-[var(--muted)]">Achieved:</span>
                                            <strong className="text-[var(--ok)]">
                                              {formatCurrency(mTarget.currentRevenue || 0)}
                                            </strong>
                                        </div>
                                        <div className="flex justify-between text-[11px]">
                                            <span className="text-[var(--muted)]">Visits:</span>
                                            <span className="font-semibold text-[var(--ink)]">
                                              {mTarget.currentVisits || 0} / {mTarget.targetVisits || 0}
                                            </span>
                                        </div>
                                      </div>
                                    ) : (
                                        <span className="text-[10px] text-[var(--muted)] italic block pt-1">
                                          No active target sheet
                                        </span>
                      )}
                                      </div>
                                    );
                })}
                                  </div>
                                </Card>
          )}

                                {/* DELIVERABLES & GOALS GRID */}
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="font-bold text-[var(--ink)] text-sm">
                                          Active Deliverable Milestones
                                        </h3>
                                          <p className="text-xs text-[var(--muted)]">
                                            Click "+ Log" on any milestone to submit your work directly.
                                          </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                                      {/* Attendance Discipline Card */}
                                        <Card className="rounded-[4px] border border-[var(--line)] bg-[var(--card)] p-4 shadow-none flex flex-col justify-between space-y-3">
                                          <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                              <div className="flex items-center gap-2">
                                                  <div className="p-1.5 rounded-[4px] bg-[var(--active)] text-[var(--accent)]">
                                                    <Clock className="h-4 w-4" />
                                                  </div>
                                                  <div>
                                                    <h4 className="font-bold text-[var(--ink)] text-xs">Attendance Discipline</h4>
                                                    <span className="text-[10px] text-[var(--muted)]">10% Fixed Score</span>
                                                  </div>
                                                </div>
                                                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-extrabold text-[#0284C7]">
                                                  {activeTarget.discipline.score}% / 10%
                                                </span>
                                              </div>

                                              <div className="space-y-1">
                                                <div className="flex justify-between text-xs">
                                                  <span className="text-neutral-500">Working Days Credit:</span>
                                                  <strong className="text-neutral-800">
                                                    {activeTarget.discipline.earnedCredits} / {activeTarget.discipline.expectedWorkingDays} Days
                                                  </strong>
                                                </div>
                                                <div className="h-2 w-full rounded-full bg-neutral-100 overflow-hidden">
                                                  <div
                                                    className="h-full rounded-full bg-[#38BDF8]"
                                                    style={{ width: `${Math.min(100, (activeTarget.discipline.score / 10) * 100)}%` }}
                                                  />
                                                </div>
                                              </div>

                                              <div className="text-[10px] text-neutral-400 flex items-center gap-2 pt-1 border-t border-neutral-100">
                                                <span>{activeTarget.discipline.onTimeDays} on-time</span>
                                                {activeTarget.discipline.lateDays > 0 && <span>• {activeTarget.discipline.lateDays} late</span>}
                                                {activeTarget.discipline.halfDays > 0 && <span>• {activeTarget.discipline.halfDays} half-day</span>}
                                              </div>
                                            </div>
                                        </Card>

                                        {/* Role Items Cards */}
                                        {(activeTarget.items || []).map((item: any) => {
                                          const completion = Math.min(100, item.completionRate || 0);
                                          return (
                                            <Card
                                              key={item.id}
                                              className="rounded-[4px] border border-[var(--line)] bg-[var(--card)] p-4 shadow-none flex flex-col justify-between space-y-3 hover:border-[var(--accent)] transition-colors"
                                            >
                                              <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                  <div className="flex items-center gap-2 min-w-0">
                                                      <div className="p-1.5 rounded-[4px] bg-[var(--active)] text-[var(--accent)] shrink-0">
                                                        <Target className="h-4 w-4" />
                                                      </div>
                                                        <h4 className="font-bold text-[var(--ink)] text-xs truncate" title={item.title}>
                                                          {item.title}
                                                        </h4>
                                                    </div>
                                                      <span className="rounded-[2px] bg-[var(--soft)] border border-[var(--line)] px-2 py-0.5 text-[10px] font-bold text-[var(--ink)] shrink-0">
                                                        {item.weightPercent}% Wt
                                                      </span>
                                                  </div>

                                                  <div className="space-y-1">
                                                    <div className="flex justify-between text-xs">
                                                        <span className="text-[var(--muted)]">Progress:</span>
                                                        <strong className="text-[var(--ink)]">
                                                          {item.unit === "INR" ? formatCurrency(item.achievedValue) : `${item.achievedValue} ${item.unit}`} / {item.unit === "INR" ? formatCurrency(item.targetValue) : `${item.targetValue} ${item.unit}`}
                                                        </strong>
                                                    </div>
                                                      <div className="h-2 w-full rounded-full bg-[var(--line)] overflow-hidden">
                                                        <div
                                                          className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
                                                          style={{ width: `${completion}%` }}
                                                        />
                                                      </div>
                                                    </div>

                                                      <div className="flex justify-between items-center text-[11px] pt-1 border-t border-[var(--line)]">
                                                        <span className="text-[var(--muted)]">Score Earned:</span>
                                                        <strong className="text-[var(--accent)] font-bold">{item.earnedScore}%</strong>
                                                      </div>
                                                    </div>

                                                    <Button
                                                      size="sm"
                                                      onClick={() => openLogModalForItem(item)}
                                                      className="w-full bg-[var(--active)] hover:bg-[var(--soft)] text-[var(--accent)] border border-[var(--line)] font-bold text-xs rounded-[4px] h-8 gap-1.5"
                                                    >
                                                      <Plus className="h-3.5 w-3.5" />
                                                      + Log {item.unit}
                                                    </Button>
                                                  </Card>
                                                  );
              })}
                                                </div>
                                              </div>

                                              {/* SUBMISSION HISTORY TABLE */}
                                                  <Card className="rounded-[4px] border border-[var(--line)] bg-[var(--card)] p-5 shadow-none space-y-3">
                                                    <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
                                                      <div className="flex items-center gap-2">
                                                          <FileCheck2 className="h-4 w-4 text-[var(--accent)]" />
                                                          <h3 className="font-bold text-[var(--ink)] text-sm">
                                                            Recent Work Submissions & Approvals
                                                          </h3>
                                                      </div>
                                                      <span className="text-xs text-neutral-400">
                                                        {activeTarget.activities?.length || 0} Submissions
                                                      </span>
                                                    </div>

                                                    {(!activeTarget.activities || activeTarget.activities.length === 0) ? (
                                                      <div className="p-8 text-center text-xs text-neutral-400 bg-neutral-50 rounded-xl">
                                                        No submissions logged yet. Click "Log Work Deliverable" above to submit completed visits, calls, or deals.
                                                      </div>
                                                    ) : (
                                                      <div className="divide-y divide-neutral-100">
                                                        {activeTarget.activities.map((act: any) => (
                                                          <div
                                                            key={act.id}
                                                            className="py-3 flex items-start justify-between gap-3 text-xs"
                                                          >
                                                            <div className="space-y-0.5 min-w-0">
                                                              <div className="flex items-center gap-2 flex-wrap">
                                                                <span
                                                                  className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold ${act.status === "APPROVED"
                                                                      ? "bg-emerald-100 text-emerald-800"
                                                                      : act.status === "PENDING"
                                                                        ? "bg-amber-100 text-amber-800"
                                                                        : "bg-rose-100 text-rose-800"
                                                                    }`}
                                                                >
                                                                  {act.status === "PENDING" ? "Awaiting Review" : act.status}
                                                                </span>
                                                                <span className="font-bold text-neutral-900">
                                                                  {act.title || act.projectName || act.activityType}
                                                                </span>
                                                                {act.quantity > 1 && (
                                                                  <span className="text-neutral-500 font-medium">({act.quantity} units)</span>
                                                                )}
                                                              </div>

                                                              <div className="text-[11px] text-neutral-500 flex items-center gap-3">
                                                                <span>Date: {formatDate(act.activityDate)}</span>
                                                                {act.clientName && <span>Client: {act.clientName}</span>}
                                                                {act.revenueAmount > 0 && (
                                                                  <strong className="text-emerald-700">
                                                                    {formatCurrency(act.revenueAmount)}
                                                                  </strong>
                                                                )}
                                                              </div>

                                                              {act.rejectionReason && (
                                                                <p className="text-[11px] text-rose-600 font-semibold">
                                                                  Reason: {act.rejectionReason}
                                                                </p>
                                                              )}
                                                            </div>

                                                            {act.status === "PENDING" && (
                                                              <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => {
                                                                  if (confirm("Cancel this pending submission?")) {
                                                                    deleteActivityMutation.mutate({ id: act.id });
                                                                  }
                                                                }}
                                                                className="text-neutral-400 hover:text-rose-600 h-7 px-2"
                                                                title="Cancel submission"
                                                              >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                              </Button>
                                                            )}
                                                          </div>
                                                        ))}
                                                      </div>
                                                    )}
                                                  </Card>
                                                </div>
      )}

                                                {/* SUBMIT DELIVERABLE MODAL */}
                                                {showLogModal && (
                                                  <div
                                                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6 backdrop-blur-xs"
                                                    onClick={() => setShowLogModal(false)}
                                                  >
                                                    <div
                                                      className="relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-[4px] bg-[var(--card)] text-[var(--ink)] border border-[var(--line)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                                                      onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <div className="shrink-0 flex items-center justify-between border-b border-[var(--line)] p-4 sm:p-5 bg-[var(--card)]">
                                                          <div className="flex items-center gap-2">
                                                              <Sparkles className="h-5 w-5 text-[var(--accent)]" />
                                                              <h3 className="font-bold text-[var(--ink)] text-base">
                                                                Submit Deliverable for Verification
                                                              </h3>
                                                          </div>
                                                          <button
                                                            onClick={() => setShowLogModal(false)}
                                                            className="text-[var(--muted)] hover:text-[var(--ink)] rounded-[4px] p-1"
                                                          >
                                                            <X className="h-5 w-5" />
                                                          </button>
                                                        </div>

                                                        {successMessage ? (
                                                          <div className="p-6 space-y-4">
                                                              <div className="p-4 rounded-[4px] chip-ok text-xs font-semibold flex items-center gap-2">
                                                                <Check className="h-5 w-5 text-[var(--ok)] shrink-0" />
                                                                <span>{successMessage}</span>
                                                              </div>
                                                            </div>
                                                            ) : (
                                                            <form onSubmit={handleSubmitActivity} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                                                              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                                                                {formError && (
                                                                    <div className="p-3 rounded-[4px] chip-danger text-xs font-semibold">
                                                                      {formError}
                                                                    </div>
                  )}

                                                                    {/* Linked Item Selection */}
                                                                    {activeTarget && activeTarget.items && activeTarget.items.length > 0 && (
                                                                      <div className="space-y-1.5">
                                                                          <Label className="text-xs font-semibold text-[var(--muted)]">
                                                                            Linked Milestone Target *
                                                                          </Label>
                                                                          <select
                                                                            value={selectedItemId}
                                                                            onChange={(e) => setSelectedItemId(e.target.value)}
                                                                            required
                                                                            className="w-full rounded-[4px] border border-[var(--line)] bg-[var(--field)] px-3 py-2 text-xs font-semibold text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                                                                          >
                                                                            {activeTarget.items.map((it: any) => (
                                                                              <option key={it.id} value={it.id}>
                                                                                {it.title} ({it.unit} • {it.weightPercent}% weight)
                                                                              </option>
                                                                            ))}
                                                                          </select>
                                                                      </div>
                                                                    )}

                                                                    {/* Deliverable Type */}
                                                                    <div className="space-y-1.5">
                                                                      <Label className="text-xs font-semibold text-[var(--muted)]">Deliverable Type *</Label>
                                                                      <div className="grid grid-cols-3 gap-2">
                                                                        <button
                                                                          type="button"
                                                                          onClick={() => setActivityType("SITE_VISIT")}
                                                                                  ? "bg-[var(--accent)] text-[var(--accent-ink)] border-[var(--accent)] shadow-xs"
                                                                                  : "bg-[var(--field)] text-[var(--muted)] border-[var(--line)] hover:bg-[var(--soft)] hover:text-[var(--ink)]"
                                                                              }`}
                      >
                        Site Visit
                      </button>
                      <button
                        type="button"
                        onClick={() => setActivityType("BOOKING")}
                        className = {`py-2 rounded-[4px] text-xs font-bold transition-all border ${activityType === "BOOKING"
                                                                                ? "bg-[var(--ok)] text-white border-[var(--ok)] shadow-xs"
                                                                                : "bg-[var(--field)] text-[var(--muted)] border-[var(--line)] hover:bg-[var(--soft)] hover:text-[var(--ink)]"
                                                                            }`}
                                                                        >
                                                                          Deal / Booking
                                                                        </button>
                                                                        <button
                                                                          type="button"
                                                                          onClick={() => setActivityType("CALL_LEAD")}
                                                                                  ? "bg-[var(--accent)] text-[var(--accent-ink)] border-[var(--accent)] shadow-xs"
                                                                                  : "bg-[var(--field)] text-[var(--muted)] border-[var(--line)] hover:bg-[var(--soft)] hover:text-[var(--ink)]"
                                                                              }`}
                      >
                        Client Call
                      </button>
                    </div>
                  </div>

                  {/* Deliverable Title */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-neutral-700">
                      Deliverable Description *
                    </Label>
                    <Input
                      placeholder="e.g. Prestige Park Grove Walkthrough, 40 Outbound Calls"
                      value={deliverableTitle}
                      onChange={(e) => setDeliverableTitle(e.target.value)}
                      required
                      className="rounded-xl border-neutral-200 text-xs"
                    />
                  </div>

                  {/* Quantity & Date */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-neutral-700">Units Completed *</Label>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        required
                        className="rounded-xl border-neutral-200 text-xs font-bold"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-neutral-700">Completion Date *</Label>
                      <Input
                        type="date"
                        value={activityDate}
                        onChange={(e) => setActivityDate(e.target.value)}
                        required
                        className="rounded-xl border-neutral-200 text-xs"
                      />
                    </div>
                  </div>

                  {/* Client Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-neutral-700">Client / Contact Name</Label>
                      <Input
                        placeholder="e.g. Ramesh Sharma"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        className="rounded-xl border-neutral-200 text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-neutral-700">Client Phone</Label>
                      <Input
                        placeholder="e.g. +91 98765 43210"
                        value={clientPhone}
                        onChange={(e) => setClientPhone(e.target.value)}
                        className="rounded-xl border-neutral-200 text-xs"
                      />
                    </div>
                  </div>

                  {/* Deal Booking Specifics */}
                  {activityType === "BOOKING" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200/70">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-neutral-700">Unit / Flat No.</Label>
                        <Input
                          placeholder="e.g. Tower B - 1402"
                          value={unitNumber}
                          onChange={(e) => setUnitNumber(e.target.value)}
                          className="rounded-[4px] border-[var(--line)] text-xs bg-[var(--field)] text-[var(--ink)]"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-[var(--muted)]">Deal Revenue (₹ INR) *</Label>
                        <Input
                          type="number"
                          min="1000"
                          step="1000"
                          placeholder="e.g. 7500000"
                          value={revenueAmount}
                          onChange={(e) => setRevenueAmount(e.target.value)}
                          required
                          className="rounded-[4px] border-[var(--line)] text-xs bg-[var(--field)] text-[var(--ink)] font-bold"
                        />
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-neutral-700">Notes / Remarks</Label>
                    <Input
                      placeholder="Feedback, token details, or meeting notes..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="rounded-xl border-neutral-200 text-xs"
                    />
                  </div>
                </div>

                <div className="shrink-0 flex justify-end gap-2 p-4 border-t border-neutral-100 bg-neutral-50/70">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowLogModal(false)}
                    className="rounded-xl text-xs font-bold"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={logActivityMutation.isPending}
                    className="bg-[#0284C7] hover:bg-[#0369A1] text-white rounded-xl text-xs font-bold px-5"
                  >
                    {logActivityMutation.isPending ? "Submitting..." : "Submit for Verification"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
