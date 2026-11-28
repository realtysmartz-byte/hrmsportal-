"use client";

import { useState, useEffect, useMemo, FormEvent } from "react";
import { useSession } from "next-auth/react";
import { canAccessAdminPortal } from "@realty-smartz/shared";
import type { Role } from "@realty-smartz/shared";
import { trpc } from "@/lib/trpc";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";
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
  BarChart2,
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
import {
  CircularScoreGauge,
  TargetVsActualBarChart,
  TeamLeaderComparisonChart,
} from "@/components/PerformanceCharts";

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
  const [selectedPeriod, setSelectedPeriod] = useState<
    "ALL" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY"
  >("ALL");
  const [selectedItemId, setSelectedItemId] = useState<string>("");

  // Activity Submission Form State
  const [activityType, setActivityType] = useState<
  "SITE_VISIT" | "BOOKING" | "CALL_LEAD" | "QUALIFIED_LEAD" | "TASK_COMPLETION" | "JOINING" | "INTERVIEW" | "OTHER"
    > ("TASK_COMPLETION");
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

  useBodyScrollLock(showLogModal);

  const { data: myTargets, isLoading } = trpc.target.myTargets.useQuery(undefined, {
    staleTime: 5000,
    refetchOnWindowFocus: true,
  });
  const { data: teamData } = trpc.target.myTeamPerformance.useQuery(undefined, {
    staleTime: 5000,
    refetchOnWindowFocus: true,
  });

  const filteredMyTargets = (myTargets ?? []).filter(
    (t: any) => selectedPeriod === "ALL" || (t.periodType || "MONTHLY") === selectedPeriod
  );

  const activeTarget =
    filteredMyTargets.find((t: any) => t.id === selectedTargetId) || filteredMyTargets[0] || null;

  const selectedMilestoneItem = useMemo(() => {
    if (!activeTarget?.items || activeTarget.items.length === 0) return null;
    return activeTarget.items.find((it: any) => it.id === selectedItemId) || activeTarget.items[0];
  }, [activeTarget?.items, selectedItemId]);

  // Set default selected target and target item when modal opens
  useEffect(() => {
    if (filteredMyTargets.length > 0 && !filteredMyTargets.some((t: any) => t.id === selectedTargetId)) {
      setSelectedTargetId(filteredMyTargets[0].id);
      if (filteredMyTargets[0].items && filteredMyTargets[0].items.length > 0) {
        setSelectedItemId(filteredMyTargets[0].items[0].id);
      }
    }
  }, [filteredMyTargets, selectedTargetId]);

  const getRagStyle = (score: number) => {
    if (score >= 100) {
      return {
        label: "Green • 100%",
        badgeClass: "bg-emerald-600 text-white",
        barClass: "bg-emerald-600",
        stroke: "#16A34A",
      };
    }
    if (score >= 50) {
      return {
        label: "Amber • 50–99%",
        badgeClass: "bg-amber-500 text-white",
        barClass: "bg-amber-500",
        stroke: "#D97706",
      };
    }
    return {
      label: "Red • <50%",
      badgeClass: "bg-rose-600 text-white",
      barClass: "bg-rose-600",
      stroke: "#DC2626",
    };
  };

  const logActivityMutation = trpc.target.logActivity.useMutation({
    onSuccess: () => {
      setSuccessMessage("Deliverable submitted successfully! Sent to manager verification queue.");
      utils.target.myTargets.invalidate();
      utils.target.myTeamPerformance.invalidate();
      utils.employee.notifications.invalidate();
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
        const targetItem = item || activeTarget?.items?.[0] || null;
        if (targetItem) {
          setSelectedItemId(targetItem.id);
          setDeliverableTitle(`${targetItem.title} - Completed`);
          const cat = (targetItem.category || "").toUpperCase();
          const titleLower = (targetItem.title || "").toLowerCase();
          if (cat === "HR" || titleLower.includes("interview")) {
            setActivityType("INTERVIEW");
          } else if (titleLower.includes("joining") || titleLower.includes("hire") || titleLower.includes("onboard")) {
            setActivityType("JOINING");
          } else if (cat === "PRESALES" || titleLower.includes("call")) {
            setActivityType("CALL_LEAD");
          } else if (titleLower.includes("lead")) {
            setActivityType("QUALIFIED_LEAD");
          } else if (titleLower.includes("booking") || titleLower.includes("revenue") || targetItem.unit === "INR") {
            setActivityType("BOOKING");
          } else if (titleLower.includes("visit")) {
            setActivityType("SITE_VISIT");
          } else {
            setActivityType("TASK_COMPLETION");
          }
        } else {
          setSelectedItemId("");
          setActivityType("TASK_COMPLETION");
          setDeliverableTitle("");
        }
        setQuantity("1");
        setShowLogModal(true);
      }

      function handleLinkedItemChange(itemId: string) {
        setSelectedItemId(itemId);
        const targetItem = activeTarget?.items?.find((it: any) => it.id === itemId);
        if (targetItem) {
          setDeliverableTitle(`${targetItem.title} - Update`);
          const cat = (targetItem.category || "").toUpperCase();
          const titleLower = (targetItem.title || "").toLowerCase();
          if (cat === "HR" || titleLower.includes("interview")) {
            setActivityType("INTERVIEW");
          } else if (titleLower.includes("joining") || titleLower.includes("hire") || titleLower.includes("onboard")) {
            setActivityType("JOINING");
          } else if (cat === "PRESALES" || titleLower.includes("call")) {
            setActivityType("CALL_LEAD");
          } else if (titleLower.includes("lead")) {
            setActivityType("QUALIFIED_LEAD");
          } else if (titleLower.includes("booking") || titleLower.includes("revenue") || targetItem.unit === "INR") {
            setActivityType("BOOKING");
          } else if (titleLower.includes("visit")) {
            setActivityType("SITE_VISIT");
          } else {
            setActivityType("TASK_COMPLETION");
          }
        }
      }

      const assignedCompany = activeTarget?.companyName || teamData?.companyName || "Realty Smartz";
      const hasPersonalTargets = !!myTargets && myTargets.length > 0;
      const hasTeamSection = !!(teamData && teamData.isTeamLeader);

      return (
        <div className="mx-auto max-w-5xl px-3 sm:px-4 space-y-4 sm:space-y-5 pb-14">
          {/* Compact Mobile-First Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--line)] pb-3.5">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-2xl font-bold text-[var(--ink)] tracking-tight">
                  My Performance
                </h1>
                <span className="rounded-full bg-[var(--active)] text-[var(--accent)] border border-[var(--line)] px-2.5 py-0.5 text-[11px] font-bold flex items-center gap-1">
                  <Compass className="h-3 w-3 shrink-0" />
                  {assignedCompany}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                90% Deliverables • 10% Attendance Discipline
              </p>
            </div>

            {activeTarget && (
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    onClick={() => openLogModalForItem()}
                    className="bg-[var(--accent)] hover:opacity-90 text-[var(--accent-ink)] font-bold text-xs rounded-[4px] gap-1.5 shadow-none h-9 px-3.5 w-full sm:w-auto"
                  >
                    <Plus className="h-4 w-4 shrink-0" />
                    + Submit Work Progress
                  </Button>
                </div>
        )}
              </div>

      {/* Period Filter Pills (Weekly / Monthly / Quarterly / Yearly) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {(["ALL", "WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setSelectedPeriod(p)}
                  className={`px-3 py-1.5 rounded-[4px] text-xs font-bold border transition-all shrink-0 ${selectedPeriod === p
                      ? "bg-[var(--accent)] text-[var(--accent-ink)] border-[var(--accent)]"
                      : "bg-[var(--card)] text-[var(--muted)] border-[var(--line)] hover:text-[var(--ink)]"
                    }`}
                >
                  {p === "ALL" ? "All Periods" : p.charAt(0) + p.slice(1).toLowerCase()}
                </button>
              ))}
            </div>

            {/* Target Sheet Switcher (if multiple in selected period) */}
            {filteredMyTargets.length > 1 && (
              <Card className="p-3 rounded-[4px] bg-[var(--card)] border border-[var(--line)] shadow-none flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[var(--accent)] shrink-0" />
                  <span className="text-xs font-bold text-[var(--ink)]">Target Sheet:</span>
                </div>
                <select
                  value={selectedTargetId || activeTarget?.id || ""}
                  onChange={(e) => setSelectedTargetId(e.target.value)}
                  className="w-full sm:w-auto rounded-[4px] border border-[var(--line)] bg-[var(--field)] px-3 py-1.5 text-xs font-bold text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                >
                  {filteredMyTargets.map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {t.title} ({t.periodType || "MONTHLY"}) • {t.totalScore}%
                    </option>
                  ))}
                </select>
              </Card>
            )}

            {isLoading ? (
              <Card className="p-12 text-center rounded-[4px] bg-[var(--card)] border border-[var(--line)] shadow-none space-y-3">
                <Loader2 className="h-8 w-8 text-[var(--accent)] animate-spin mx-auto" />
                <h3 className="font-bold text-[var(--ink)] text-sm">Loading Performance...</h3>
              </Card>
            ) : (
              <div className="space-y-4 sm:space-y-5">
                {/* PERSONAL SCORECARD + RAG GRAPH */}
                {activeTarget ? (
                  <>
                    {/* Hero Summary & Mobile RAG Chart */}
                    <Card className="rounded-[4px] border border-[var(--line)] bg-[var(--card)] p-4 sm:p-5 shadow-none space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          {/* Circular SVG Score Ring */}
                          {(() => {
                            const rag = getRagStyle(activeTarget.totalScore);
                            const pct = Math.min(100, Math.max(0, activeTarget.totalScore));
                            const radius = 34;
                            const circ = 2 * Math.PI * radius;
                            const dash = (pct / 100) * circ;
                            return (
                              <div className="relative h-20 w-20 shrink-0 flex items-center justify-center">
                                <svg viewBox="0 0 84 84" className="h-20 w-20 -rotate-90">
                                  <circle cx="42" cy="42" r={radius} fill="none" stroke="var(--line)" strokeWidth="8" />
                                  <circle
                                    cx="42"
                                    cy="42"
                                    r={radius}
                                    fill="none"
                                    stroke={rag.stroke}
                                    strokeWidth="8"
                                    strokeDasharray={`${dash} ${circ}`}
                                    strokeLinecap="round"
                                  />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                  <span className="text-base font-black text-[var(--ink)]">{activeTarget.totalScore}%</span>
                                </div>
                              </div>
                            );
                          })()}

                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="rounded-[2px] bg-[var(--soft)] border border-[var(--line)] px-2 py-0.5 text-[11px] font-semibold text-[var(--ink)] truncate max-w-[220px]">
                                {activeTarget.title}
                              </span>
                              <span className="text-[11px] font-bold text-[var(--accent)] uppercase">
                                {activeTarget.periodType || "MONTHLY"}
                              </span>
                            </div>
                            <div className="text-[11px] text-[var(--muted)]">
                              {formatDate(activeTarget.startDate)} – {formatDate(activeTarget.endDate)}
                            </div>
                            <div>
                              <span
                                className={`inline-block px-2 py-0.5 rounded-[2px] text-[10px] font-extrabold uppercase ${getRagStyle(activeTarget.totalScore).badgeClass
                                  }`}
                              >
                                {getRagStyle(activeTarget.totalScore).label}
                              </span>
                            </div>
                          </div>
                        </div>

                        {activeTarget.incentiveAmount > 0 && (
                          <div className="p-3 rounded-[4px] chip-ok border border-[var(--line)] flex sm:block items-center justify-between sm:text-right">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ok)] block">
                              Target Bonus
                            </span>
                            <strong className="text-base font-black text-[var(--ok)]">
                              {formatCurrency(activeTarget.incentiveAmount)}
                            </strong>
                          </div>
                        )}
                      </div>

                      {/* Split Progress Bar */}
                      <div className="pt-3 border-t border-[var(--line)] space-y-1.5">
                        <div className="flex justify-between text-[11px] font-bold text-[var(--ink)] gap-2 flex-wrap">
                          <span>
                            Attendance:{" "}
                            <strong className="text-[var(--accent)]">{activeTarget.discipline.score}% / 10%</strong>
                          </span>
                          <span>
                            Deliverables:{" "}
                            <strong className="text-[var(--ok)]">
                              {Math.max(0, Math.round((activeTarget.totalScore - activeTarget.discipline.score) * 10) / 10)}% / 90%
                            </strong>
                          </span>
                        </div>
                        <div className="h-2.5 w-full rounded-full bg-[var(--line)] flex overflow-hidden p-0.5">
                          <div
                            className="h-full rounded-l-full bg-[var(--accent)]"
                            style={{ width: `${activeTarget.discipline.score}%` }}
                          />
                          <div
                            className="h-full rounded-r-full bg-[var(--ok)]"
                            style={{
                              width: `${Math.min(90, Math.max(0, activeTarget.totalScore - activeTarget.discipline.score))}%`,
                            }}
                          />
                        </div>
                      </div>
                    </Card>

                    {/* Mobile RAG Graph Card */}
                    <Card className="rounded-[4px] border border-[var(--line)] bg-[var(--card)] p-4 sm:p-5 shadow-none space-y-4">
                      <TargetVsActualBarChart
                        title={`Performance Graph (${activeTarget.periodType || "MONTHLY"})`}
                        items={[
                          ...(activeTarget.items || []).map((item: any) => ({
                            label: item.title,
                            target: item.targetValue,
                            achieved: item.achievedValue,
                            unit: item.unit,
                            weight: item.weightPercent,
                          })),
                          {
                            label: "Attendance Discipline (10%)",
                            target: 10,
                            achieved: activeTarget.discipline?.score || 0,
                            unit: "%",
                            weight: 10,
                          },
                        ]}
                      />
                    </Card>
                  </>
                ) : (
                      <Card className="rounded-[4px] border border-[var(--line)] bg-[var(--card)] p-8 text-center shadow-none space-y-3">
                        <div className="h-12 w-12 rounded-full bg-[var(--soft)] flex items-center justify-center mx-auto text-xl">
                          🎯
                        </div>
                        <h3 className="font-bold text-[var(--ink)] text-sm">
                          No Performance Target Assigned
                        </h3>
                        <p className="text-xs text-[var(--muted)] max-w-md mx-auto">
                          {hasPersonalTargets
                            ? `No target sheets found for the selected "${selectedPeriod}" period filter.`
                            : "You currently do not have an active performance target sheet assigned. Once your manager or HR assigns your targets and milestones, they will appear here."}
                        </p>
                      </Card>
          )}

                      {/* TEAM LEADER SECTION: TEAM HIERARCHY & TEAM TARGETS (VISIBLE EVEN IF NO PERSONAL TARGET) */}
                      {hasTeamSection && teamData && (
                        <Card className="rounded-[4px] border border-[var(--line)] bg-[var(--card)] p-4 sm:p-5 shadow-none space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--line)] pb-3">
                            <div className="flex items-center gap-2.5">
                              <div className="p-2 rounded-[4px] bg-[var(--active)] text-[var(--accent)] shrink-0">
                                <Users className="h-4 w-4" />
                              </div>
                              <div>
                                <h3 className="font-bold text-[var(--ink)] text-sm">
                                  My Team Targets &amp; Hierarchy
                                </h3>
                                <p className="text-[11px] text-[var(--muted)]">
                                  {teamData.leaderName} • {teamData.memberCount} active member(s)
                                </p>
                              </div>
                            </div>
                            <span
                              className={`self-start sm:self-center px-2.5 py-0.5 rounded-[2px] text-[10px] font-extrabold uppercase ${getRagStyle(teamData.summary.teamAvgScore || 0).badgeClass
                                }`}
                            >
                              Team Avg: {teamData.summary.teamAvgScore || 0}%
                            </span>
                          </div>

                          {/* Visual Team Leader Comparison Graph */}
                          <TeamLeaderComparisonChart
                            teamTargetVisits={teamData.summary.teamTargetVisits}
                            teamAchievedVisits={teamData.summary.teamAchievedVisits}
                            teamTargetBookings={teamData.summary.teamTargetBookings}
                            teamAchievedBookings={teamData.summary.teamAchievedBookings}
                            teamTargetRevenue={teamData.summary.teamTargetRevenue}
                            teamAchievedRevenue={teamData.summary.teamAchievedRevenue}
                            members={(teamData.hierarchyMembers ?? teamData.directReports ?? []).map((member: any) => {
                              const mTarget = teamData.teamTargets.find((t: any) => t.employeeId === member.id);
                              return {
                                id: member.id,
                                name: `${member.firstName} ${member.lastName}`,
                                role: `${member.designation?.title || "Staff"} (${member.employeeCode || "RS"})`,
                                score: mTarget?.totalScore ?? 0,
                                visits: mTarget?.currentVisits || 0,
                                targetVisits: mTarget?.targetVisits || 0,
                                bookings: mTarget?.currentBookings || 0,
                                targetBookings: mTarget?.targetBookings || 0,
                                revenue: mTarget?.currentRevenue || 0,
                                targetRevenue: mTarget?.targetRevenue || 0,
                              };
                            })}
                          />

                          {/* Team Hierarchy Members + RAG Graph */}
                          <div className="space-y-2.5">
                            {(teamData.hierarchyMembers ?? teamData.directReports ?? []).map((member: any) => {
                              const mTarget = teamData.teamTargets.find((t: any) => t.employeeId === member.id);
                              const mScore = mTarget?.totalScore ?? 0;
                              const rag = getRagStyle(mScore);
                              const indent = member.level && member.level > 1 ? "ml-3 sm:ml-6 border-l-2 border-l-[var(--accent)]" : "";
                              return (
                                <div
                                  key={member.id}
                                  className={`p-3 rounded-[4px] border border-[var(--line)] bg-[var(--card)] space-y-2 text-xs ${indent}`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <strong className="font-bold text-[var(--ink)] truncate">
                                          {member.firstName} {member.lastName}
                                        </strong>
                                        {member.directReportsCount > 0 && (
                                          <span className="px-1.5 py-0.2 rounded bg-[var(--active)] text-[var(--accent)] text-[10px] font-bold">
                                            Sub-TL ({member.directReportsCount})
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[10px] text-[var(--muted)] truncate">
                                        {member.designation?.title || "Staff"} ({member.employeeCode || "RS"})
                                        {member.managerName && member.level > 1 ? ` • Under ${member.managerName}` : ""}
                                      </div>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-[2px] text-[10px] font-bold shrink-0 ${rag.badgeClass}`}>
                                      {mScore}%
                                    </span>
                                  </div>

                                  {/* Member RAG Bar */}
                                  <div className="h-2 w-full rounded-full bg-[var(--line)] overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all duration-300 ${rag.barClass}`}
                                      style={{ width: `${Math.max(4, Math.min(100, mScore))}%` }}
                                    />
                                  </div>

                                  {mTarget ? (
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] pt-1 border-t border-[var(--line)]">
                                      <span>
                                        Visits: <strong>{mTarget.currentVisits || 0}/{mTarget.targetVisits || 0}</strong>
                                      </span>
                                      <span>
                                        Bookings: <strong>{mTarget.currentBookings || 0}/{mTarget.targetBookings || 0}</strong>
                                      </span>
                                      <span>
                                        Revenue: <strong className="text-[var(--ok)]">{formatCurrency(mTarget.currentRevenue || 0)}</strong>
                                        /{formatCurrency(mTarget.targetRevenue || 0)}
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="text-[10px] text-[var(--muted)] italic">No target assigned yet</div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </Card>
                      )}

                      {activeTarget && (
                        <>

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
                                    <span className="rounded-full bg-[var(--active)] px-2 py-0.5 text-[10px] font-extrabold text-[var(--accent)]">
                                      {activeTarget.discipline.score}% / 10%
                                    </span>
                                  </div>

                                  <div className="space-y-1">
                                    <div className="flex justify-between text-xs">
                                      <span className="text-[var(--muted)]">Working Days Credit:</span>
                                      <strong className="text-[var(--ink)]">
                                        {activeTarget.discipline.earnedCredits} / {activeTarget.discipline.expectedWorkingDays} Days
                                      </strong>
                                    </div>
                                    <div className="h-2 w-full rounded-full bg-[var(--line)] overflow-hidden">
                                      <div
                                        className="h-full rounded-full bg-[var(--accent)]"
                                        style={{ width: `${Math.min(100, (activeTarget.discipline.score / 10) * 100)}%` }}
                                      />
                                    </div>
                                  </div>

                                  <div className="text-[10px] text-[var(--muted)] flex items-center gap-2 flex-wrap pt-1 border-t border-[var(--line)]">
                                    <span>{activeTarget.discipline.onTimeDays} on-time</span>
                                    {(activeTarget.discipline.lateMarkOnlyDays ?? 0) > 0 && (
                                      <span>• {activeTarget.discipline.lateMarkOnlyDays} late mark (10:15+)</span>
                                    )}
                                    {activeTarget.discipline.lateDays > 0 && (
                                      <span>• {activeTarget.discipline.lateDays} late 10:30+ (3 = half day)</span>
                                    )}
                                    {activeTarget.discipline.halfDays > 0 && (
                                      <span>• {activeTarget.discipline.halfDays} half-day</span>
                                    )}
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
                              <span className="text-xs text-[var(--muted)]">
                                {activeTarget.activities?.length || 0} Submissions
                              </span>
                            </div>

                            {(!activeTarget.activities || activeTarget.activities.length === 0) ? (
                              <div className="p-8 text-center text-xs text-[var(--muted)] bg-[var(--soft)] rounded-[4px] border border-[var(--line)]">
                                No submissions logged yet. Click "Log Work Deliverable" above to submit completed visits, calls, or deals.
                              </div>
                            ) : (
                              <div className="divide-y divide-[var(--line)]">
                                {activeTarget.activities.map((act: any) => (
                                  <div
                                    key={act.id}
                                    className="py-3 flex items-start justify-between gap-3 text-xs"
                                  >
                                    <div className="space-y-0.5 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span
                                          className={`rounded-[2px] px-2 py-0.5 text-[10px] font-extrabold ${act.status === "APPROVED"
                                            ? "chip-ok"
                                            : act.status === "PENDING"
                                              ? "chip-warn"
                                              : "chip-danger"
                                            }`}
                                        >
                                          {act.status === "PENDING" ? "Awaiting Review" : act.status}
                                        </span>
                                        <span className="font-bold text-[var(--ink)]">
                                          {act.title || act.projectName || act.activityType}
                                        </span>
                                        {act.quantity > 1 && (
                                          <span className="text-[var(--muted)] font-medium">({act.quantity} units)</span>
                                        )}
                                      </div>

                                      <div className="text-[11px] text-[var(--muted)] flex items-center gap-3">
                                        <span>Date: {formatDate(act.activityDate)}</span>
                                        {act.clientName && <span>Client: {act.clientName}</span>}
                                        {act.revenueAmount > 0 && (
                                          <strong className="text-[var(--ok)]">
                                            {formatCurrency(act.revenueAmount)}
                                          </strong>
                                        )}
                                      </div>

                                      {act.rejectionReason && (
                                        <p className="text-[11px] text-[var(--danger)] font-semibold">
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
                                        className="text-[var(--muted)] hover:text-[var(--danger)] h-7 px-2"
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
                        </>
                      )}
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
                              <Target className="h-5 w-5 text-[var(--accent)]" />
                              <h3 className="font-bold text-[var(--ink)] text-base">
                                Log Deliverable
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

                                {/* Active Milestone Info Card */}
                                {selectedMilestoneItem ? (
                                  <div className="rounded-[4px] border border-sky-200 bg-sky-50/60 p-3 space-y-1.5">
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#0284C7]">
                                          Selected Milestone:
                                        </span>
                                        <span className="text-xs font-extrabold text-neutral-900 truncate">
                                          {selectedMilestoneItem.title}
                                        </span>
                                      </div>
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-[#0284C7] shrink-0">
                                        {selectedMilestoneItem.category} • {selectedMilestoneItem.weightPercent}% Weight
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs font-semibold text-neutral-700 pt-1 border-t border-sky-100">
                                      <span>Current Achieved / Target:</span>
                                      <strong className="text-neutral-900">
                                        {selectedMilestoneItem.unit === "INR"
                                          ? `${formatCurrency(selectedMilestoneItem.achievedValue)} / ${formatCurrency(selectedMilestoneItem.targetValue)}`
                                          : `${selectedMilestoneItem.achievedValue} / ${selectedMilestoneItem.targetValue} ${selectedMilestoneItem.unit}`}
                                      </strong>
                                    </div>
                                  </div>
                                ) : null}

                                {/* Linked Item Selection */}
                                {activeTarget && activeTarget.items && activeTarget.items.length > 0 && (
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold text-[var(--muted)]">
                                      Target Milestone / Deliverable *
                                    </Label>
                                    <select
                                      value={selectedItemId || activeTarget.items[0]?.id || ""}
                                      onChange={(e) => handleLinkedItemChange(e.target.value)}
                                      required
                                      className="w-full rounded-[4px] border border-[var(--line)] bg-[var(--field)] px-3 py-2 text-xs font-semibold text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                                    >
                                      {activeTarget.items.map((it: any) => (
                                        <option key={it.id} value={it.id}>
                                          {it.title} ({it.unit} • Target: {it.targetValue} • {it.weightPercent}% weight)
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                )}

                                {/* Deliverable Title */}
                                <div className="space-y-1.5">
                                  <Label className="text-xs font-semibold text-[var(--muted)]">
                                    Deliverable Description / Activity *
                                  </Label>
                                  <Input
                                    placeholder={`e.g. Completed ${selectedMilestoneItem ? selectedMilestoneItem.title : "assigned milestone"}...`}
                                    value={deliverableTitle}
                                    onChange={(e) => setDeliverableTitle(e.target.value)}
                                    required
                                    className="rounded-[4px] border-[var(--line)] bg-[var(--field)] text-[var(--ink)] text-xs"
                                  />
                                </div>

                                {/* Quantity & Date */}
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold text-[var(--muted)]">
                                      {selectedMilestoneItem ? `${selectedMilestoneItem.unit} Completed *` : "Units Completed *"}
                                    </Label>
                                    <Input
                                      type="number"
                                      min="0.1"
                                      step="any"
                                      value={quantity}
                                      onChange={(e) => setQuantity(e.target.value)}
                                      required
                                      className="rounded-[4px] border-[var(--line)] bg-[var(--field)] text-[var(--ink)] text-xs font-bold"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold text-[var(--muted)]">Completion Date *</Label>
                                    <Input
                                      type="date"
                                      value={activityDate}
                                      onChange={(e) => setActivityDate(e.target.value)}
                                      required
                                      className="rounded-[4px] border-[var(--line)] bg-[var(--field)] text-[var(--ink)] text-xs"
                                    />
                                  </div>
                                </div>

                                {/* Dynamic Reference / Participant / Client Details */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold text-[var(--muted)]">
                                      {selectedMilestoneItem?.category === "HR"
                                        ? "Candidate / Employee Name (Optional)"
                                        : selectedMilestoneItem?.category === "IT"
                                          ? "Task / Ticket Reference (Optional)"
                                          : "Client / Contact Name (Optional)"}
                                    </Label>
                                    <Input
                                      placeholder={
                                        selectedMilestoneItem?.category === "HR"
                                          ? "e.g. Rahul Sharma"
                                          : selectedMilestoneItem?.category === "IT"
                                            ? "e.g. JIRA-104 / Auth Fix"
                                            : "e.g. Ramesh Kumar"
                                      }
                                      value={clientName}
                                      onChange={(e) => setClientName(e.target.value)}
                                      className="rounded-[4px] border-[var(--line)] bg-[var(--field)] text-[var(--ink)] text-xs"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold text-[var(--muted)]">
                                      {selectedMilestoneItem?.category === "HR"
                                        ? "Candidate Phone (Optional)"
                                        : selectedMilestoneItem?.category === "IT"
                                          ? "PR / Documentation Link (Optional)"
                                          : "Contact Phone (Optional)"}
                                    </Label>
                                    <Input
                                      placeholder={
                                        selectedMilestoneItem?.category === "IT"
                                          ? "e.g. https://github.com/..."
                                          : "e.g. +91 98765 43210"
                                      }
                                      value={clientPhone}
                                      onChange={(e) => setClientPhone(e.target.value)}
                                      className="rounded-[4px] border-[var(--line)] bg-[var(--field)] text-[var(--ink)] text-xs"
                                    />
                                  </div>
                                </div>

                                  {/* Deal Booking / Revenue Specifics only if unit is INR or category is BOOKING/SALES revenue */ }
                  {(selectedMilestoneItem?.unit === "INR" || activityType === "BOOKING") && (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200/70">
                                    <div className="space-y-1.5">
                                      <Label className="text-xs font-semibold text-neutral-700">Unit / Flat No. (Optional)</Label>
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
                                        min="0"
                                        step="any"
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
                                  <Label className="text-xs font-semibold text-[var(--muted)]">Notes / Remarks</Label>
                                  <Input
                                    placeholder="Feedback, token details, or meeting notes..."
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="rounded-[4px] border-[var(--line)] bg-[var(--field)] text-[var(--ink)] text-xs"
                                  />
                                </div>
                              </div>

                              <div className="shrink-0 flex justify-end gap-2 p-4 border-t border-[var(--line)] bg-[var(--card)]">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => setShowLogModal(false)}
                                  className="rounded-[4px] border-[var(--line)] text-[var(--ink)] hover:bg-[var(--soft)] text-xs font-bold"
                                >
                                  Cancel
                                </Button>
                                <Button
                                  type="submit"
                                  disabled={logActivityMutation.isPending}
                                  className="bg-[var(--accent)] hover:opacity-90 text-[var(--accent-ink)] rounded-[4px] text-xs font-bold px-5"
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
