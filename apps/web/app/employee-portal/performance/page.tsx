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
  MapPin,
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
  const isAdmin = canAccessAdminPortal(role);

  const utils = trpc.useUtils();
  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedTargetId, setSelectedTargetId] = useState<string>("");
  const [selectedItemId, setSelectedItemId] = useState<string>("");

  // Activity Submission Form State
  const [activityType, setActivityType] = useState<
    "SITE_VISIT" | "BOOKING" | "TASK_COMPLETION" | "JOINING" | "INTERVIEW" | "OTHER"
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
      setSuccessMessage(
        "Deliverable submitted successfully! Sent to manager verification queue."
      );
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
      }, 1800);
    },
    onError: (err) => {
      setFormError(userFacingErrorMessage(err));
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

          return (
          <div className="mx-auto max-w-6xl space-y-6 pb-12">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight">
                    My Performance Scorecard & Targets
                  </h1>
                    <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-bold text-[#0284C7]">
                      100% Index
                    </span>
                </div>
                <p className="mt-0.5 text-xs sm:text-sm text-neutral-500">
                  Track your 10% Attendance Discipline and weighted role deliverables in real-time.
                </p>
              </div>

              <Button
                onClick={() => setShowLogModal(true)}
                className="bg-[#0284C7] hover:bg-[#0369A1] text-white font-bold text-xs rounded-xl gap-2 shadow-xs shrink-0"
              >
                <Sparkles className="h-4 w-4" />
                Submit Deliverable for Verification
              </Button>
            </div>

            {/* Target Sheet Switcher Dropdown (if multiple target sheets exist) */}
            {myTargets && myTargets.length > 1 && (
              <Card className="p-3.5 rounded-2xl bg-white border border-neutral-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[#0284C7]" />
                  <span className="text-xs font-bold text-neutral-800">
                    Select Scorecard Target Period:
                  </span>
                </div>
                <select
                  value={selectedTargetId || activeTarget?.id}
                  onChange={(e) => setSelectedTargetId(e.target.value)}
                  className="rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-xs font-bold text-neutral-800 outline-none focus:border-[#0284C7] shadow-xs"
                >
                  {myTargets.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} ({t.month ? MONTHS[t.month - 1] : ""} {t.year}) • Score: {t.totalScore}%
                    </option>
                  ))}
                </select>
              </Card>
            )}

            {isLoading ? (
              <Card className="p-16 text-center rounded-2xl bg-white border border-neutral-200 shadow-xs space-y-4">
                <Loader2 className="h-10 w-10 text-[#0284C7] animate-spin mx-auto" />
                <div className="space-y-1">
                  <h3 className="font-bold text-neutral-800 text-sm">
                    Loading Your Performance Scorecard...
                  </h3>
                  <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                    Evaluating your real-time attendance punctuality (10% discipline) and verified deliverables.
                  </p>
                </div>
              </Card>
            ) : !activeTarget ? (
              <Card className="rounded-2xl border-neutral-200/80 bg-white p-12 text-center shadow-xs">
                <Target className="h-12 w-12 text-neutral-300 mx-auto mb-3" />
                <h3 className="font-bold text-neutral-800 text-base">No Target Sheet Assigned</h3>
                <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                  You do not have an active target sheet assigned for this period. Your HR administrator will assign your monthly goals soon.
                </p>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Top Scorecard Hero Card */}
                <Card className="rounded-2xl border-neutral-200/80 bg-white p-6 shadow-xs">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                          <span className="rounded-full bg-sky-50 text-[#0284C7] border border-sky-200 px-3 py-1 text-xs font-bold">
                            {activeTarget.title}
                          </span>
                          <span className="text-xs text-neutral-400">
                            ({formatDate(activeTarget.startDate)} to {formatDate(activeTarget.endDate)})
                          </span>
                      </div>
                      <h2 className="text-xl font-black text-neutral-900">
                        Overall Achievement: <span className="text-[#0284C7]">{activeTarget.totalScore}%</span>
                      </h2>
                      <p className="text-xs text-neutral-500">
                        Every single unit or deal you complete earns exact pro-rata percentage towards your 100% total.
                      </p>
                    </div>

                    {/* Big Score Radial Summary */}
                    <div className="flex items-center gap-6 justify-between md:justify-end border-t md:border-t-0 pt-4 md:pt-0 border-neutral-100">
                      <div className="text-center">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
                          Total Score
                        </span>
                        <div className="flex items-baseline justify-center gap-1 mt-0.5">
                          <span className="text-3xl font-black text-neutral-900">
                            {activeTarget.totalScore}%
                          </span>
                          <span className="text-xs font-semibold text-neutral-400">/ 100%</span>
                        </div>
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase mt-1 ${activeTarget.totalScore >= 80
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

                      <div className="border-l border-neutral-200 pl-6 space-y-1 text-xs">
                        <div className="flex justify-between gap-4">
                          <span className="text-neutral-500">Discipline (10%):</span>
                          <strong className="text-sky-700">{activeTarget.discipline.score}%</strong>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-neutral-500">Role KPIs (90%):</span>
                            <strong className="text-[#0284C7]">
                              {Math.max(0, Math.round((activeTarget.totalScore - activeTarget.discipline.score) * 10) / 10)}%
                            </strong>
                        </div>
                        {activeTarget.incentiveAmount > 0 && (
                          <div className="flex justify-between gap-4 pt-1 border-t border-neutral-100">
                            <span className="text-neutral-500">Potential Bonus:</span>
                            <strong className="text-emerald-700">{formatCurrency(activeTarget.incentiveAmount)}</strong>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Split Progress Bar */}
                  <div className="mt-6 pt-4 border-t border-neutral-100 space-y-2">
                    <div className="flex justify-between text-xs font-bold text-neutral-600">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#38BDF8] inline-block" />
                        Discipline: <strong className="text-sky-700">{activeTarget.discipline.score}% / 10%</strong>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#0284C7] inline-block" />
                        Role KPIs:{" "}
                          <strong className="text-[#0284C7]">
                            {Math.max(0, Math.round((activeTarget.totalScore - activeTarget.discipline.score) * 10) / 10)}% / 90%
                          </strong>
                      </span>
                    </div>

                    <div className="h-3 w-full rounded-full bg-neutral-100 flex overflow-hidden p-0.5">
                      <div
                        className="h-full rounded-l-full bg-[#38BDF8] transition-all duration-300"
                        style={{ width: `${activeTarget.discipline.score}%` }}
                      />
                      <div
                        className="h-full rounded-r-full bg-[#0284C7] transition-all duration-300"
                        style={{
                          width: `${Math.min(
                            90,
                            activeTarget.totalScore - activeTarget.discipline.score
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </Card>

                {/* DETAILED SCORECARD TABLE */}
                <Card className="rounded-2xl border-neutral-200/80 bg-white shadow-xs overflow-hidden">
                  <div className="p-4 sm:p-5 border-b border-neutral-100 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-neutral-900 text-sm">
                        Performance & Discipline Deliverables Table
                      </h3>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        Pro-rata calculation for each unit completed towards your 100% total scorecard.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setShowLogModal(true)}
                      className="bg-[#0284C7] hover:bg-[#0369A1] text-white font-bold text-xs rounded-xl h-8 gap-1.5"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Submit Work
                    </Button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-neutral-50/80 border-b border-neutral-200 text-neutral-500 font-bold uppercase tracking-wider text-[11px]">
                          <th className="py-3 px-4">Target / Metric</th>
                          <th className="py-3 px-3">Category</th>
                          <th className="py-3 px-4">Assigned Target</th>
                          <th className="py-3 px-4">Achieved Target</th>
                          <th className="py-3 px-3 text-center">Weight (%)</th>
                          <th className="py-3 px-4 text-center">Score (%)</th>
                          <th className="py-3 px-4 text-center">Progress</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {/* ROW 1: DISCIPLINE ROW */}
                        <tr className="bg-teal-50/30">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-lg bg-teal-100 text-teal-800">
                                <Clock className="h-4 w-4" />
                              </div>
                              <div>
                                <strong className="text-neutral-900 block font-bold">
                                  Attendance Discipline
                                </strong>
                                <span className="text-[10px] text-teal-700 font-medium">
                                  Punctuality & Presence
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-3">
                            <span className="rounded-md bg-teal-100 px-2 py-0.5 text-[10px] font-extrabold text-teal-800">
                              ATTENDANCE
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-neutral-800">
                            {activeTarget.discipline.expectedWorkingDays} Days
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="space-y-1">
                              <strong className="text-teal-900 font-bold block">
                                {activeTarget.discipline.earnedCredits} / {activeTarget.discipline.expectedWorkingDays} Days
                              </strong>
                              <div className="text-[10px] text-neutral-500 flex items-center gap-1.5 flex-wrap">
                                <span className="text-emerald-700 font-semibold">{activeTarget.discipline.onTimeDays} On-time</span>
                                {activeTarget.discipline.lateDays > 0 && (
                                  <>
                                    <span>•</span>
                                    <span className="text-amber-700 font-semibold">{activeTarget.discipline.lateDays} Late</span>
                                  </>
                                )}
                                {activeTarget.discipline.halfDays > 0 && (
                                  <>
                                    <span>•</span>
                                    <span className="text-amber-800 font-semibold">{activeTarget.discipline.halfDays} Half-day</span>
                                  </>
                                )}
                                {activeTarget.discipline.paidLeaveDays > 0 && (
                                  <>
                                    <span>•</span>
                                    <span className="text-teal-700 font-semibold">{activeTarget.discipline.paidLeaveDays} Paid Leave</span>
                                  </>
                                )}
                                {activeTarget.discipline.unpaidLeaveDays > 0 && (
                                  <>
                                    <span>•</span>
                                    <span className="text-rose-600 font-semibold">{activeTarget.discipline.unpaidLeaveDays} LWP</span>
                                  </>
                                )}
                                {activeTarget.discipline.holidayCount > 0 && (
                                  <>
                                    <span>•</span>
                                    <span className="text-purple-700 font-semibold">{activeTarget.discipline.holidayCount} Holidays</span>
                                  </>
                                )}
                                {activeTarget.discipline.absentDays > 0 && (
                                  <>
                                    <span>•</span>
                                    <span className="text-rose-700 font-semibold">{activeTarget.discipline.absentDays} Absent</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-3 text-center font-extrabold text-neutral-900 bg-neutral-100/70">
                            10.0%
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className="font-black text-sm text-teal-800 bg-teal-100/70 px-2.5 py-1 rounded-lg">
                              {activeTarget.discipline.score}%
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="w-24 mx-auto space-y-1">
                              <div className="h-2 w-full rounded-full bg-neutral-200 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-teal-500"
                                  style={{
                                    width: `${Math.min(100, (activeTarget.discipline.score / 10) * 100)}%`,
                                  }}
                                />
                              </div>
                              <span className="text-[10px] font-bold text-teal-700 block text-center">
                                {Math.round((activeTarget.discipline.score / 10) * 100)}%
                              </span>
                            </div>
                          </td>
                        </tr>

                        {/* ROLE KPI ITEMS */}
                        {(activeTarget.items || []).map((item: any) => (
                          <tr key={item.id} className="hover:bg-neutral-50/60">
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2">
                                  <div className="p-1.5 rounded-lg bg-sky-100 text-[#0284C7]">
                                    <Target className="h-4 w-4" />
                                  </div>
                                  <div>
                                    <strong className="text-neutral-900 block font-bold">
                                      {item.title}
                                    </strong>
                                    {item.notes && (
                                      <span className="text-[10px] text-neutral-400 italic">
                                        {item.notes}
                                      </span>
                                    )}
                                  </div>
                                </div>
                            </td>
                            <td className="py-3.5 px-3">
                                <span className="rounded-md bg-sky-50 text-[#0284C7] border border-sky-200 px-2 py-0.5 text-[10px] font-extrabold">
                                  {item.category}
                                </span>
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-neutral-800">
                              {item.unit === "INR"
                                ? formatCurrency(item.targetValue)
                                : `${item.targetValue} ${item.unit}`}
                            </td>
                            <td className="py-3.5 px-4">
                              <strong className="text-neutral-900 font-bold">
                                {item.unit === "INR"
                                  ? formatCurrency(item.achievedValue)
                                  : `${item.achievedValue} ${item.unit}`}
                              </strong>
                              <p className="text-[10px] text-neutral-400">Verified achieved</p>
                            </td>
                            <td className="py-3.5 px-3 text-center font-extrabold text-neutral-900 bg-neutral-100/70">
                              {item.weightPercent}%
                            </td>
                            <td className="py-3.5 px-4 text-center">
                                <span className="font-black text-sm text-[#0284C7] bg-sky-100 px-2.5 py-1 rounded-lg">
                                  {item.earnedScore}%
                                </span>
                                <span className="block text-[9px] text-neutral-400 mt-0.5">
                                  pro-rata score
                                </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="w-24 mx-auto space-y-1">
                                <div className="h-2 w-full rounded-full bg-neutral-200 overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-[#0284C7]"
                                    style={{
                                      width: `${Math.min(100, item.completionRate || 0)}%`,
                                    }}
                                  />
                                </div>
                                  <span className="text-[10px] font-bold text-[#0284C7] block text-center">
                                    {item.completionRate || 0}%
                                  </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>

                {/* MY SUBMITTED WORK & VERIFICATION STATUS */}
                <Card className="rounded-2xl border-neutral-200/80 bg-white p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                    <div className="flex items-center gap-2">
                      <FileCheck2 className="h-4 w-4 text-[#0284C7]" />
                      <h3 className="font-bold text-neutral-900 text-sm">
                        My Submission History & Manager Approvals
                      </h3>
                    </div>
                    <span className="text-xs text-neutral-400">
                      {activeTarget.activities?.length || 0} Submissions
                    </span>
                  </div>

                  {(!activeTarget.activities || activeTarget.activities.length === 0) ? (
                    <div className="p-8 text-center text-xs text-neutral-400 bg-neutral-50 rounded-xl">
                      You haven't submitted any activity deliverables for this target yet. Click "Submit Deliverable for Verification" to submit your completed work.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {activeTarget.activities.map((act: any) => (
                        <div
                          key={act.id}
                          className="flex items-start justify-between p-3.5 rounded-xl border border-neutral-200 bg-neutral-50/40 hover:bg-white transition-all gap-3"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold ${act.status === "APPROVED"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : act.status === "PENDING"
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-rose-100 text-rose-800"
                                  }`}
                              >
                                {act.status === "PENDING" ? "Awaiting Verification" : act.status}
                              </span>
                              <span className="rounded-md bg-blue-100 text-blue-800 px-2 py-0.5 text-[10px] font-extrabold">
                                {act.activityType}
                              </span>
                              <h5 className="font-bold text-neutral-900 text-sm">
                                {act.title || act.projectName || "Deliverable Entry"}
                              </h5>
                              {act.quantity > 1 && (
                                <span className="text-xs text-neutral-600 font-semibold">
                                  (Qty: {act.quantity})
                                </span>
                              )}
                              {act.targetItem && (
                                  <span className="text-xs text-[#0284C7] font-semibold">
                                    • Linked to: {act.targetItem.title}
                                  </span>
                        )}
                                </div>

                      {act.clientName && (
                                <p className="text-xs text-neutral-600">
                                  Client / Contact: <strong className="text-neutral-900">{act.clientName}</strong>
                                </p>
                              )}

                              {act.notes && (
                                <p className="text-[11px] text-neutral-500 italic">
                                  "{act.notes}"
                                </p>
                              )}

                              {act.rejectionReason && (
                                <p className="text-[11px] text-rose-600 font-semibold">
                                  Reason: {act.rejectionReason}
                                </p>
                              )}

                              <p className="text-[10px] text-neutral-400">
                                Date: {formatDate(act.activityDate)}
                              </p>
                            </div>

                            {act.revenueAmount > 0 && (
                              <div className="text-right shrink-0">
                                <span className="text-sm font-extrabold text-emerald-700 block">
                                  {formatCurrency(act.revenueAmount)}
                                </span>
                              </div>
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
                  className="relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Modal Header */}
                  <div className="shrink-0 flex items-center justify-between border-b border-neutral-100 p-4 sm:p-5 bg-white">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-[#0284C7]" />
                      <h3 className="font-bold text-neutral-900 text-base">
                        Submit Deliverable for Verification
                      </h3>
                    </div>
                    <button
                      onClick={() => setShowLogModal(false)}
                      className="text-neutral-400 hover:text-neutral-600 rounded-lg p-1"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {successMessage ? (
                    <div className="p-6 space-y-4">
                      <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold flex items-center gap-2">
                        <Check className="h-5 w-5 text-emerald-600 shrink-0" />
                        <span>{successMessage}</span>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmitActivity} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                      {/* Modal Body */}
                      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                        {formError && (
                          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-semibold">
                            {formError}
                          </div>
                        )}

                        {/* Target Item Selection */}
                        {activeTarget && activeTarget.items && activeTarget.items.length > 0 && (
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-neutral-700">
                              Select Linked Target Item *
                            </Label>
                            <select
                              value={selectedItemId}
                              onChange={(e) => setSelectedItemId(e.target.value)}
                              required
                              className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 outline-none"
                            >
                              {activeTarget.items.map((it: any) => (
                                <option key={it.id} value={it.id}>
                                  {it.title} ({it.category} • {it.weightPercent}% weight)
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Activity Type Toggle */}
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-neutral-700">Type *</Label>
                          <div className="grid grid-cols-3 gap-2">
                            <button
                              type="button"
                              onClick={() => setActivityType("SITE_VISIT")}
                              className={`py-2 rounded-xl text-xs font-bold transition-all border ${activityType === "SITE_VISIT"
                                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                                  : "bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50"
                                }`}
                            >
                              Site Visit
                            </button>
                            <button
                              type="button"
                              onClick={() => setActivityType("BOOKING")}
                              className={`py-2 rounded-xl text-xs font-bold transition-all border ${activityType === "BOOKING"
                                  ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                                  : "bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50"
                                }`}
                            >
                              Booking / Deal
                            </button>
                            <button
                              type="button"
                              onClick={() => setActivityType("TASK_COMPLETION")}
                              className={`py-2 rounded-xl text-xs font-bold transition-all border ${activityType === "TASK_COMPLETION"
                                    ? "bg-[#0284C7] text-white border-[#0284C7] shadow-sm"
                                    : "bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50"
                      }`}
                            >
                              Task / Join
                            </button>
                          </div>
                        </div>

                        {/* Deliverable Title */}
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-neutral-700">
                            Deliverable / Task Name *
                          </Label>
                          <Input
                            placeholder="e.g. Prestige Park Grove Walkthrough, Candidate Interview, Bug Fix Sprint"
                            value={deliverableTitle}
                            onChange={(e) => setDeliverableTitle(e.target.value)}
                            required
                            className="rounded-xl border-neutral-200 text-xs"
                          />
                        </div>

                        {/* Quantity Claimed */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-neutral-700">Quantity Done *</Label>
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

                        {/* Optional Client / Contact Details */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-neutral-700">
                              Client / Candidate Name
                            </Label>
                            <Input
                              placeholder="e.g. Ramesh Sharma"
                              value={clientName}
                              onChange={(e) => setClientName(e.target.value)}
                              className="rounded-xl border-neutral-200 text-xs"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-neutral-700">Contact Phone</Label>
                            <Input
                              placeholder="e.g. +91 98765 43210"
                              value={clientPhone}
                              onChange={(e) => setClientPhone(e.target.value)}
                              className="rounded-xl border-neutral-200 text-xs"
                            />
                          </div>
                        </div>

                        {/* If Booking: Unit Number & Deal Amount */}
                        {activityType === "BOOKING" && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200/70">
                            <div className="space-y-1.5">
                              <Label className="text-xs font-semibold text-neutral-700">Unit / Flat No.</Label>
                              <Input
                                placeholder="e.g. Tower B - 1402"
                                value={unitNumber}
                                onChange={(e) => setUnitNumber(e.target.value)}
                                className="rounded-xl border-neutral-200 text-xs bg-white"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs font-semibold text-neutral-700">
                                Deal Revenue (₹ INR) *
                              </Label>
                              <Input
                                type="number"
                                min="1000"
                                step="1000"
                                placeholder="e.g. 7500000"
                                value={revenueAmount}
                                onChange={(e) => setRevenueAmount(e.target.value)}
                                required
                                className="rounded-xl border-neutral-200 text-xs bg-white font-bold"
                              />
                            </div>
                          </div>
                        )}

                        {/* Notes & Proof URL */}
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-neutral-700">Notes / Remarks</Label>
                          <Input
                            placeholder="Provide details, token receipt number, or feedback..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="rounded-xl border-neutral-200 text-xs"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-neutral-700">
                            Proof / Document Link (Optional)
                          </Label>
                          <Input
                            placeholder="e.g. Google Drive link, ticket URL, or token scan"
                            value={proofUrl}
                            onChange={(e) => setProofUrl(e.target.value)}
                            className="rounded-xl border-neutral-200 text-xs"
                          />
                        </div>

                      </div>

                      {/* Modal Footer */}
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
                          {logActivityMutation.isPending ? (
                            <span className="flex items-center gap-1.5">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Submitting for Verification...
                            </span>
                          ) : (
                            "Submit for Verification"
                          )}
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
