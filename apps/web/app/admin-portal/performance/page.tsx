"use client";

import { useState, useMemo, useEffect, FormEvent } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { userFacingErrorMessage } from "@/lib/user-facing-error";
import {
  Target,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Banknote,
  Building2,
  Users,
  Calendar,
  TrendingUp,
  Award,
  ChevronRight,
  ExternalLink,
  Edit2,
  Trash2,
  AlertCircle,
  Eye,
  Check,
  X,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  Percent,
  SlidersHorizontal,
  FileCheck2,
  UserCheck,
  Briefcase,
  Code2,
  Headphones,
  FileText,
  BadgeAlert,
  ArrowUpRight,
  RefreshCw,
  Loader2,
  BarChart2,
  PieChart,
  Activity,
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

interface FormTargetItem {
  id?: string;
  title: string;
  category: "SALES" | "HR" | "IT" | "OPERATIONS" | "GENERAL";
  targetValue: number;
  unit: string;
  weightPercent: number;
  notes?: string;
}

export default function AdminTargetsPage() {
  const utils = trpc.useUtils();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // Filter States
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<string>(String(currentMonth));
  const [selectedDept, setSelectedDept] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showDisciplineDetailModal, setShowDisciplineDetailModal] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<any>(null);

  // Form States (Create / Edit)
  const [formEmployeeId, setFormEmployeeId] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formPeriodType, setFormPeriodType] = useState<"MONTHLY" | "QUARTERLY" | "YEARLY">("MONTHLY");
  const [formMonth, setFormMonth] = useState<number>(currentMonth);
  const [formYear, setFormYear] = useState<number>(currentYear);
  const [formStartDate, setFormStartDate] = useState(
    new Date(currentYear, currentMonth - 1, 1).toISOString().slice(0, 10)
  );
  const [formEndDate, setFormEndDate] = useState(
    new Date(currentYear, currentMonth, 0).toISOString().slice(0, 10)
  );
  const [formIncentiveAmount, setFormIncentiveAmount] = useState("20000");
  const [formIncentivePercent, setFormIncentivePercent] = useState("1.0");
  const [formNotes, setFormNotes] = useState("");
  const [formItems, setFormItems] = useState<FormTargetItem[]>([]);
  const [formError, setFormError] = useState("");

  // Sync Payroll Form State
  const [customBonusAmount, setCustomBonusAmount] = useState("");
  const [syncFeedback, setSyncFeedback] = useState("");

  // Verification Rejection State
  const [rejectingActivityId, setRejectingActivityId] = useState<string | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState("");

  // Lock background screen scroll when any modal is open
  useEffect(() => {
    const isAnyModalOpen =
      showCreateModal ||
      showEditModal ||
      showVerificationModal ||
      showSyncModal ||
      showDisciplineDetailModal;
    if (!isAnyModalOpen) return;

    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, [
    showCreateModal,
    showEditModal,
    showVerificationModal,
    showSyncModal,
    showDisciplineDetailModal,
  ]);

  // Queries
  const { data: targetsData, isLoading: targetsLoading, refetch: refetchTargets } =
    trpc.target.listAdmin.useQuery({
      year: selectedYear,
      month: selectedMonth === "ALL" ? undefined : parseInt(selectedMonth, 10),
      departmentId: selectedDept === "ALL" ? undefined : selectedDept,
    });

  const { data: employeesData } = trpc.employee.list.useQuery({ page: 1, pageSize: 100 });
  const { data: departmentsData } = trpc.department.list.useQuery();
  const { data: pendingVerifications, refetch: refetchPending } =
    trpc.target.listPendingVerifications.useQuery();

  // Mutations
  const createMutation = trpc.target.create.useMutation({
    onSuccess: () => {
      setShowCreateModal(false);
      resetForm();
      utils.target.listAdmin.invalidate();
    },
    onError: (err) => setFormError(userFacingErrorMessage(err)),
  });

  const updateMutation = trpc.target.update.useMutation({
    onSuccess: () => {
      setShowEditModal(false);
      setSelectedTarget(null);
      utils.target.listAdmin.invalidate();
    },
    onError: (err) => setFormError(userFacingErrorMessage(err)),
  });

  const deleteMutation = trpc.target.delete.useMutation({
    onSuccess: () => {
      if (selectedTarget) setSelectedTarget(null);
      utils.target.listAdmin.invalidate();
    },
  });

  const verifyActivityMutation = trpc.target.verifyActivity.useMutation({
    onSuccess: () => {
      refetchPending();
      utils.target.listAdmin.invalidate();
      setRejectingActivityId(null);
      setRejectionReasonInput("");
    },
  });

  const deleteActivityMutation = trpc.target.deleteActivity.useMutation({
    onSuccess: () => {
      utils.target.listAdmin.invalidate();
    },
  });

  const syncBonusMutation = trpc.target.syncBonusToPayroll.useMutation({
    onSuccess: (data) => {
      setSyncFeedback(
        `Successfully credited ${formatCurrency(data.amount)} bonus to ${data.employeeName} for ${
          MONTHS[data.month - 1]
        } ${data.year}!`
      );
      utils.target.listAdmin.invalidate();
    },
    onError: (err) => setFormError(userFacingErrorMessage(err)),
  });

  // Calculate sum of item weights in form
  const formTotalItemsWeight = useMemo(() => {
    return formItems.reduce((acc, curr) => acc + (Number(curr.weightPercent) || 0), 0);
  }, [formItems]);

  const formTotalScorecardWeight = formTotalItemsWeight + 10; // +10% Discipline

  // Reset form
  function resetForm() {
    setFormEmployeeId("");
    setFormTitle("");
    setFormPeriodType("MONTHLY");
    setFormMonth(currentMonth);
    setFormYear(currentYear);
    setFormStartDate(new Date(currentYear, currentMonth - 1, 1).toISOString().slice(0, 10));
    setFormEndDate(new Date(currentYear, currentMonth, 0).toISOString().slice(0, 10));
    setFormIncentiveAmount("20000");
    setFormIncentivePercent("1.0");
    setFormNotes("");
    setFormError("");
    setFormItems([
      {
        title: "Site Visits & Property Inspections",
        category: "SALES",
        targetValue: 15,
        unit: "Visits",
        weightPercent: 30,
      },
      {
        title: "Confirmed Unit Bookings",
        category: "SALES",
        targetValue: 2,
        unit: "Bookings",
        weightPercent: 30,
      },
      {
        title: "Gross Sales Revenue",
        category: "SALES",
        targetValue: 5000000,
        unit: "INR",
        weightPercent: 30,
      },
    ]);
  }

  // Preset loaders for departments
  function applyPreset(presetType: "SALES" | "HR" | "IT" | "OPERATIONS") {
    if (presetType === "SALES") {
      setFormItems([
        {
          title: "Site Visits & Client Walkthroughs",
          category: "SALES",
          targetValue: 15,
          unit: "Visits",
          weightPercent: 30,
          notes: "Prospective buyer visits to assigned properties",
        },
        {
          title: "Confirmed Unit Bookings",
          category: "SALES",
          targetValue: 2,
          unit: "Bookings",
          weightPercent: 30,
          notes: "Closed bookings with token / initial booking amount",
        },
        {
          title: "Gross Sales Revenue",
          category: "SALES",
          targetValue: 5000000,
          unit: "INR",
          weightPercent: 30,
          notes: "Total gross deal value closed",
        },
      ]);
    } else if (presetType === "HR") {
      setFormItems([
        {
          title: "New Candidate Joinings",
          category: "HR",
          targetValue: 4,
          unit: "Hires",
          weightPercent: 40,
          notes: "Completed joins of offered candidates",
        },
        {
          title: "Candidate Screenings & Interviews",
          category: "HR",
          targetValue: 30,
          unit: "Interviews",
          weightPercent: 30,
          notes: "First-round screening calls and face-to-face interviews",
        },
        {
          title: "HR Operations & Compliance Sprints",
          category: "HR",
          targetValue: 10,
          unit: "Tasks",
          weightPercent: 20,
          notes: "Onboarding dossiers, policy updates, and employee queries",
        },
      ]);
    } else if (presetType === "IT") {
      setFormItems([
        {
          title: "Sprint Tasks & Feature Deliverables",
          category: "IT",
          targetValue: 10,
          unit: "Tasks",
          weightPercent: 40,
          notes: "Features and sprint stories merged to production",
        },
        {
          title: "Bug Resolution & Stability",
          category: "IT",
          targetValue: 15,
          unit: "Fixes",
          weightPercent: 30,
          notes: "High and medium priority defects resolved",
        },
        {
          title: "Code Reviews & Architecture Specs",
          category: "IT",
          targetValue: 6,
          unit: "Reviews",
          weightPercent: 20,
          notes: "PR reviews, database schema design, and technical docs",
        },
      ]);
    } else {
      setFormItems([
        {
          title: "Core Operational Deliverables",
          category: "OPERATIONS",
          targetValue: 20,
          unit: "Tasks",
          weightPercent: 50,
          notes: "Daily client and vendor operational tasks",
        },
        {
          title: "Quality & Compliance Audits",
          category: "OPERATIONS",
          targetValue: 8,
          unit: "Audits",
          weightPercent: 40,
          notes: "Internal quality and process audits completed",
        },
      ]);
    }
  }

  function openCreateModal() {
    resetForm();
    setShowCreateModal(true);
  }

  function openEditModal(target: any) {
    setSelectedTarget(target);
    setFormEmployeeId(target.employeeId);
    setFormTitle(target.title);
    setFormPeriodType(target.periodType as any);
    setFormMonth(target.month || currentMonth);
    setFormYear(target.year);
    setFormStartDate(new Date(target.startDate).toISOString().slice(0, 10));
    setFormEndDate(new Date(target.endDate).toISOString().slice(0, 10));
    setFormIncentiveAmount(String(target.incentiveAmount || 0));
    setFormIncentivePercent(String(target.incentivePercent || 0));
    setFormNotes(target.notes || "");
    setFormItems(
      (target.items || []).map((it: any) => ({
        id: it.id,
        title: it.title,
        category: it.category,
        targetValue: it.targetValue,
        unit: it.unit,
        weightPercent: it.weightPercent,
        notes: it.notes || "",
      }))
    );
    setFormError("");
    setShowEditModal(true);
  }

  function openSyncModal(target: any) {
    setSelectedTarget(target);
    const calculated =
      (target.incentiveAmount || 0) +
      ((target.incentivePercent || 0) / 100) * (target.currentRevenue || 0);
    setCustomBonusAmount(String(calculated));
    setSyncFeedback("");
    setFormError("");
    setShowSyncModal(true);
  }

  function handleCreateSubmit(e: FormEvent) {
    e.preventDefault();
    if (!formEmployeeId || !formTitle || !formStartDate || !formEndDate) {
      setFormError("Please fill in all required fields.");
      return;
    }
    if (formItems.length === 0) {
      setFormError("Please add at least one role target item.");
      return;
    }
    if (formTotalScorecardWeight !== 100) {
      setFormError(
        `Total scorecard weight must equal 100%. Current: ${formTotalItemsWeight}% (targets) + 10% (discipline) = ${formTotalScorecardWeight}%.`
      );
      return;
    }

    createMutation.mutate({
      employeeId: formEmployeeId,
      title: formTitle.trim(),
      periodType: formPeriodType,
      month: formPeriodType === "MONTHLY" ? formMonth : null,
      year: formYear,
      startDate: new Date(formStartDate),
      endDate: new Date(formEndDate),
      incentiveAmount: parseFloat(formIncentiveAmount) || 0,
      incentivePercent: parseFloat(formIncentivePercent) || 0,
      notes: formNotes.trim() || null,
      items: formItems.map((it) => ({
        title: it.title.trim(),
        category: it.category,
        targetValue: Number(it.targetValue),
        unit: it.unit.trim(),
        weightPercent: Number(it.weightPercent),
        notes: it.notes?.trim() || null,
      })),
    });
  }

  function handleEditSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedTarget) return;
    if (formTotalScorecardWeight !== 100) {
      setFormError(
        `Total scorecard weight must equal 100%. Current: ${formTotalItemsWeight}% (targets) + 10% (discipline) = ${formTotalScorecardWeight}%.`
      );
      return;
    }

    updateMutation.mutate({
      id: selectedTarget.id,
      title: formTitle.trim(),
      periodType: formPeriodType,
      month: formPeriodType === "MONTHLY" ? formMonth : null,
      year: formYear,
      startDate: new Date(formStartDate),
      endDate: new Date(formEndDate),
      incentiveAmount: parseFloat(formIncentiveAmount) || 0,
      incentivePercent: parseFloat(formIncentivePercent) || 0,
      notes: formNotes.trim() || null,
      items: formItems.map((it) => ({
        id: it.id,
        title: it.title.trim(),
        category: it.category,
        targetValue: Number(it.targetValue),
        unit: it.unit.trim(),
        weightPercent: Number(it.weightPercent),
        notes: it.notes?.trim() || null,
      })),
    });
  }

  function handleSyncPayrollSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedTarget) return;
    syncBonusMutation.mutate({
      targetId: selectedTarget.id,
      customBonusAmount: customBonusAmount ? parseFloat(customBonusAmount) : null,
    });
  }

  // Filtered Targets list
  const filteredTargets = useMemo(() => {
    let list = targetsData?.targets ?? [];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((t) => {
        const empName = `${t.employee.firstName} ${t.employee.lastName}`.toLowerCase();
        const empCode = (t.employee.employeeCode || "").toLowerCase();
        const title = t.title.toLowerCase();
        return empName.includes(q) || empCode.includes(q) || title.includes(q);
      });
    }
    return list;
  }, [targetsData?.targets, searchQuery]);

  // Active target for the currently selected employee
  const activeEmployeeTarget = useMemo(() => {
    if (!selectedEmployeeId) return filteredTargets[0] || null;
    return filteredTargets.find((t) => t.employeeId === selectedEmployeeId) || filteredTargets[0] || null;
  }, [filteredTargets, selectedEmployeeId]);

  // Keep dropdown selection synchronized with filtered list
  useEffect(() => {
    if (filteredTargets.length > 0) {
      if (!selectedEmployeeId || !filteredTargets.some((t) => t.employeeId === selectedEmployeeId)) {
        setSelectedEmployeeId(filteredTargets[0].employeeId);
      }
    } else if (selectedEmployeeId) {
      setSelectedEmployeeId("");
    }
  }, [filteredTargets, selectedEmployeeId]);

  // Lock background scrolling when any modal is open to prevent double scrollbars
  useEffect(() => {
    if (showCreateModal || showEditModal || showVerificationModal || showSyncModal) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [showCreateModal, showEditModal, showVerificationModal, showSyncModal]);

  const summary = targetsData?.summary ?? {
    totalTargetRevenue: 0,
    totalAchievedRevenue: 0,
    totalTargetVisits: 0,
    totalAchievedVisits: 0,
    totalTargetBookings: 0,
    totalAchievedBookings: 0,
    totalIncentivePaid: 0,
    avgScore: 0,
    totalAssigned: 0,
  };

  const pendingCount = pendingVerifications?.length ?? 0;

  // Team Performance Distribution for visual charts
  const distribution = useMemo(() => {
    let exceeding = 0;
    let onTrack = 0;
    let needsAttn = 0;
    filteredTargets.forEach((t) => {
      const score = t.scorecard?.totalScore ?? 0;
      if (score >= 80) exceeding++;
      else if (score >= 50) onTrack++;
      else needsAttn++;
    });
    const total = filteredTargets.length || 1;
    return {
      exceeding,
      onTrack,
      needsAttn,
      total: filteredTargets.length,
      exceedingPct: Math.round((exceeding / total) * 100),
      onTrackPct: Math.round((onTrack / total) * 100),
      needsAttnPct: Math.round((needsAttn / total) * 100),
    };
  }, [filteredTargets]);

  return (
    <div className="mx-auto max-w-7xl space-y-4 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight">
              Performance & Target Management
            </h1>
            {targetsLoading && (
              <span className="flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-bold text-[#0284C7] border border-sky-200/60">
                <Loader2 className="h-3 w-3 animate-spin" />
                Updating...
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-500 mt-0.5">
            100% Scorecard · 10% Attendance Discipline + 90% Role Targets & Revenue
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowVerificationModal(true)}
            className="rounded-xl text-xs font-semibold gap-1.5 border-neutral-300 hover:border-sky-300 hover:bg-sky-50/50"
          >
            <FileCheck2 className="h-4 w-4 text-[#0284C7]" />
            Verifications
            {pendingCount > 0 && (
              <span className="ml-1 rounded-full bg-rose-600 px-1.5 py-0.2 text-[10px] font-bold text-white">
                {pendingCount}
              </span>
            )}
          </Button>

          <Button
            size="sm"
            onClick={openCreateModal}
            className="bg-[#0284C7] hover:bg-[#0369A1] text-white rounded-xl text-xs font-bold gap-1.5 shadow-xs transition-colors"
          >
            <Plus className="h-4 w-4" />
            Assign Target
          </Button>
        </div>
      </div>

      {/* Clean Metric Stats Strip (Light Blue Accents) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-sky-100 bg-white p-3.5 shadow-2xs hover:border-sky-200 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">
              Target Sheets
            </span>
            <Target className="h-4 w-4 text-sky-500" />
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-bold text-neutral-900">{summary.totalAssigned}</span>
            <span className="text-xs text-neutral-400 font-medium">Assigned</span>
          </div>
        </div>

        <div className="rounded-xl border border-sky-100 bg-white p-3.5 shadow-2xs hover:border-sky-200 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">
              Average Score
            </span>
            <TrendingUp className="h-4 w-4 text-[#0284C7]" />
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-bold text-[#0284C7]">{summary.avgScore}%</span>
            <span className="text-xs text-neutral-400 font-medium">/ 100%</span>
          </div>
        </div>

        <div className="rounded-xl border border-sky-100 bg-white p-3.5 shadow-2xs hover:border-sky-200 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">
              Pending Queue
            </span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-bold text-amber-600">{pendingCount}</span>
            <span className="text-xs text-neutral-400 font-medium">Submissions</span>
          </div>
        </div>

        <div className="rounded-xl border border-sky-100 bg-white p-3.5 shadow-2xs hover:border-sky-200 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">
              Achieved Revenue
            </span>
            <Banknote className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-bold text-emerald-600">
              {formatCurrency(summary.totalAchievedRevenue)}
            </span>
          </div>
        </div>
      </div>

      {/* Unified Filters & Employee Selector Bar */}
      <Card className="rounded-2xl border-sky-100 bg-white p-3.5 shadow-xs">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5">
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-400" />
            <Input
              placeholder="Search employee..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9 rounded-xl border-neutral-200 text-xs focus:border-[#0284C7]"
            />
          </div>

          {/* Filters & Dropdown Selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
              className="h-9 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-700 outline-none"
            >
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>

            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="h-9 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-700 outline-none"
            >
              <option value="ALL">All Months</option>
              {MONTHS.map((m, idx) => (
                <option key={m} value={String(idx + 1)}>
                  {m}
                </option>
              ))}
            </select>

            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="h-9 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-700 outline-none"
            >
              <option value="ALL">All Departments</option>
              {(departmentsData ?? []).map((d: any) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>

            <select
              value={activeEmployeeTarget?.employeeId || ""}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="h-9 rounded-xl border border-sky-300 bg-sky-50/70 px-3.5 text-xs font-bold text-sky-950 outline-none min-w-[240px] max-w-[320px] truncate shadow-2xs focus:border-[#0284C7]"
            >
              {filteredTargets.length === 0 ? (
                <option value="">No targets found</option>
              ) : (
                filteredTargets.map((t) => (
                  <option key={t.employeeId} value={t.employeeId}>
                    {t.employee.firstName} {t.employee.lastName} ({t.employee.employeeCode || "RS"}) - {t.scorecard.totalScore}%
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
      </Card>

      {/* MAIN SECTION: SINGLE SELECTED EMPLOYEE SCORECARD */}
      <div className="space-y-4">
        {targetsLoading ? (
          <Card className="p-12 text-center rounded-2xl bg-white border border-sky-100 shadow-xs space-y-3">
            <Loader2 className="h-8 w-8 text-[#0284C7] animate-spin mx-auto" />
            <p className="text-xs font-semibold text-neutral-600">Loading scorecard...</p>
          </Card>
        ) : activeEmployeeTarget ? (
          <div className="space-y-4">
            {/* Scorecard Hero Banner in Light Blue */}
            <Card className="rounded-2xl border-sky-100 bg-white p-6 shadow-xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                {/* Employee Info */}
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#0284C7] to-[#38BDF8] text-white font-extrabold text-lg shadow-sm">
                    {activeEmployeeTarget.employee.firstName.charAt(0)}
                    {activeEmployeeTarget.employee.lastName.charAt(0)}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-bold text-neutral-900">
                        {activeEmployeeTarget.employee.firstName} {activeEmployeeTarget.employee.lastName}
                      </h3>
                      <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-semibold text-neutral-600">
                        {activeEmployeeTarget.employee.employeeCode || "RS"}
                      </span>
                      <span className="rounded-full bg-sky-50 text-[#0284C7] border border-sky-200/60 px-2.5 py-0.5 text-[11px] font-bold">
                        {activeEmployeeTarget.employee.department?.name || "General"}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500">
                      Target Period: <strong className="text-neutral-800">{activeEmployeeTarget.title}</strong> (
                      {formatDate(activeEmployeeTarget.startDate)} to {formatDate(activeEmployeeTarget.endDate)})
                    </p>
                    {activeEmployeeTarget.notes && (
                      <p className="text-[11px] text-neutral-400 italic">
                        "{activeEmployeeTarget.notes}"
                      </p>
                    )}
                  </div>
                </div>

                {/* Score Dial & Actions */}
                <div className="flex items-center gap-6 justify-between md:justify-end border-t md:border-t-0 pt-4 md:pt-0 border-neutral-100">
                  <div className="text-center">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">
                      Total Performance Index
                    </span>
                    <div className="flex items-baseline justify-center gap-1 mt-0.5">
                      <span className="text-3xl font-black text-sky-950">
                        {activeEmployeeTarget.scorecard.totalScore}%
                      </span>
                      <span className="text-xs font-semibold text-neutral-400">/ 100%</span>
                    </div>
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase mt-1 ${
                        activeEmployeeTarget.scorecard.totalScore >= 80
                          ? "bg-sky-100 text-[#0369A1] border border-sky-300"
                          : activeEmployeeTarget.scorecard.totalScore >= 50
                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                          : "bg-amber-50 text-amber-800 border border-amber-200"
                      }`}
                    >
                      {activeEmployeeTarget.scorecard.totalScore >= 80
                        ? "Exceeding Target"
                        : activeEmployeeTarget.scorecard.totalScore >= 50
                        ? "On Track"
                        : "Needs Attention"}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => openSyncModal(activeEmployeeTarget)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl h-8 gap-1.5 shadow-xs"
                    >
                      <Banknote className="h-3.5 w-3.5" />
                      Sync to Payroll
                    </Button>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditModal(activeEmployeeTarget)}
                        className="text-xs rounded-xl h-8 px-2.5 text-neutral-700 hover:border-sky-300 hover:bg-sky-50/50"
                        title="Edit Target Sheet"
                      >
                        <Edit2 className="h-3.5 w-3.5 mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (confirm("Delete this target sheet completely?")) {
                            deleteMutation.mutate({ id: activeEmployeeTarget.id });
                          }
                        }}
                        className="text-xs rounded-xl h-8 px-2 text-rose-600 hover:bg-rose-50"
                        title="Delete Target Sheet"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Visual Split Bar: Discipline (10%) + Role KPIs (90%) */}
              <div className="mt-5 pt-4 border-t border-neutral-100 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-neutral-600">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#38BDF8] inline-block" />
                    Discipline (Attendance & Punctuality):{" "}
                    <strong className="text-sky-800">{activeEmployeeTarget.discipline.score}% / 10%</strong>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#0284C7] inline-block" />
                    Role KPI Deliverables:{" "}
                    <strong className="text-[#0284C7]">
                      {activeEmployeeTarget.scorecard.performanceScore}% / 90%
                    </strong>
                  </span>
                </div>

                <div className="h-3 w-full rounded-full bg-sky-50 flex overflow-hidden p-0.5 border border-sky-100">
                  {/* Discipline portion (max 10%) */}
                  <div
                    className="h-full rounded-l-full bg-[#38BDF8] transition-all duration-300"
                    style={{ width: `${activeEmployeeTarget.discipline.score}%` }}
                    title={`Discipline Score: ${activeEmployeeTarget.discipline.score}% / 10%`}
                  />
                  {/* Performance portion (max 90%) */}
                  <div
                    className="h-full rounded-r-full bg-[#0284C7] transition-all duration-300"
                    style={{
                      width: `${Math.min(90, activeEmployeeTarget.scorecard.performanceScore)}%`,
                    }}
                    title={`Role Targets Score: ${activeEmployeeTarget.scorecard.performanceScore}% / 90%`}
                  />
                </div>
              </div>
            </Card>

            {/* VISUAL ANALYTICS & CHARTS SUITE (LIGHT BLUE THEME) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Chart 1: Circular Scorecard Performance Radial Gauge (5 cols) */}
              <Card className="lg:col-span-5 rounded-2xl border-sky-100 bg-gradient-to-br from-sky-50/50 via-white to-white p-5 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between border-b border-sky-100/80 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-sky-100 text-[#0284C7]">
                      <Activity className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-neutral-900">Scorecard Radial Gauge</h4>
                      <p className="text-[10px] text-neutral-400">100% Pro-Rata Target Index</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-[#0284C7] bg-sky-100 px-2 py-0.5 rounded-md">
                    Live Gauge
                  </span>
                </div>

                {/* SVG Gauge Graphic */}
                <div className="py-3 flex flex-col items-center justify-center">
                  <div className="relative flex h-44 w-44 items-center justify-center">
                    <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
                      {/* Background Track 1 (Discipline Outer) */}
                      <circle
                        cx="80"
                        cy="80"
                        r="62"
                        fill="none"
                        stroke="#E0F2FE"
                        strokeWidth="10"
                      />
                      {/* Discipline Arc (10% max) */}
                      <circle
                        cx="80"
                        cy="80"
                        r="62"
                        fill="none"
                        stroke="#38BDF8"
                        strokeWidth="10"
                        strokeDasharray={`${(Math.min(10, activeEmployeeTarget.discipline.score) / 100) * (2 * Math.PI * 62)} ${2 * Math.PI * 62}`}
                        strokeDashoffset="0"
                        strokeLinecap="round"
                        className="transition-all duration-700 ease-out"
                      />

                      {/* Background Track 2 (Role KPI Inner) */}
                      <circle
                        cx="80"
                        cy="80"
                        r="48"
                        fill="none"
                        stroke="#F0F9FF"
                        strokeWidth="10"
                      />
                      {/* Role KPI Arc (90% max) */}
                      <circle
                        cx="80"
                        cy="80"
                        r="48"
                        fill="none"
                        stroke="#0284C7"
                        strokeWidth="10"
                        strokeDasharray={`${(Math.min(90, activeEmployeeTarget.scorecard.performanceScore) / 100) * (2 * Math.PI * 48)} ${2 * Math.PI * 48}`}
                        strokeDashoffset="0"
                        strokeLinecap="round"
                        className="transition-all duration-700 ease-out"
                      />
                    </svg>

                    {/* Center Score Display */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                      <span className="text-3xl font-black text-sky-950 tracking-tight">
                        {activeEmployeeTarget.scorecard.totalScore}%
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 mt-0.5">
                        Total Score
                      </span>
                    </div>
                  </div>

                  {/* Legend Beneath Gauge */}
                  <div className="grid grid-cols-2 gap-2 w-full mt-2 pt-3 border-t border-sky-100/80">
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-sky-50/70 border border-sky-100">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#38BDF8] shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[10px] text-neutral-500 font-semibold block truncate">Discipline (10%)</span>
                        <strong className="text-xs font-bold text-sky-900">{activeEmployeeTarget.discipline.score}%</strong>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-blue-50/60 border border-blue-100">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#0284C7] shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[10px] text-neutral-500 font-semibold block truncate">Role KPIs (90%)</span>
                        <strong className="text-xs font-bold text-blue-900">{activeEmployeeTarget.scorecard.performanceScore}%</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Chart 2: KPI Target vs. Achieved Horizontal Bar Chart (7 cols) */}
              <Card className="lg:col-span-7 rounded-2xl border-sky-100 bg-white p-5 shadow-xs space-y-3 flex flex-col justify-between">
                <div className="flex items-center justify-between border-b border-sky-100/80 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-sky-100 text-[#0284C7]">
                      <BarChart2 className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-neutral-900">Target vs. Achieved Deliverables</h4>
                      <p className="text-[10px] text-neutral-400">Progress against assigned milestone targets</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-[#0284C7] bg-sky-100 px-2 py-0.5 rounded-md">
                    Deliverables Bar Chart
                  </span>
                </div>

                {/* Deliverables Bars List */}
                <div className="space-y-3 flex-1 overflow-y-auto max-h-[220px] pr-1">
                  {/* Mandatory Attendance Discipline Row */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-neutral-800 flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-sky-600" />
                        Attendance Discipline
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-500 font-medium">
                          {activeEmployeeTarget.discipline.earnedCredits} / {activeEmployeeTarget.discipline.expectedWorkingDays} Days
                        </span>
                        <span className="font-extrabold text-[#0284C7] bg-sky-100 px-1.5 py-0.2 rounded text-[10px]">
                          {activeEmployeeTarget.discipline.score}% / 10%
                        </span>
                      </div>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-sky-100/70 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#38BDF8] transition-all duration-500"
                        style={{ width: `${Math.min(100, (activeEmployeeTarget.discipline.score / 10) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Individual Role KPI Deliverables */}
                  {(activeEmployeeTarget.items || []).map((it: any) => {
                    const completionPct = Math.min(100, it.itemCompletionRate || 0);
                    return (
                      <div key={it.id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-neutral-800 flex items-center gap-1.5 truncate max-w-[200px]">
                            <Target className="h-3.5 w-3.5 text-[#0284C7]" />
                            {it.title}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-neutral-500 font-medium">
                              {it.unit === "INR" ? formatCurrency(it.achievedValue) : `${it.achievedValue} ${it.unit}`} / {it.unit === "INR" ? formatCurrency(it.targetValue) : `${it.targetValue} ${it.unit}`}
                            </span>
                            <span className="font-extrabold text-[#0284C7] bg-sky-100 px-1.5 py-0.2 rounded text-[10px]">
                              {completionPct}% ({it.earnedScore}% / {it.weightPercent}%)
                            </span>
                          </div>
                        </div>
                        <div className="h-2.5 w-full rounded-full bg-sky-100/70 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-sky-400 to-[#0284C7] transition-all duration-500"
                            style={{ width: `${completionPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footnote */}
                <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-400">
                  <span>Every verified deliverable updates pro-rata index in real time</span>
                  <span className="font-bold text-[#0284C7]">Role Target: {activeEmployeeTarget.scorecard.performanceScore}% / 90%</span>
                </div>
              </Card>
            </div>

            {/* Chart 3: Team Scorecard Distribution Graph (Horizontal Multi-Segment Bar) */}
            <Card className="rounded-2xl border-sky-100 bg-white p-4 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-sky-100 text-[#0284C7]">
                    <PieChart className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-neutral-900">
                      Team Target Performance Distribution ({distribution.total} Employees)
                    </h4>
                    <p className="text-[10px] text-neutral-400">Company-wide achievement tiers for active period</p>
                  </div>
                </div>
                <span className="text-xs font-extrabold text-sky-800 bg-sky-50 border border-sky-200 px-2.5 py-1 rounded-lg">
                  Avg Score: {summary.avgScore}%
                </span>
              </div>

              {/* Segmented Distribution Bar */}
              <div className="h-3 w-full rounded-full bg-neutral-100 flex overflow-hidden p-0.5 gap-0.5">
                <div
                  className="h-full rounded-l-full bg-[#0284C7] transition-all duration-500"
                  style={{ width: `${Math.max(distribution.exceedingPct, distribution.exceeding > 0 ? 5 : 0)}%` }}
                  title={`High Achievers (≥80%): ${distribution.exceeding} (${distribution.exceedingPct}%)`}
                />
                <div
                  className="h-full bg-[#38BDF8] transition-all duration-500"
                  style={{ width: `${Math.max(distribution.onTrackPct, distribution.onTrack > 0 ? 5 : 0)}%` }}
                  title={`On Track (50-79%): ${distribution.onTrack} (${distribution.onTrackPct}%)`}
                />
                <div
                  className="h-full rounded-r-full bg-[#BAE6FD] transition-all duration-500"
                  style={{ width: `${Math.max(distribution.needsAttnPct, distribution.needsAttn > 0 ? 5 : 0)}%` }}
                  title={`Needs Attention (<50%): ${distribution.needsAttn} (${distribution.needsAttnPct}%)`}
                />
              </div>

              {/* Distribution Legend */}
              <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-600 flex-wrap gap-2 pt-1">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#0284C7]" />
                  Exceeding Target (≥80%): <strong className="text-sky-900">{distribution.exceeding} ({distribution.exceedingPct}%)</strong>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#38BDF8]" />
                  On Track (50-79%): <strong className="text-sky-800">{distribution.onTrack} ({distribution.onTrackPct}%)</strong>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#BAE6FD]" />
                  Needs Attention (&lt;50%): <strong className="text-neutral-700">{distribution.needsAttn} ({distribution.needsAttnPct}%)</strong>
                </span>
              </div>
            </Card>

            {/* THE REQUIRED SCORECARD BREAKDOWN TABLE */}
            <Card className="rounded-2xl border-neutral-200/80 bg-white shadow-xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-neutral-100 flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <h3 className="font-bold text-neutral-900 text-sm">
                    Scorecard Breakdown
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-neutral-500">
                    Total Weight: <strong className="text-neutral-900">{activeEmployeeTarget.scorecard.totalWeight}%</strong>
                  </span>
                </div>
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
                    {/* ROW 1: MANDATORY DISCIPLINE (ATTENDANCE & PUNCTUALITY) - 10% FIXED */}
                    <tr className="bg-teal-50/30 hover:bg-teal-50/50 transition-colors">
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
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-neutral-800">
                          {activeEmployeeTarget.discipline.expectedWorkingDays} Days
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <strong className="text-teal-900 font-bold block">
                            {activeEmployeeTarget.discipline.earnedCredits} / {activeEmployeeTarget.discipline.expectedWorkingDays} Days
                          </strong>
                          <div className="text-[10px] text-neutral-500 flex items-center gap-1.5 flex-wrap">
                            <span className="text-emerald-700 font-semibold">{activeEmployeeTarget.discipline.onTimeDays} On-time</span>
                            {activeEmployeeTarget.discipline.lateDays > 0 && (
                              <>
                                <span>•</span>
                                <span className="text-amber-700 font-semibold">{activeEmployeeTarget.discipline.lateDays} Late</span>
                              </>
                            )}
                            {activeEmployeeTarget.discipline.halfDays > 0 && (
                              <>
                                <span>•</span>
                                <span className="text-amber-800 font-semibold">{activeEmployeeTarget.discipline.halfDays} Half-day</span>
                              </>
                            )}
                            {activeEmployeeTarget.discipline.paidLeaveDays > 0 && (
                              <>
                                <span>•</span>
                                <span className="text-teal-700 font-semibold">{activeEmployeeTarget.discipline.paidLeaveDays} Paid Leave</span>
                              </>
                            )}
                            {activeEmployeeTarget.discipline.unpaidLeaveDays > 0 && (
                              <>
                                <span>•</span>
                                <span className="text-rose-600 font-semibold">{activeEmployeeTarget.discipline.unpaidLeaveDays} LWP</span>
                              </>
                            )}
                            {activeEmployeeTarget.discipline.holidayCount > 0 && (
                              <>
                                <span>•</span>
                                <span className="text-sky-700 font-semibold">{activeEmployeeTarget.discipline.holidayCount} Holidays</span>
                              </>
                            )}
                            {activeEmployeeTarget.discipline.absentDays > 0 && (
                              <>
                                <span>•</span>
                                <span className="text-rose-700 font-semibold">{activeEmployeeTarget.discipline.absentDays} Absent</span>
                              </>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <span className="font-extrabold text-neutral-900 bg-neutral-100 px-2 py-1 rounded-lg">
                          10.0%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-black text-sm text-teal-800 bg-teal-100/70 px-2.5 py-1 rounded-lg">
                          {activeEmployeeTarget.discipline.score}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="w-24 mx-auto space-y-1">
                          <div className="h-2 w-full rounded-full bg-neutral-200 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-teal-500 transition-all duration-300"
                              style={{
                                width: `${Math.min(100, (activeEmployeeTarget.discipline.score / 10) * 100)}%`,
                              }}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-teal-700 block text-center">
                            {Math.round((activeEmployeeTarget.discipline.score / 10) * 100)}%
                          </span>
                        </div>
                      </td>
                    </tr>

                    {/* ROLE KPI ITEMS (e.g. Sales, HR, IT, Operations) */}
                    {(activeEmployeeTarget.items || []).map((item: any) => {
                      const isSales = item.category === "SALES";
                      const isHR = item.category === "HR";
                      const isIT = item.category === "IT";

                      return (
                        <tr key={item.id} className="hover:bg-sky-50/30 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <div
                                className={`p-1.5 rounded-lg ${
                                  isHR
                                    ? "bg-sky-100 text-[#0284C7]"
                                    : isIT
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-emerald-100 text-emerald-800"
                                }`}
                              >
                                {isHR ? (
                                  <Briefcase className="h-4 w-4" />
                                ) : isIT ? (
                                  <Code2 className="h-4 w-4" />
                                ) : (
                                  <Target className="h-4 w-4" />
                                )}
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
                            <span
                              className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold ${
                                isHR
                                  ? "bg-sky-100 text-[#0284C7]"
                                  : isIT
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-emerald-100 text-emerald-800"
                              }`}
                            >
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
                            <p className="text-[10px] text-neutral-400">
                              Confirmed verified count
                            </p>
                          </td>
                          <td className="py-3.5 px-3 text-center">
                            <span className="font-extrabold text-neutral-900 bg-neutral-100 px-2 py-1 rounded-lg">
                              {item.weightPercent}%
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className="font-black text-sm text-[#0284C7] bg-sky-50 px-2.5 py-1 rounded-lg">
                              {item.earnedScore}%
                            </span>
                            <span className="block text-[9px] text-neutral-400 mt-0.5">
                              pro-rata achieved
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="w-24 mx-auto space-y-1">
                              <div className="h-2 w-full rounded-full bg-neutral-200 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-[#0284C7] transition-all duration-300"
                                  style={{
                                    width: `${Math.min(100, item.itemCompletionRate || 0)}%`,
                                  }}
                                />
                              </div>
                              <span className="text-[10px] font-bold text-[#0284C7] block text-center">
                                {item.itemCompletionRate || 0}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {/* TOTAL SUMMARY ROW */}
                    <tr className="bg-neutral-100/80 font-black border-t-2 border-neutral-300">
                      <td className="py-3.5 px-4 text-neutral-900 uppercase tracking-wider">
                        Total Performance Index
                      </td>
                      <td className="py-3.5 px-3 text-neutral-500">Overall</td>
                      <td className="py-3.5 px-4 text-neutral-700">100% Target</td>
                      <td className="py-3.5 px-4 text-neutral-700">All Deliverables</td>
                      <td className="py-3.5 px-3 text-center text-neutral-900 text-sm">
                        {activeEmployeeTarget.scorecard.totalWeight}%
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-black text-base text-emerald-700 bg-emerald-100 px-3 py-1 rounded-lg">
                          {activeEmployeeTarget.scorecard.totalScore}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center text-xs text-neutral-700 font-bold">
                        {activeEmployeeTarget.scorecard.totalScore >= 80 ? "Qualified" : "In Progress"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>

            {/* LOGGED ACTIVITY & SUBMISSIONS FOR THIS TARGET */}
            <Card className="rounded-2xl border-neutral-200/80 bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[#0284C7]" />
                  <h4 className="font-bold text-neutral-900 text-sm">
                    Logged Deliverables & Verification Trail ({activeEmployeeTarget.activities?.length || 0})
                  </h4>
                </div>
                <span className="text-xs text-neutral-400">
                  Site visits, deal bookings, candidate joinings, and sprint tasks
                </span>
              </div>

              {(!activeEmployeeTarget.activities || activeEmployeeTarget.activities.length === 0) ? (
                <div className="p-8 text-center text-xs text-neutral-400 bg-neutral-50 rounded-xl">
                  No activities or deliverable completion entries have been submitted yet for this target.
                </div>
              ) : (
                <div className="space-y-3">
                  {activeEmployeeTarget.activities.map((act: any) => (
                    <div
                      key={act.id}
                      className="flex items-start justify-between p-3.5 rounded-xl border border-neutral-200 bg-neutral-50/50 hover:bg-white transition-all gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold ${
                              act.status === "APPROVED"
                                ? "bg-emerald-100 text-emerald-800"
                                : act.status === "PENDING"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {act.status}
                          </span>
                          <span className="rounded-md bg-blue-100 text-blue-800 px-2 py-0.5 text-[10px] font-extrabold">
                            {act.activityType}
                          </span>
                          <h5 className="font-bold text-neutral-900 text-sm">
                            {act.title || act.projectName || "Activity Deliverable"}
                          </h5>
                          {act.quantity > 1 && (
                            <span className="text-xs text-neutral-600 font-semibold">
                              (Qty: {act.quantity})
                            </span>
                          )}
                          {act.targetItem && (
                            <span className="text-xs text-[#0284C7] font-semibold">
                              • Linked: {act.targetItem.title}
                            </span>
                          )}
                        </div>

                        {act.clientName && (
                          <p className="text-xs text-neutral-600">
                            Client / Contact: <strong className="text-neutral-900">{act.clientName}</strong>
                            {act.clientPhone && <span> • Ph: {act.clientPhone}</span>}
                          </p>
                        )}

                        {act.notes && (
                          <p className="text-[11px] text-neutral-500 italic">
                            "{act.notes}"
                          </p>
                        )}

                        <p className="text-[10px] text-neutral-400">
                          Date: {formatDate(act.activityDate)}
                        </p>
                      </div>

                      <div className="text-right shrink-0 space-y-1">
                        {act.revenueAmount > 0 && (
                          <span className="text-sm font-extrabold text-emerald-700 block">
                            {formatCurrency(act.revenueAmount)}
                          </span>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (confirm("Remove this deliverable entry?")) {
                              deleteActivityMutation.mutate({ id: act.id });
                            }
                          }}
                          className="h-7 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 px-2"
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        ) : (
          <Card className="p-12 text-center rounded-2xl bg-white border border-neutral-200">
            <Target className="h-10 w-10 text-neutral-300 mx-auto mb-2" />
            <h3 className="font-bold text-neutral-800 text-sm">No Target Assigned</h3>
            <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
              No target sheets have been assigned for this period. Click "Assign Weighted Target" above to assign an employee their 100% scorecard.
            </p>
          </Card>
        )}
      </div>

      {/* VERIFICATION QUEUE MODAL (ADMIN APPROVALS) */}
      {showVerificationModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6 backdrop-blur-xs"
          onClick={() => setShowVerificationModal(false)}
        >
          <div
            className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="shrink-0 flex items-center justify-between border-b border-neutral-100 p-4 sm:p-5 bg-white">
              <div className="flex items-center gap-2">
                <FileCheck2 className="h-5 w-5 text-[#0284C7]" />
                <h3 className="font-bold text-neutral-900 text-base">
                  Target Deliverables Verification Queue ({pendingCount})
                </h3>
              </div>
              <button
                onClick={() => setShowVerificationModal(false)}
                className="text-neutral-400 hover:text-neutral-600 rounded-lg p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              <p className="text-xs text-neutral-500">
                When you verify a submission, the employee's achieved target increases and their pro-rata percentage updates immediately.
              </p>

              {pendingCount === 0 ? (
                <div className="p-12 text-center text-xs text-neutral-400 bg-neutral-50 rounded-xl space-y-2">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
                  <h4 className="font-bold text-neutral-800">All Caught Up!</h4>
                  <p>No employee activity submissions are currently pending verification.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingVerifications?.map((sub: any) => (
                    <div
                      key={sub.id}
                      className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/50 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-neutral-900">
                              {sub.employee.firstName} {sub.employee.lastName}
                            </span>
                            <span className="rounded-md bg-sky-50 text-[#0284C7] px-2 py-0.5 text-[10px] font-bold">
                              {sub.employee.department?.name || "General"}
                            </span>
                            <span className="rounded-md bg-blue-100 text-blue-800 px-2 py-0.5 text-[10px] font-extrabold">
                              {sub.activityType}
                            </span>
                          </div>
                          <h5 className="font-bold text-neutral-800 text-xs mt-1">
                            {sub.title || sub.projectName || "Deliverable Completion"}
                          </h5>
                          <p className="text-xs text-neutral-600 mt-0.5">
                            Target Item: <strong className="text-[#0284C7]">{sub.targetItem?.title || "Role Target"}</strong>
                            {" • "}Qty Claimed: <strong>{sub.quantity} {sub.targetItem?.unit || "Units"}</strong>
                          </p>
                          {sub.clientName && (
                            <p className="text-xs text-neutral-500">
                              Client/Candidate: {sub.clientName} {sub.clientPhone && `(${sub.clientPhone})`}
                            </p>
                          )}
                          {sub.notes && (
                            <p className="text-[11px] text-neutral-500 italic mt-1">
                              "{sub.notes}"
                            </p>
                          )}
                          <p className="text-[10px] text-neutral-400 mt-1">
                            Date: {formatDate(sub.activityDate)}
                          </p>
                        </div>

                        {sub.revenueAmount > 0 && (
                          <div className="text-right">
                            <span className="text-xs text-neutral-400 block">Deal Revenue</span>
                            <span className="font-black text-emerald-700 text-sm">
                              {formatCurrency(sub.revenueAmount)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Action Bar */}
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200/60">
                        {rejectingActivityId === sub.id ? (
                          <div className="flex items-center gap-2 w-full">
                            <Input
                              placeholder="Reason for rejecting this deliverable..."
                              value={rejectionReasonInput}
                              onChange={(e) => setRejectionReasonInput(e.target.value)}
                              className="rounded-xl text-xs h-8 flex-1"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setRejectingActivityId(null)}
                              className="h-8 text-xs rounded-xl"
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              disabled={verifyActivityMutation.isPending}
                              onClick={() =>
                                verifyActivityMutation.mutate({
                                  activityId: sub.id,
                                  action: "REJECT",
                                  rejectionReason: rejectionReasonInput,
                                })
                              }
                              className="h-8 text-xs rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold"
                            >
                              {verifyActivityMutation.isPending ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                                  Rejecting...
                                </>
                              ) : (
                                "Confirm Reject"
                              )}
                            </Button>
                          </div>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setRejectingActivityId(sub.id)}
                              className="h-8 text-xs rounded-xl text-rose-600 border-rose-200 hover:bg-rose-50 font-bold"
                            >
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              disabled={verifyActivityMutation.isPending}
                              onClick={() =>
                                verifyActivityMutation.mutate({
                                  activityId: sub.id,
                                  action: "APPROVE",
                                })
                              }
                              className="h-8 text-xs rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4"
                            >
                              {verifyActivityMutation.isPending ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                                  Approving...
                                </>
                              ) : (
                                "Approve Deliverable"
                              )}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="shrink-0 flex justify-end p-4 border-t border-neutral-100 bg-neutral-50/70">
              <Button
                variant="outline"
                onClick={() => setShowVerificationModal(false)}
                className="rounded-xl text-xs font-bold"
              >
                Close Queue
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE WEIGHTED TARGET MODAL */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6 backdrop-blur-xs"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="shrink-0 flex items-center justify-between border-b border-neutral-100 p-4 sm:p-5 bg-white">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-[#0284C7]" />
                <h3 className="font-bold text-neutral-900 text-base">
                  Assign 100% Weighted Scorecard Target
                </h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-neutral-400 hover:text-neutral-600 rounded-lg p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                {formError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-semibold">
                    {formError}
                  </div>
                )}

              {/* Employee Selection */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-neutral-700">Select Employee *</Label>
                <select
                  value={formEmployeeId}
                  onChange={(e) => {
                    const empId = e.target.value;
                    setFormEmployeeId(empId);
                    const emp = (employeesData?.items ?? []).find((em: any) => em.id === empId);
                    if (emp?.department?.name) {
                      const dName = emp.department.name.toLowerCase();
                      if (dName.includes("hr") || dName.includes("human")) applyPreset("HR");
                      else if (dName.includes("it") || dName.includes("tech") || dName.includes("develop")) applyPreset("IT");
                      else applyPreset("SALES");
                    }
                  }}
                  required
                  className="w-full max-w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-neutral-800 outline-none truncate"
                >
                  <option value="">-- Choose Employee --</option>
                  {(employeesData?.items ?? []).map((emp: any) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} ({emp.employeeCode || "RS"}) - {emp.department?.name || "General"}
                    </option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-neutral-700">Target Sheet Title *</Label>
                <Input
                  placeholder="e.g. November 2026 Monthly Performance Scorecard"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  required
                  className="rounded-xl border-neutral-200 text-xs"
                />
              </div>

              {/* Month, Year & Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-neutral-700">Month</Label>
                  <select
                    value={formMonth}
                    onChange={(e) => setFormMonth(parseInt(e.target.value, 10))}
                    className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 outline-none"
                  >
                    {MONTHS.map((m, idx) => (
                      <option key={m} value={idx + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-neutral-700">Year</Label>
                  <select
                    value={formYear}
                    onChange={(e) => setFormYear(parseInt(e.target.value, 10))}
                    className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 outline-none"
                  >
                    {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-neutral-700">Start Date *</Label>
                  <Input
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    required
                    className="rounded-xl border-neutral-200 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-neutral-700">End Date *</Label>
                  <Input
                    type="date"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    required
                    className="rounded-xl border-neutral-200 text-xs"
                  />
                </div>
              </div>

              {/* PRESETS BUTTONS */}
              <div className="flex items-center gap-2 pt-2">
                <span className="text-xs font-bold text-neutral-500">Quick Presets:</span>
                <button
                  type="button"
                  onClick={() => applyPreset("SALES")}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                >
                  Sales Team
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("HR")}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-50 text-[#0284C7] border border-sky-200 hover:bg-sky-100"
                >
                  HR & Talent
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("IT")}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                >
                  IT & Development
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("OPERATIONS")}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
                >
                  Operations
                </button>
              </div>

              {/* DYNAMIC TARGET ITEMS WITH WEIGHTAGE */}
              <div className="rounded-xl border border-neutral-200 p-4 bg-neutral-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-800">
                      Configured Role KPI Items (Sum + 10% Discipline = 100%)
                    </h4>
                    <p className="text-[11px] text-neutral-400">
                      Discipline attendance is locked at 10%. The items below must total 90%.
                    </p>
                  </div>
                  <div
                    className={`px-3 py-1 rounded-full text-xs font-black ${
                      formTotalScorecardWeight === 100
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    Total Weight: {formTotalScorecardWeight}% / 100%
                  </div>
                </div>

                {/* 10% Discipline Notice */}
                <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2 text-teal-800 font-bold">
                    <Clock className="h-4 w-4" />
                    <span>Discipline (Attendance & Punctuality): Automatically calculated</span>
                  </div>
                  <span className="font-extrabold text-teal-900 bg-teal-100 px-2 py-0.5 rounded-md">
                    10% Weight
                  </span>
                </div>

                {/* List of items */}
                <div className="space-y-3">
                  {formItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-white border border-neutral-200 space-y-2 shadow-2xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-neutral-700">KPI Item #{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => setFormItems(formItems.filter((_, i) => i !== idx))}
                          className="text-neutral-400 hover:text-rose-600 text-xs"
                          title="Remove KPI item"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                        <div className="sm:col-span-5">
                          <Label className="text-[10px] text-neutral-500 font-semibold">Title</Label>
                          <Input
                            placeholder="e.g. Site Visits, Joinings, Tasks"
                            value={item.title}
                            onChange={(e) => {
                              const updated = [...formItems];
                              updated[idx].title = e.target.value;
                              setFormItems(updated);
                            }}
                            required
                            className="h-8 text-xs rounded-lg"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <Label className="text-[10px] text-neutral-500 font-semibold">Target Goal</Label>
                          <Input
                            type="number"
                            min="1"
                            value={item.targetValue}
                            onChange={(e) => {
                              const updated = [...formItems];
                              updated[idx].targetValue = parseFloat(e.target.value) || 0;
                              setFormItems(updated);
                            }}
                            required
                            className="h-8 text-xs rounded-lg font-bold"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <Label className="text-[10px] text-neutral-500 font-semibold">Unit</Label>
                          <Input
                            placeholder="Visits, Hires, Tasks"
                            value={item.unit}
                            onChange={(e) => {
                              const updated = [...formItems];
                              updated[idx].unit = e.target.value;
                              setFormItems(updated);
                            }}
                            required
                            className="h-8 text-xs rounded-lg"
                          />
                        </div>

                        <div className="sm:col-span-3">
                          <Label className="text-[10px] text-neutral-500 font-semibold">Weight (%)</Label>
                          <Input
                            type="number"
                            min="1"
                            max="90"
                            value={item.weightPercent}
                            onChange={(e) => {
                              const updated = [...formItems];
                              updated[idx].weightPercent = parseFloat(e.target.value) || 0;
                              setFormItems(updated);
                            }}
                            required
                            className="h-8 text-xs rounded-lg font-extrabold text-[#0284C7]"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setFormItems([
                        ...formItems,
                        {
                          title: "New Deliverable KPI",
                          category: "GENERAL",
                          targetValue: 5,
                          unit: "Tasks",
                          weightPercent: 10,
                        },
                      ])
                    }
                    className="w-full text-xs font-bold rounded-xl h-8 border-dashed border-neutral-300 text-neutral-600 hover:bg-neutral-100"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Another KPI Item
                  </Button>
                </div>
              </div>

              {/* Incentives */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-neutral-700">Fixed Bonus (₹ INR)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formIncentiveAmount}
                    onChange={(e) => setFormIncentiveAmount(e.target.value)}
                    className="rounded-xl border-neutral-200 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-neutral-700">Commission Rate (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={formIncentivePercent}
                    onChange={(e) => setFormIncentivePercent(e.target.value)}
                    className="rounded-xl border-neutral-200 text-xs"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-neutral-700">Notes / Remarks</Label>
                <Input
                  placeholder="Special instructions or qualifying terms..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="rounded-xl border-neutral-200 text-xs"
                />
              </div>
            </div>

            {/* Modal Footer */}
              <div className="shrink-0 flex justify-end gap-2 p-4 border-t border-neutral-100 bg-neutral-50/70">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl text-xs font-bold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || formTotalScorecardWeight !== 100}
                  className="bg-[#0284C7] hover:bg-[#0369A1] text-white rounded-xl text-xs font-bold px-5"
                >
                  {createMutation.isPending ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Assigning Scorecard...
                    </span>
                  ) : (
                    "Assign Scorecard Target"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT TARGET MODAL */}
      {showEditModal && selectedTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6 backdrop-blur-xs"
          onClick={() => setShowEditModal(false)}
        >
          <div
            className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="shrink-0 flex items-center justify-between border-b border-neutral-100 p-4 sm:p-5 bg-white">
              <div className="flex items-center gap-2">
                <Edit2 className="h-5 w-5 text-[#0284C7]" />
                <h3 className="font-bold text-neutral-900 text-base">
                  Edit Target: {selectedTarget.title}
                </h3>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-neutral-400 hover:text-neutral-600 rounded-lg p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                {formError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-semibold">
                    {formError}
                  </div>
                )}

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-neutral-700">Target Sheet Title *</Label>
                <Input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  required
                  className="rounded-xl border-neutral-200 text-xs"
                />
              </div>

              {/* Start & End Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-neutral-700">Start Date</Label>
                  <Input
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    required
                    className="rounded-xl border-neutral-200 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-neutral-700">End Date</Label>
                  <Input
                    type="date"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    required
                    className="rounded-xl border-neutral-200 text-xs"
                  />
                </div>
              </div>

              {/* KPI Items & Weights */}
              <div className="rounded-xl border border-neutral-200 p-4 bg-neutral-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-800">
                    KPI Deliverables (Total + 10% Discipline = 100%)
                  </h4>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-black ${
                      formTotalScorecardWeight === 100
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    Weight: {formTotalScorecardWeight}% / 100%
                  </span>
                </div>

                <div className="space-y-3">
                  {formItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-white border border-neutral-200 space-y-2 shadow-2xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-neutral-700">Item #{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => setFormItems(formItems.filter((_, i) => i !== idx))}
                          className="text-neutral-400 hover:text-rose-600 text-xs"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                        <div className="sm:col-span-5">
                          <Label className="text-[10px] text-neutral-500 font-semibold">Title</Label>
                          <Input
                            value={item.title}
                            onChange={(e) => {
                              const updated = [...formItems];
                              updated[idx].title = e.target.value;
                              setFormItems(updated);
                            }}
                            required
                            className="h-8 text-xs rounded-lg"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <Label className="text-[10px] text-neutral-500 font-semibold">Goal</Label>
                          <Input
                            type="number"
                            min="1"
                            value={item.targetValue}
                            onChange={(e) => {
                              const updated = [...formItems];
                              updated[idx].targetValue = parseFloat(e.target.value) || 0;
                              setFormItems(updated);
                            }}
                            required
                            className="h-8 text-xs rounded-lg font-bold"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <Label className="text-[10px] text-neutral-500 font-semibold">Unit</Label>
                          <Input
                            value={item.unit}
                            onChange={(e) => {
                              const updated = [...formItems];
                              updated[idx].unit = e.target.value;
                              setFormItems(updated);
                            }}
                            required
                            className="h-8 text-xs rounded-lg"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <Label className="text-[10px] text-neutral-500 font-semibold">Weight (%)</Label>
                          <Input
                            type="number"
                            min="1"
                            max="90"
                            value={item.weightPercent}
                            onChange={(e) => {
                              const updated = [...formItems];
                              updated[idx].weightPercent = parseFloat(e.target.value) || 0;
                              setFormItems(updated);
                            }}
                            required
                            className="h-8 text-xs rounded-lg font-extrabold text-[#0284C7]"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setFormItems([
                        ...formItems,
                        {
                          title: "New Deliverable KPI",
                          category: "GENERAL",
                          targetValue: 5,
                          unit: "Tasks",
                          weightPercent: 10,
                        },
                      ])
                    }
                    className="w-full text-xs font-bold rounded-xl h-8 border-dashed border-neutral-300"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Another KPI Item
                  </Button>
                </div>
              </div>

              {/* Incentives */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-neutral-700">Fixed Bonus (₹)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formIncentiveAmount}
                    onChange={(e) => setFormIncentiveAmount(e.target.value)}
                    className="rounded-xl border-neutral-200 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-neutral-700">Commission Rate (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={formIncentivePercent}
                    onChange={(e) => setFormIncentivePercent(e.target.value)}
                    className="rounded-xl border-neutral-200 text-xs"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-neutral-700">Notes / Remarks</Label>
                <Input
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="rounded-xl border-neutral-200 text-xs"
                />
              </div>
            </div>

            {/* Modal Footer */}
              <div className="shrink-0 flex justify-end gap-2 p-4 border-t border-neutral-100 bg-neutral-50/70">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowEditModal(false)}
                  className="rounded-xl text-xs font-bold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateMutation.isPending || formTotalScorecardWeight !== 100}
                  className="bg-[#0284C7] hover:bg-[#0369A1] text-white rounded-xl text-xs font-bold px-5"
                >
                  {updateMutation.isPending ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Saving Changes...
                    </span>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SYNC TO PAYROLL MODAL */}
      {showSyncModal && selectedTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6 backdrop-blur-xs"
          onClick={() => setShowSyncModal(false)}
        >
          <div
            className="relative w-full max-w-md max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="shrink-0 flex items-center justify-between border-b border-neutral-100 p-4 sm:p-5 bg-white">
              <div className="flex items-center gap-2">
                <Banknote className="h-5 w-5 text-emerald-600" />
                <h3 className="font-bold text-neutral-900 text-base">Sync Incentive to Payroll</h3>
              </div>
              <button
                onClick={() => setShowSyncModal(false)}
                className="text-neutral-400 hover:text-neutral-600 rounded-lg p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {syncFeedback ? (
              <div className="p-6 space-y-4">
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold flex items-center gap-2">
                  <Check className="h-5 w-5 text-emerald-600 shrink-0" />
                  <span>{syncFeedback}</span>
                </div>
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setShowSyncModal(false)}
                    className="rounded-xl text-xs font-bold"
                  >
                    Close
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSyncPayrollSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* Modal Body */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                  {formError && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-semibold">
                      {formError}
                    </div>
                  )}

                  <p className="text-xs text-neutral-600 leading-relaxed">
                    You are crediting the target achievement incentive for{" "}
                    <strong className="text-neutral-900">
                      {selectedTarget.employee.firstName} {selectedTarget.employee.lastName}
                    </strong>{" "}
                    directly into the monthly payroll adjustments for{" "}
                    <strong>
                      {selectedTarget.month ? MONTHS[selectedTarget.month - 1] : "Current Month"} {selectedTarget.year}
                    </strong>.
                  </p>

                  <div className="rounded-xl border border-neutral-200 p-3.5 bg-neutral-50/70 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Achieved Score:</span>
                      <span className="font-black text-[#0284C7]">
                        {selectedTarget.scorecard?.totalScore || 0}% / 100%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Base Target Bonus:</span>
                      <span className="font-bold text-neutral-900">
                        ₹{selectedTarget.incentiveAmount?.toLocaleString("en-IN") || 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Revenue Commission ({selectedTarget.incentivePercent}%):</span>
                      <span className="font-bold text-neutral-900">
                        ₹{Math.round(((selectedTarget.incentivePercent || 0) / 100) * (selectedTarget.currentRevenue || 0)).toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-neutral-700">
                      Final Bonus Amount to Credit (₹ INR) *
                    </Label>
                    <Input
                      type="number"
                      min="1"
                      step="100"
                      value={customBonusAmount}
                      onChange={(e) => setCustomBonusAmount(e.target.value)}
                      required
                      className="rounded-xl border-neutral-200 text-sm font-bold text-emerald-800"
                    />
                    <p className="text-[11px] text-neutral-400">
                      You can override this amount before confirming.
                    </p>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="shrink-0 flex justify-end gap-2 p-4 border-t border-neutral-100 bg-neutral-50/70">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowSyncModal(false)}
                    className="rounded-xl text-xs font-bold"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={syncBonusMutation.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold px-5"
                  >
                    {syncBonusMutation.isPending ? (
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Crediting Incentive...
                      </span>
                    ) : (
                      "Confirm & Sync"
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
