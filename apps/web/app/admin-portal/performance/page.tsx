"use client";

import { useState, useMemo, useEffect, FormEvent } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";
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
  Download,
  ArrowRightLeft,
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
  Layers,
  PhoneCall,
  UserPlus,
  Compass,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import { TARGET_COMPANIES, TargetCompany } from "@realty-smartz/shared";
import {
  CompanyComparisonGraph,
  TargetVsActualBarChart,
} from "@/components/PerformanceCharts";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

interface FormTargetItem {
  id?: string;
  title: string;
  category: "SALES" | "PRESALES" | "HR" | "IT" | "OPERATIONS" | "GENERAL";
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
  const [selectedCompany, setSelectedCompany] = useState<string>("ALL");
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<string>(String(currentMonth));
  const [selectedDept, setSelectedDept] = useState<string>("ALL");
  const [selectedPeriodType, setSelectedPeriodType] = useState<
    "ALL" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY"
  >("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");

  // Navigation Tab State
  const [activeTab, setActiveTab] = useState<
    "overview" | "companies" | "teams" | "all_targets" | "mapping"
  >("overview");

  // Entity Mapping & TL Transfer State
  const [mappingCompany, setMappingCompany] = useState<TargetCompany>("Realty Smartz");
  const [mappingSearch, setMappingSearch] = useState("");
  const [selectedMappingIds, setSelectedMappingIds] = useState<string[]>([]);
  const [transferFromId, setTransferFromId] = useState("");
  const [transferToId, setTransferToId] = useState("");
  const [mappingFeedback, setMappingFeedback] = useState("");

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showDisciplineDetailModal, setShowDisciplineDetailModal] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<any>(null);

  // Form States (Create / Edit)
  const [formCompany, setFormCompany] = useState<TargetCompany>("Realty Smartz");
  const [formEmployeeId, setFormEmployeeId] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formRolePreset, setFormRolePreset] = useState<
    | "SALES"
    | "TELESALES"
    | "TEAM_LEADER_SALES"
    | "TEAM_LEADER_PRESALES"
    | "DIRECT_SALES"
    | "HR"
    | "IT"
    | "OPERATIONS"
  >("SALES");
  const [formPeriodType, setFormPeriodType] = useState<"WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY">("MONTHLY");
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
  useBodyScrollLock(
    showCreateModal ||
    showEditModal ||
    showVerificationModal ||
    showSyncModal ||
    showDisciplineDetailModal
  );

  // Queries
  const { data: targetsData, isLoading: targetsLoading, refetch: refetchTargets } =
    trpc.target.listAdmin.useQuery({
      year: selectedYear,
      month: selectedMonth === "ALL" ? undefined : parseInt(selectedMonth, 10),
      departmentId: selectedDept === "ALL" ? undefined : selectedDept,
      companyName: selectedCompany === "ALL" ? undefined : selectedCompany,
    });

  const { data: rosterData, refetch: refetchRoster } =
    trpc.target.activeTeamRoster.useQuery();

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
        `Successfully credited ${formatCurrency(data.amount)} bonus to ${data.employeeName} for ${MONTHS[data.month - 1]
        } ${data.year}!`
      );
      utils.target.listAdmin.invalidate();
    },
    onError: (err) => setFormError(userFacingErrorMessage(err)),
  });

  const assignCompanyMutation = trpc.target.assignEmployeesCompany.useMutation({
    onSuccess: (res) => {
      setSelectedMappingIds([]);
      setMappingFeedback(`Assigned ${res.count} employee(s) to ${res.companyName}.`);
      refetchRoster();
      utils.target.listAdmin.invalidate();
      utils.employee.list.invalidate();
    },
    onError: (err) => setMappingFeedback(userFacingErrorMessage(err)),
  });

  const transferTlMutation = trpc.target.transferTeamLeader.useMutation({
    onSuccess: (res) => {
      setTransferFromId("");
      setTransferToId("");
      setMappingFeedback(`Transferred ${res.transferredCount} active member(s) to new Team Leader.`);
      refetchRoster();
      utils.target.listAdmin.invalidate();
      utils.employee.list.invalidate();
    },
    onError: (err) => setMappingFeedback(userFacingErrorMessage(err)),
  });

  const setManagerMutation = trpc.target.setEmployeeManager.useMutation({
    onSuccess: () => {
      refetchRoster();
      utils.target.listAdmin.invalidate();
      utils.employee.list.invalidate();
    },
  });

  // Calculate sum of item weights in form
  const formTotalItemsWeight = useMemo(() => {
    return formItems.reduce((acc, curr) => acc + (Number(curr.weightPercent) || 0), 0);
  }, [formItems]);

  const formTotalScorecardWeight = formTotalItemsWeight + 10; // +10% Discipline

  // Reset form
  function resetForm() {
    setFormCompany(selectedCompany !== "ALL" ? (selectedCompany as TargetCompany) : "Realty Smartz");
    setFormEmployeeId("");
    setFormTitle("");
    setFormRolePreset("SALES");
    setFormPeriodType("MONTHLY");
    setFormMonth(currentMonth);
    setFormYear(currentYear);
    setFormStartDate(new Date(currentYear, currentMonth - 1, 1).toISOString().slice(0, 10));
    setFormEndDate(new Date(currentYear, currentMonth, 0).toISOString().slice(0, 10));
    setFormIncentiveAmount("20000");
    setFormIncentivePercent("1.0");
    setFormNotes("");
    setFormError("");
    applyPreset("SALES");
  }

  // Preset loaders for departments & roles (90% Deliverables + 10% Attendance = 100%)
  function applyPreset(
    presetType:
      | "SALES"
      | "TELESALES"
      | "TEAM_LEADER_SALES"
      | "TEAM_LEADER_PRESALES"
      | "DIRECT_SALES"
      | "HR"
      | "IT"
      | "OPERATIONS"
  ) {
    setFormRolePreset(presetType);
    if (presetType === "SALES") {
      // Sales: Visits 20%, Booking 30%, Revenue 40%
      setFormItems([
        {
          title: "Site Visits",
          category: "SALES",
          targetValue: 15,
          unit: "Visits",
          weightPercent: 20,
          notes: "Client property visits",
        },
        {
          title: "Confirmed Bookings",
          category: "SALES",
          targetValue: 2,
          unit: "Bookings",
          weightPercent: 30,
          notes: "Closed unit bookings",
        },
        {
          title: "Sales Revenue",
          category: "SALES",
          targetValue: 5000000,
          unit: "INR",
          weightPercent: 40,
          notes: "Total gross deal value",
        },
      ]);
    } else if (presetType === "TELESALES") {
      // Telesales / Presales: Verified Visits 30%, Booking 40%, Prospects 20%
      setFormItems([
        {
          title: "Verified Site Visits",
          category: "PRESALES",
          targetValue: 20,
          unit: "Visits",
          weightPercent: 30,
          notes: "Verified buyer visits",
        },
        {
          title: "Confirmed Bookings",
          category: "PRESALES",
          targetValue: 2,
          unit: "Bookings",
          weightPercent: 40,
          notes: "Bookings from scheduled visits",
        },
        {
          title: "Qualified Prospects",
          category: "PRESALES",
          targetValue: 40,
          unit: "Leads",
          weightPercent: 20,
          notes: "Qualified buyer prospects",
        },
      ]);
    } else if (presetType === "TEAM_LEADER_SALES") {
      // Team Leader (Sales): Booking 40%, Revenue 50%
      setFormItems([
        {
          title: "Team Confirmed Bookings",
          category: "SALES",
          targetValue: 6,
          unit: "Bookings",
          weightPercent: 40,
          notes: "Total bookings closed by team",
        },
        {
          title: "Team Gross Revenue",
          category: "SALES",
          targetValue: 15000000,
          unit: "INR",
          weightPercent: 50,
          notes: "Total revenue closed by team",
        },
      ]);
    } else if (presetType === "TEAM_LEADER_PRESALES") {
      // Team Leader (Presales): Visits 30%, Booking 60%
      setFormItems([
        {
          title: "Team Verified Visits",
          category: "PRESALES",
          targetValue: 40,
          unit: "Visits",
          weightPercent: 30,
          notes: "Verified visits by presales team",
        },
        {
          title: "Team Confirmed Bookings",
          category: "PRESALES",
          targetValue: 6,
          unit: "Bookings",
          weightPercent: 60,
          notes: "Bookings from presales team",
        },
      ]);
    } else if (presetType === "DIRECT_SALES") {
      // Direct Sales (Reporting to Chhavi): Booking 40%, Revenue 50%
      setFormItems([
        {
          title: "Confirmed Bookings",
          category: "SALES",
          targetValue: 4,
          unit: "Bookings",
          weightPercent: 40,
          notes: "Direct sales unit bookings",
        },
        {
          title: "Gross Sales Revenue",
          category: "SALES",
          targetValue: 10000000,
          unit: "INR",
          weightPercent: 50,
          notes: "Direct sales gross revenue",
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
          notes: "First-round screening calls and interviews",
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
          notes: "Process checkups and compliance logs",
        },
      ]);
    }
  }

  // Handle employee selection in Create Modal
  function handleEmployeeSelect(empId: string) {
    setFormEmployeeId(empId);
    const activeList = rosterData?.activeEmployees ?? [];
    const emp = activeList.find((e: any) => e.id === empId);
    if (emp) {
      if (emp.companyName) {
        setFormCompany(emp.companyName as TargetCompany);
      }
      const dTitle = (emp.designation?.title || "").toLowerCase();
      const dDept = (emp.department?.name || "").toLowerCase();
      const mgrName = `${emp.manager?.firstName || ""} ${emp.manager?.lastName || ""}`.toLowerCase();
      if ((dTitle.includes("lead") || dTitle.includes("manager") || dTitle.includes("tl")) && (dTitle.includes("presales") || dDept.includes("presales") || dDept.includes("telesales"))) {
        applyPreset("TEAM_LEADER_PRESALES");
      } else if (dTitle.includes("lead") || dTitle.includes("manager") || dTitle.includes("tl")) {
        applyPreset("TEAM_LEADER_SALES");
      } else if (dTitle.includes("presales") || dTitle.includes("telesales") || dDept.includes("presales") || dDept.includes("telesales")) {
        applyPreset("TELESALES");
      } else if (mgrName.includes("chhavi")) {
        applyPreset("DIRECT_SALES");
      } else if (dDept.includes("hr")) {
        applyPreset("HR");
      } else if (dDept.includes("it") || dDept.includes("tech")) {
        applyPreset("IT");
      } else {
        applyPreset("SALES");
      }
    }
  }

  function openCreateModal(preselectedEmployeeId?: string, preselectedCompany?: TargetCompany) {
    resetForm();
    if (preselectedCompany) {
      setFormCompany(preselectedCompany);
    }
    if (preselectedEmployeeId) {
      handleEmployeeSelect(preselectedEmployeeId);
    }
    const activeList = rosterData?.activeEmployees ?? [];
    const emp = activeList.find((e: any) => e.id === (preselectedEmployeeId || formEmployeeId));
    const titleEmpName = emp ? `${emp.firstName} ${emp.lastName}` : "Team Member";
    setFormTitle(`${MONTHS[currentMonth - 1]} ${currentYear} Target Sheet - ${titleEmpName}`);
    setShowCreateModal(true);
  }

  function openEditModal(target: any) {
    setSelectedTarget(target);
    setFormCompany(target.companyName || target.employee?.companyName || "Realty Smartz");
    setFormEmployeeId(target.employeeId);
    setFormTitle(target.title);
    setFormPeriodType(target.periodType || "MONTHLY");
    setFormMonth(target.month || currentMonth);
    setFormYear(target.year || currentYear);
    setFormStartDate(
      target.startDate ? new Date(target.startDate).toISOString().slice(0, 10) : ""
    );
    setFormEndDate(
      target.endDate ? new Date(target.endDate).toISOString().slice(0, 10) : ""
    );
    setFormIncentiveAmount(String(target.incentiveAmount || 0));
    setFormIncentivePercent(String(target.incentivePercent || 0));
    setFormNotes(target.notes || "");
    setFormError("");

    if (target.items && target.items.length > 0) {
      setFormItems(
        target.items.map((it: any) => ({
          id: it.id,
          title: it.title,
          category: it.category || "SALES",
          targetValue: it.targetValue,
          unit: it.unit,
          weightPercent: it.weightPercent,
          notes: it.notes || "",
        }))
      );
    } else {
      applyPreset("SALES");
    }

    setShowEditModal(true);
  }

  function openSyncModal(target: any) {
    setSelectedTarget(target);
    const calculatedBonus =
      (target.incentiveAmount || 0) +
      ((target.incentivePercent || 0) / 100) * (target.currentRevenue || 0);
    setCustomBonusAmount(String(Math.round(calculatedBonus)));
    setSyncFeedback("");
    setShowSyncModal(true);
  }

  function handleCreateSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError("");

    if (!formEmployeeId) {
      setFormError("Please select an employee.");
      return;
    }

    if (formTotalScorecardWeight !== 100) {
      setFormError(
        `Total scorecard weight must equal 100%. Currently it is ${formTotalScorecardWeight}% (10% Attendance + ${formTotalItemsWeight}% Deliverables).`
      );
      return;
    }

    let targetVisits = 0;
    let targetBookings = 0;
    let targetRevenue = 0;

    for (const item of formItems) {
      if (item.category === "SALES" || item.category === "PRESALES") {
        const titleLower = item.title.toLowerCase();
        if (titleLower.includes("visit")) targetVisits += item.targetValue;
        if (titleLower.includes("booking") || titleLower.includes("deal")) targetBookings += item.targetValue;
        if (titleLower.includes("revenue") || item.unit === "INR") targetRevenue += item.targetValue;
      }
    }

    createMutation.mutate({
      employeeId: formEmployeeId,
      companyName: formCompany,
      title: formTitle.trim(),
      periodType: formPeriodType,
      month: formMonth,
      year: formYear,
      startDate: new Date(formStartDate),
      endDate: new Date(formEndDate),
      targetVisits,
      targetBookings,
      targetRevenue,
      incentiveAmount: parseFloat(formIncentiveAmount) || 0,
      incentivePercent: parseFloat(formIncentivePercent) || 0,
      notes: formNotes.trim() || undefined,
      items: formItems.map((item) => ({
        title: item.title.trim(),
        category: item.category,
        targetValue: item.targetValue,
        unit: item.unit.trim(),
        weightPercent: item.weightPercent,
        notes: item.notes?.trim() || undefined,
      })),
    });
  }

  function handleEditSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError("");

    if (!selectedTarget) return;

    if (formTotalScorecardWeight !== 100) {
      setFormError(
        `Total scorecard weight must equal 100%. Currently it is ${formTotalScorecardWeight}% (10% Attendance + ${formTotalItemsWeight}% Deliverables).`
      );
      return;
    }

    let targetVisits = 0;
    let targetBookings = 0;
    let targetRevenue = 0;

    for (const item of formItems) {
      if (item.category === "SALES" || item.category === "PRESALES") {
        const titleLower = item.title.toLowerCase();
        if (titleLower.includes("visit")) targetVisits += item.targetValue;
        if (titleLower.includes("booking") || titleLower.includes("deal")) targetBookings += item.targetValue;
        if (titleLower.includes("revenue") || item.unit === "INR") targetRevenue += item.targetValue;
      }
    }

    updateMutation.mutate({
      id: selectedTarget.id,
      companyName: formCompany,
      title: formTitle.trim(),
      periodType: formPeriodType,
      month: formMonth,
      year: formYear,
      startDate: new Date(formStartDate),
      endDate: new Date(formEndDate),
      targetVisits,
      targetBookings,
      targetRevenue,
      incentiveAmount: parseFloat(formIncentiveAmount) || 0,
      incentivePercent: parseFloat(formIncentivePercent) || 0,
      notes: formNotes.trim() || undefined,
      items: formItems.map((item) => ({
        title: item.title.trim(),
        category: item.category,
        targetValue: item.targetValue,
        unit: item.unit.trim(),
        weightPercent: item.weightPercent,
        notes: item.notes?.trim() || undefined,
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
    if (selectedCompany !== "ALL") {
      list = list.filter((t) => t.companyName === selectedCompany);
    }
    if (selectedPeriodType !== "ALL") {
      list = list.filter((t) => (t.periodType || "MONTHLY") === selectedPeriodType);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((t) => {
        const empName = `${t.employee.firstName} ${t.employee.lastName}`.toLowerCase();
        const empCode = (t.employee.employeeCode || "").toLowerCase();
        const title = t.title.toLowerCase();
        const comp = (t.companyName || "").toLowerCase();
        return empName.includes(q) || empCode.includes(q) || title.includes(q) || comp.includes(q);
      });
    }
    return list;
  }, [targetsData?.targets, selectedCompany, searchQuery]);

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

  // Distribution for visual charts
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

  // RAG Status Helper: < 50% Red, 50-99.9% Amber, 100% Green
  function getRagMeta(score: number) {
    if (score >= 100) {
      return {
        label: "Green (100%)",
        barColor: "#16A34A",
        badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
        barClass: "bg-emerald-600",
      };
    }
    if (score >= 50) {
      return {
        label: "Amber (50–99%)",
        barColor: "#D97706",
        badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
        barClass: "bg-amber-500",
      };
    }
    return {
      label: "Red (<50%)",
      barColor: "#DC2626",
      badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
      barClass: "bg-rose-600",
    };
  }

  // CSV Sheet Download Helper (Daily / Weekly / Full TL & Team)
  function downloadCsvSheet(mode: "DAILY" | "WEEKLY" | "TL_TEAM") {
    const escapeCsv = (val: unknown) => {
      const s = String(val ?? "").replace(/"/g, '""');
      return `"${s}"`;
    };
    let headers: string[] = [];
    let rows: string[][] = [];
    const todayStr = new Date().toISOString().slice(0, 10);

    if (mode === "TL_TEAM") {
      headers = [
        "Team Leader",
        "TL Code",
        "Company",
        "Department",
        "Member Name",
        "Member Code",
        "Member Designation",
        "Score (%)",
        "RAG Status",
        "Achieved Revenue (INR)",
        "Target Revenue (INR)",
        "Visits",
        "Bookings",
      ];
      (targetsData?.teamLeaders ?? []).forEach((tl: any) => {
        (tl.members ?? []).forEach((m: any) => {
          const mTarget = filteredTargets.find((t) => t.employeeId === m.id);
          const score = mTarget?.scorecard?.totalScore ?? 0;
          rows.push([
            tl.name,
            tl.employeeCode || "",
            tl.companyName || "Realty Smartz",
            tl.department || "",
            m.name,
            m.employeeCode || "",
            m.designation || "",
            String(score),
            getRagMeta(score).label,
            String(mTarget?.currentRevenue ?? m.achievedRevenue ?? 0),
            String(mTarget?.targetRevenue ?? m.targetRevenue ?? 0),
            String(mTarget?.currentVisits ?? 0),
            String(mTarget?.currentBookings ?? 0),
          ]);
        });
      });
    } else {
      const source =
        mode === "WEEKLY"
          ? filteredTargets.filter((t) => t.periodType === "WEEKLY" || selectedPeriodType === "ALL")
          : filteredTargets;
      headers = [
        "Date",
        "Period",
        "Employee",
        "Code",
        "Company",
        "Department",
        "Team Leader",
        "Score (%)",
        "RAG Status",
        "Discipline (%)",
        "Late Marks (10:15+)",
        "Half Days",
        "Visits",
        "Bookings",
        "Achieved Revenue (INR)",
      ];
      source.forEach((t: any) => {
        const score = t.scorecard?.totalScore ?? 0;
        const mgrName = t.employee?.manager
          ? `${t.employee.manager.firstName} ${t.employee.manager.lastName}`
          : "-";
        rows.push([
          todayStr,
          t.periodType || "MONTHLY",
          `${t.employee.firstName} ${t.employee.lastName}`,
          t.employee.employeeCode || "",
          t.companyName || "Realty Smartz",
          t.employee.department?.name || "",
          mgrName,
          String(score),
          getRagMeta(score).label,
          String(t.discipline?.score ?? 0),
          String(t.discipline?.lateMarkOnlyDays ?? 0),
          String(t.discipline?.halfDays ?? 0),
          String(t.currentVisits ?? 0),
          String(t.currentBookings ?? 0),
          String(t.currentRevenue ?? 0),
        ]);
      });
    }

    const csvContent = [headers, ...rows]
      .map((r) => r.map(escapeCsv).join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `performance-${mode.toLowerCase()}-${todayStr}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

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
            Real-time targets, company-wise calculations, Team Leaders, and live verifications.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadCsvSheet("DAILY")}
            className="rounded-xl text-xs font-semibold gap-1 border-neutral-300 hover:border-sky-300"
          >
            <Download className="h-3.5 w-3.5 text-[#0284C7]" />
            Daily CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadCsvSheet("WEEKLY")}
            className="rounded-xl text-xs font-semibold gap-1 border-neutral-300 hover:border-sky-300"
          >
            <Download className="h-3.5 w-3.5 text-[#0284C7]" />
            Weekly CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadCsvSheet("TL_TEAM")}
            className="rounded-xl text-xs font-semibold gap-1 border-neutral-300 hover:border-sky-300"
          >
            <Download className="h-3.5 w-3.5 text-[#0284C7]" />
            TL & Team CSV
          </Button>

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
            onClick={() => openCreateModal()}
            className="bg-[#0284C7] hover:bg-[#0369A1] text-white rounded-xl text-xs font-bold gap-1.5 shadow-xs transition-colors"
          >
            <Plus className="h-4 w-4" />
            Assign Target
          </Button>
        </div>
      </div>

      {/* 4 COMPANIES SWITCHER PILLS (REALTY SMARTZ / SMARTZ SPACES / ENGAGEXPERT / BUYSQUAD) */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-white border border-neutral-200/80 shadow-2xs overflow-x-auto">
        <button
          onClick={() => setSelectedCompany("ALL")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${selectedCompany === "ALL"
              ? "bg-neutral-900 text-white shadow-xs"
              : "text-neutral-600 hover:bg-neutral-100"
            }`}
        >
          <Building2 className="h-3.5 w-3.5" />
          All Companies
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${selectedCompany === "ALL" ? "bg-white/20 text-white" : "bg-neutral-200 text-neutral-700"
            }`}>
            {targetsData?.targets?.length || 0}
          </span>
        </button>

        {TARGET_COMPANIES.map((company) => {
          const isSelected = selectedCompany === company;
          const compData = targetsData?.companyBreakdown?.find((c) => c.companyName === company);
          const count = compData?.targetsCount ?? 0;

          return (
            <button
              key={company}
              onClick={() => setSelectedCompany(company)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${isSelected
                  ? "bg-[#0284C7] text-white shadow-xs"
                  : "text-neutral-600 hover:bg-sky-50 hover:text-sky-900"
                }`}
            >
              <Compass className="h-3.5 w-3.5" />
              {company}
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${isSelected ? "bg-white/20 text-white" : "bg-neutral-100 text-neutral-600"
                }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Metric Stats Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-sky-100 bg-white p-3.5 shadow-2xs hover:border-sky-200 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">
              Active Targets
            </span>
            <Target className="h-4 w-4 text-sky-500" />
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-bold text-neutral-900">{filteredTargets.length}</span>
            <span className="text-xs text-neutral-400 font-medium">Sheets</span>
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

      {/* Main Tab Navigation Bar */}
      <div className="flex items-center gap-1.5 border-b border-neutral-200/80 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === "overview"
              ? "bg-[#0284C7] text-white shadow-xs"
              : "bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200"
            }`}
        >
          <Activity className="h-3.5 w-3.5" />
          Overview & Scorecard
        </button>

        <button
          onClick={() => setActiveTab("companies")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === "companies"
              ? "bg-[#0284C7] text-white shadow-xs"
              : "bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200"
            }`}
        >
          <Building2 className="h-3.5 w-3.5" />
          Company Calculations (4 Companies)
        </button>

        <button
          onClick={() => setActiveTab("teams")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === "teams"
              ? "bg-[#0284C7] text-white shadow-xs"
              : "bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200"
            }`}
        >
          <Users className="h-3.5 w-3.5" />
          Team Leaders & Hierarchy
          {targetsData?.teamLeaders && targetsData.teamLeaders.length > 0 && (
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${activeTab === "teams" ? "bg-white/20 text-white" : "bg-sky-100 text-[#0284C7]"
              }`}>
              {targetsData.teamLeaders.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("all_targets")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === "all_targets"
              ? "bg-[#0284C7] text-white shadow-xs"
              : "bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200"
            }`}
        >
          <Target className="h-3.5 w-3.5" />
          All Targets (Employee-wise)
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${activeTab === "all_targets" ? "bg-white/20 text-white" : "bg-neutral-100 text-neutral-600"
            }`}>
            {filteredTargets.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("mapping")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${activeTab === "mapping"
              ? "bg-[#0284C7] text-white shadow-xs"
              : "bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200"
            }`}
        >
          <ArrowRightLeft className="h-3.5 w-3.5" />
          Entity Mapping & TL Transfer
        </button>
      </div>

      {/* TAB 1: OVERVIEW & SCORECARD VIEW */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          {/* Filter Bar for Single Employee Selector */}
          <Card className="rounded-2xl border-sky-100 bg-white p-3.5 shadow-xs">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-400" />
                <Input
                  placeholder="Search employee..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-9 rounded-xl border-neutral-200 text-xs focus:border-[#0284C7]"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={selectedPeriodType}
                  onChange={(e) => setSelectedPeriodType(e.target.value as any)}
                  className="h-9 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-700 outline-none"
                >
                  <option value="ALL">All Periods</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="QUARTERLY">Quarterly</option>
                  <option value="YEARLY">Yearly</option>
                </select>

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
                        {t.employee.firstName} {t.employee.lastName} ({t.companyName || "RS"}) - {t.scorecard.totalScore}%
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>
          </Card>

          {/* RAG Performance Graph (Weekly / Monthly / Quarterly / Yearly) */}
          <Card className="rounded-2xl border-sky-100 bg-white p-4 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-neutral-900">
                  Performance RAG Graph ({selectedPeriodType === "ALL" ? "All Periods" : selectedPeriodType})
                </h3>
                <p className="text-[11px] text-neutral-500">
                  Red &lt; 50% • Amber 50%–99% • Green 100%
                </p>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-bold flex-wrap">
                <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                  Red: {filteredTargets.filter((t) => (t.scorecard?.totalScore ?? 0) < 50).length}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                  Amber: {filteredTargets.filter((t) => {
                    const s = t.scorecard?.totalScore ?? 0;
                    return s >= 50 && s < 100;
                  }).length}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Green: {filteredTargets.filter((t) => (t.scorecard?.totalScore ?? 0) >= 100).length}
                </span>
              </div>
            </div>

            {/* 4-Company RAG Summary Bars */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {TARGET_COMPANIES.map((company) => {
                const comp = targetsData?.companyBreakdown?.find((c) => c.companyName === company);
                const avg = Math.min(100, Math.round((comp?.avgScore ?? 0) * 10) / 10);
                const rag = getRagMeta(avg);
                return (
                  <div
                    key={company}
                    className="p-2.5 rounded-xl border border-neutral-200 bg-neutral-50/50 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-neutral-900 truncate">{company}</span>
                      <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold border ${rag.badgeClass}`}>
                        {avg}%
                      </span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-neutral-200 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${rag.barClass}`}
                        style={{ width: `${Math.max(4, avg)}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-neutral-500">
                      {comp?.targetsCount ?? 0} active target(s)
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredTargets.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-64 overflow-y-auto pr-1 pt-2 border-t border-neutral-100">
                {filteredTargets.map((t) => {
                  const score = Math.min(100, Math.round((t.scorecard?.totalScore ?? 0) * 10) / 10);
                  const rag = getRagMeta(score);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedEmployeeId(t.employeeId)}
                      className={`text-left p-2.5 rounded-xl border transition-all ${activeEmployeeTarget?.id === t.id
                          ? "border-[#0284C7] bg-sky-50/40"
                          : "border-neutral-200 hover:border-sky-300 bg-white"
                        }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs mb-1">
                        <span className="font-bold text-neutral-900 truncate">
                          {t.employee.firstName} {t.employee.lastName}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold border ${rag.badgeClass}`}>
                          {score}%
                        </span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-neutral-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${rag.barClass}`}
                          style={{ width: `${Math.max(4, score)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-neutral-400 mt-1">
                        <span className="truncate">{t.companyName || "Realty Smartz"}</span>
                        <span>{t.periodType || "MONTHLY"}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-neutral-500 pt-2 border-t border-neutral-100 flex items-center justify-between">
                <span>No individual targets assigned for this period/company filter yet.</span>
                <Button
                  size="sm"
                  onClick={() => openCreateModal()}
                  className="h-7 rounded-lg bg-[#0284C7] text-white text-[11px] font-bold"
                >
                  + Assign Target
                </Button>
              </div>
            )}
          </Card>

          {/* Active Employee Scorecard */}
          {targetsLoading ? (
            <Card className="p-12 text-center rounded-2xl bg-white border border-sky-100 shadow-xs space-y-3">
              <Loader2 className="h-8 w-8 text-[#0284C7] animate-spin mx-auto" />
              <p className="text-xs font-semibold text-neutral-600">Loading scorecard...</p>
            </Card>
          ) : activeEmployeeTarget ? (
            <div className="space-y-4">
              {/* Scorecard Hero Banner */}
              <Card className="rounded-2xl border-sky-100 bg-white p-6 shadow-xs">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  {/* Employee Info */}
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent)] text-white font-extrabold text-lg shadow-sm">
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
                        <span className="rounded-full bg-sky-100 text-[#0284C7] border border-sky-300 px-2.5 py-0.5 text-[11px] font-bold">
                          {activeEmployeeTarget.companyName || "Realty Smartz"}
                        </span>
                        <span className="rounded-full bg-neutral-50 text-neutral-600 border border-neutral-200 px-2.5 py-0.5 text-[11px] font-semibold">
                          {activeEmployeeTarget.employee.department?.name || "Sales"}
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
                        Performance Index
                      </span>
                      <div className="flex items-baseline justify-center gap-1 mt-0.5">
                        <span className="text-3xl font-black text-sky-950">
                          {activeEmployeeTarget.scorecard.totalScore}%
                        </span>
                        <span className="text-xs font-semibold text-neutral-400">/ 100%</span>
                      </div>
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase mt-1 ${activeEmployeeTarget.scorecard.totalScore >= 80
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

                {/* Split Bar: Discipline (10%) + Role KPIs (90%) */}
                <div className="mt-5 pt-4 border-t border-neutral-100 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-neutral-600">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#38BDF8] inline-block" />
                      Attendance Discipline:{" "}
                      <strong className="text-sky-800">{activeEmployeeTarget.discipline.score}% / 10%</strong>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#0284C7] inline-block" />
                      Role Deliverables:{" "}
                      <strong className="text-[#0284C7]">
                        {activeEmployeeTarget.scorecard.performanceScore}% / 90%
                      </strong>
                    </span>
                  </div>

                  <div className="h-3 w-full rounded-full bg-sky-50 flex overflow-hidden p-0.5 border border-sky-100">
                    <div
                      className="h-full rounded-l-full bg-[#38BDF8] transition-all duration-300"
                      style={{ width: `${activeEmployeeTarget.discipline.score}%` }}
                    />
                    <div
                      className="h-full rounded-r-full bg-[#0284C7] transition-all duration-300"
                      style={{
                        width: `${Math.min(90, activeEmployeeTarget.scorecard.performanceScore)}%`,
                      }}
                    />
                  </div>
                </div>
              </Card>

              {/* Radial Gauge & Bar Deliverables Chart */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Radial Gauge */}
                <Card className="lg:col-span-5 rounded-2xl border-sky-100 bg-white p-5 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between border-b border-sky-100 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-sky-100 text-[#0284C7]">
                        <Activity className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-neutral-900">Scorecard Gauge</h4>
                        <p className="text-[10px] text-neutral-400">Total Pro-Rata Performance</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-[#0284C7] bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">
                      Live Index
                    </span>
                  </div>

                  <div className="py-3 flex flex-col items-center justify-center">
                    <div className="relative flex h-44 w-44 items-center justify-center">
                      <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
                        <circle cx="80" cy="80" r="62" fill="none" stroke="#E0F2FE" strokeWidth="10" />
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
                        />
                        <circle cx="80" cy="80" r="48" fill="none" stroke="#F0F9FF" strokeWidth="10" />
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
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                        <span className="text-3xl font-black text-sky-950 tracking-tight">
                          {activeEmployeeTarget.scorecard.totalScore}%
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 mt-0.5">
                          Total Score
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 w-full mt-2 pt-3 border-t border-sky-100">
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
                          <span className="text-[10px] text-neutral-500 font-semibold block truncate">Deliverables (90%)</span>
                          <strong className="text-xs font-bold text-blue-900">{activeEmployeeTarget.scorecard.performanceScore}%</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Deliverables Bars Chart */}
                <Card className="lg:col-span-7 rounded-2xl border-sky-100 bg-white p-5 shadow-xs space-y-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between border-b border-sky-100 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-sky-100 text-[#0284C7]">
                        <BarChart2 className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-neutral-900">Target vs. Achieved Deliverables</h4>
                        <p className="text-[10px] text-neutral-400">Milestone deliverables progress</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-[#0284C7] bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">
                      Progress
                    </span>
                  </div>

                  <div className="space-y-3 flex-1 overflow-y-auto max-h-[220px] pr-1">
                    {/* Attendance Discipline */}
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

                    {/* Deliverables */}
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
                              className="h-full rounded-full bg-[var(--card)] from-sky-400 to-[#0284C7] transition-all duration-500"
                              style={{ width: `${completionPct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-400">
                    <span>Verified items update scorecard automatically</span>
                    <span className="font-bold text-[#0284C7]">Role Target: {activeEmployeeTarget.scorecard.performanceScore}% / 90%</span>
                  </div>
                </Card>
              </div>

              {/* Scorecard Breakdown Table */}
              <Card className="rounded-2xl border-neutral-200/80 bg-white shadow-xs overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-neutral-100 flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="font-bold text-neutral-900 text-sm">
                    Detailed Scorecard Breakdown
                  </h3>
                  <span className="text-xs font-bold text-neutral-500">
                    Total Weight: <strong className="text-neutral-900">{activeEmployeeTarget.scorecard.totalWeight}%</strong>
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-neutral-50/80 border-b border-neutral-200 text-neutral-500 font-bold uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-4">Metric / Deliverable</th>
                        <th className="py-3 px-3">Category</th>
                        <th className="py-3 px-4">Target</th>
                        <th className="py-3 px-4">Achieved</th>
                        <th className="py-3 px-3 text-center">Weight</th>
                        <th className="py-3 px-4 text-center">Score</th>
                        <th className="py-3 px-4 text-center">Progress</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {/* Attendance Discipline Row */}
                      <tr className="bg-sky-50/30 hover:bg-sky-50/60 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-sky-100 text-sky-800">
                              <Clock className="h-4 w-4" />
                            </div>
                            <div>
                              <strong className="text-neutral-900 block font-bold">Attendance Discipline</strong>
                              <span className="text-[10px] text-sky-700 font-medium">Punctuality & Working Days</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="rounded-md bg-sky-100 px-2 py-0.5 text-[10px] font-extrabold text-sky-800">
                            ATTENDANCE
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-neutral-800">{activeEmployeeTarget.discipline.expectedWorkingDays} Days</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <strong className="text-sky-900 font-bold block">
                            {activeEmployeeTarget.discipline.earnedCredits} / {activeEmployeeTarget.discipline.expectedWorkingDays} Days
                          </strong>
                        </td>
                        <td className="py-3.5 px-3 text-center font-bold text-neutral-700">10%</td>
                        <td className="py-3.5 px-4 text-center font-bold text-[#0284C7]">{activeEmployeeTarget.discipline.score}%</td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-extrabold text-sky-800">
                            {Math.round((activeEmployeeTarget.discipline.score / 10) * 100)}%
                          </span>
                        </td>
                      </tr>

                      {/* Items */}
                      {(activeEmployeeTarget.items || []).map((it: any) => {
                        const completion = Math.min(100, it.itemCompletionRate || 0);
                        return (
                          <tr key={it.id} className="hover:bg-neutral-50/70 transition-colors">
                            <td className="py-3.5 px-4">
                              <strong className="text-neutral-900 block font-semibold">{it.title}</strong>
                              {it.notes && <span className="text-[10px] text-neutral-400 block">{it.notes}</span>}
                            </td>
                            <td className="py-3.5 px-3">
                              <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-700">
                                {it.category}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-neutral-800">
                              {it.unit === "INR" ? formatCurrency(it.targetValue) : `${it.targetValue} ${it.unit}`}
                            </td>
                            <td className="py-3.5 px-4 font-bold text-neutral-900">
                              {it.unit === "INR" ? formatCurrency(it.achievedValue) : `${it.achievedValue} ${it.unit}`}
                            </td>
                            <td className="py-3.5 px-3 text-center font-bold text-neutral-700">{it.weightPercent}%</td>
                            <td className="py-3.5 px-4 text-center font-bold text-[#0284C7]">{it.earnedScore}%</td>
                            <td className="py-3.5 px-4 text-center">
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${completion >= 100 ? "bg-emerald-100 text-emerald-800" : completion >= 50 ? "bg-blue-100 text-blue-800" : "bg-neutral-100 text-neutral-700"
                                }`}>
                                {completion}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          ) : (
            <Card className="rounded-2xl border-neutral-200 p-12 text-center bg-white shadow-xs">
              <Target className="h-10 w-10 text-neutral-300 mx-auto mb-2" />
              <h3 className="font-bold text-neutral-800">No Target Sheets Found</h3>
              <p className="text-xs text-neutral-500 mt-1">Assign a target sheet to start tracking performance.</p>
              <Button onClick={() => openCreateModal()} className="mt-4 bg-[#0284C7] text-white rounded-xl text-xs font-bold">
                Assign First Target
              </Button>
            </Card>
          )}
        </div>
      )}

      {/* TAB 2: COMPANY-WISE CALCULATIONS (4 COMPANIES) */}
      {activeTab === "companies" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-neutral-900">
                Company-Wise Performance & Calculations
              </h2>
              <p className="text-xs text-neutral-500">
                Aggregated deliverables, gross revenue, site visits, and team metrics across all 4 companies.
              </p>
            </div>
          </div>

          {/* Visual 4-Company Comparative Bar & Gauge Graph */}
          <CompanyComparisonGraph
            companies={TARGET_COMPANIES.map((company) => {
              const comp = targetsData?.companyBreakdown?.find((c) => c.companyName === company);
              const activeCount = (rosterData?.activeEmployees ?? []).filter(
                (e: any) => (e.companyName || "Realty Smartz") === company
              ).length;
              return {
                name: company,
                activeCount,
                totalTargetRev: comp?.targetRevenue || 0,
                totalAchievedRev: comp?.achievedRevenue || 0,
                totalTargetBookings: comp?.targetBookings || 0,
                totalAchievedBookings: comp?.achievedBookings || 0,
                avgScore: comp?.avgScore || 0,
              };
            })}
          />

          {/* 4 Company Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {TARGET_COMPANIES.map((company) => {
              const compData = targetsData?.companyBreakdown?.find((c) => c.companyName === company) || {
                companyName: company,
                targetsCount: 0,
                targetRevenue: 0,
                achievedRevenue: 0,
                targetVisits: 0,
                achievedVisits: 0,
                targetBookings: 0,
                achievedBookings: 0,
                targetCalls: 0,
                achievedCalls: 0,
                targetLeads: 0,
                achievedLeads: 0,
                avgScore: 0,
                revenueProgressPct: 0,
              };

              return (
                <Card
                  key={company}
                  className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-xs hover:border-sky-300 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-100 text-[#0284C7] font-black text-sm">
                          {company.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-bold text-neutral-900 text-sm">{company}</h3>
                          <span className="text-[11px] text-neutral-400 font-medium">
                            {compData.targetsCount} Active Target Sheets
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
                          Avg Score
                        </span>
                        <span className="text-lg font-black text-[#0284C7]">
                          {compData.avgScore}%
                        </span>
                      </div>
                    </div>

                    {/* Revenue Progress */}
                    <div className="space-y-1.5 p-3 rounded-xl bg-neutral-50/80 border border-neutral-100">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-neutral-500 font-semibold">Revenue Target vs Achieved</span>
                        <strong className="text-emerald-700 font-bold">
                          {formatCurrency(compData.achievedRevenue)} / {formatCurrency(compData.targetRevenue)}
                        </strong>
                      </div>
                      <div className="h-2 w-full rounded-full bg-neutral-200 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-600 transition-all duration-500"
                          style={{ width: `${compData.revenueProgressPct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-neutral-400 font-medium pt-0.5">
                        <span>Revenue Progress</span>
                        <span className="font-bold text-emerald-800">{compData.revenueProgressPct}% Closed</span>
                      </div>
                    </div>

                    {/* Metrics 4-Box Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-xl border border-neutral-100 bg-white">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                          Site Visits
                        </span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <strong className="text-sm font-bold text-neutral-900">{compData.achievedVisits}</strong>
                          <span className="text-[11px] text-neutral-400 font-medium">/ {compData.targetVisits}</span>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl border border-neutral-100 bg-white">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                          Closed Bookings
                        </span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <strong className="text-sm font-bold text-neutral-900">{compData.achievedBookings}</strong>
                          <span className="text-[11px] text-neutral-400 font-medium">/ {compData.targetBookings}</span>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl border border-neutral-100 bg-white">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                          Outbound Calls
                        </span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <strong className="text-sm font-bold text-sky-800">{compData.achievedCalls}</strong>
                          <span className="text-[11px] text-neutral-400 font-medium">/ {compData.targetCalls || "—"}</span>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl border border-neutral-100 bg-white">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                          Qualified Leads
                        </span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <strong className="text-sm font-bold text-sky-800">{compData.achievedLeads}</strong>
                          <span className="text-[11px] text-neutral-400 font-medium">/ {compData.targetLeads || "—"}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between">
                    <button
                      onClick={() => {
                        setSelectedCompany(company);
                        setActiveTab("all_targets");
                      }}
                      className="text-xs font-bold text-[#0284C7] hover:underline flex items-center gap-1"
                    >
                      View All {company} Targets
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openCreateModal(undefined, company)}
                      className="rounded-xl text-[11px] font-bold h-7 gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      Add Target
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Comparative Matrix Table */}
          <Card className="rounded-2xl border-neutral-200/80 bg-white shadow-xs overflow-hidden">
            <div className="p-4 border-b border-neutral-100">
              <h3 className="font-bold text-neutral-900 text-sm">
                4-Company Performance Comparison
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-neutral-50/80 border-b border-neutral-200 text-neutral-500 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Company Entity</th>
                    <th className="py-3 px-4">Active Staff</th>
                    <th className="py-3 px-4">Target Revenue</th>
                    <th className="py-3 px-4">Achieved Revenue</th>
                    <th className="py-3 px-4 text-center">Revenue %</th>
                    <th className="py-3 px-4 text-center">Visits</th>
                    <th className="py-3 px-4 text-center">Bookings</th>
                    <th className="py-3 px-4 text-center">Avg Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {TARGET_COMPANIES.map((company) => {
                    const comp = targetsData?.companyBreakdown?.find((c) => c.companyName === company);
                    return (
                      <tr key={company} className="hover:bg-neutral-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-neutral-900 flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-[#0284C7]" />
                          {company}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-neutral-700">
                          {comp?.targetsCount ?? 0} members
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-neutral-700">
                          {formatCurrency(comp?.targetRevenue ?? 0)}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-emerald-700">
                          {formatCurrency(comp?.achievedRevenue ?? 0)}
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-neutral-900">
                          {comp?.revenueProgressPct ?? 0}%
                        </td>
                        <td className="py-3.5 px-4 text-center font-semibold text-neutral-700">
                          {comp?.achievedVisits ?? 0} / {comp?.targetVisits ?? 0}
                        </td>
                        <td className="py-3.5 px-4 text-center font-semibold text-neutral-700">
                          {comp?.achievedBookings ?? 0} / {comp?.targetBookings ?? 0}
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-[#0284C7]">
                          {comp?.avgScore ?? 0}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 3: TEAM LEADERS & TEAMS */}
      {activeTab === "teams" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-base font-bold text-neutral-900">
                Organization Hierarchy &amp; Team Targets
              </h2>
              <p className="text-xs text-neutral-500">
                Full reporting tree, Team Leader rolled-up targets, and quick reporting updates (Active staff only).
              </p>
            </div>
          </div>

          {/* FULL MULTI-LEVEL ORG HIERARCHY TREE */}
          {(() => {
            const allActiveStaff = rosterData?.activeEmployees ?? [];
            const activeStaff = allActiveStaff.filter(
              (e: any) => selectedCompany === "ALL" || (e.companyName || "Realty Smartz") === selectedCompany
            );
            const allActiveIdSet = new Set(allActiveStaff.map((e: any) => e.id));
            const targetMap = new Map<string, any>();
            (targetsData?.targets ?? []).forEach((t: any) => {
              if (!targetMap.has(t.employeeId)) targetMap.set(t.employeeId, t);
            });
            const childrenMap = new Map<string, any[]>();
            const roots: any[] = [];
            allActiveStaff.forEach((emp: any) => {
              if (emp.managerId && allActiveIdSet.has(emp.managerId)) {
                const arr = childrenMap.get(emp.managerId) || [];
                arr.push(emp);
                childrenMap.set(emp.managerId, arr);
              } else {
                roots.push(emp);
              }
            });
            const managersWithReports = roots.filter((r) => (childrenMap.get(r.id) || []).length > 0);
            const unassignedRoots = roots.filter((r) => (childrenMap.get(r.id) || []).length === 0);

            const calcSubtreeStats = (nodeId: string, seen = new Set<string>()): { count: number; targetRev: number; achievedRev: number; visits: number; targetVisits: number; bookings: number; targetBookings: number } => {
              if (seen.has(nodeId)) return { count: 0, targetRev: 0, achievedRev: 0, visits: 0, targetVisits: 0, bookings: 0, targetBookings: 0 };
              seen.add(nodeId);
              const t = targetMap.get(nodeId);
              let res = {
                count: 1,
                targetRev: t?.targetRevenue || 0,
                achievedRev: t?.currentRevenue || 0,
                visits: t?.currentVisits || 0,
                targetVisits: t?.targetVisits || 0,
                bookings: t?.currentBookings || 0,
                targetBookings: t?.targetBookings || 0,
              };
              for (const child of childrenMap.get(nodeId) || []) {
                const sub = calcSubtreeStats(child.id, seen);
                res.count += sub.count;
                res.targetRev += sub.targetRev;
                res.achievedRev += sub.achievedRev;
                res.visits += sub.visits;
                res.targetVisits += sub.targetVisits;
                res.bookings += sub.bookings;
                res.targetBookings += sub.targetBookings;
              }
              return res;
            };

            const renderHierarchyNode = (emp: any, depth = 0, ancestry = new Set<string>()): any => {
              if (ancestry.has(emp.id)) return null;
              const nextAncestry = new Set(ancestry);
              nextAncestry.add(emp.id);
              const kids = childrenMap.get(emp.id) || [];
              const empTarget = targetMap.get(emp.id);
              const empScore = empTarget?.scorecard?.totalScore ?? 0;
              const rag = getRagMeta(empScore);
              const teamStats = kids.length > 0 ? calcSubtreeStats(emp.id) : null;

              return (
                <div key={emp.id} className={depth > 0 ? "ml-4 sm:ml-6 pl-3 border-l-2 border-sky-200 space-y-2" : "space-y-2"}>
                  <div className="p-2.5 rounded-xl border border-neutral-200 bg-white flex flex-col lg:flex-row lg:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`h-7 w-7 rounded-lg flex items-center justify-center font-bold text-white shrink-0 ${kids.length > 0 ? "bg-[#0284C7]" : "bg-neutral-500"}`}>
                        {emp.firstName?.charAt(0)}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-neutral-900">
                            {emp.firstName} {emp.lastName}
                          </span>
                          <span className="text-[10px] font-mono text-neutral-500">({emp.employeeCode || "RS"})</span>
                          <span className="px-2 py-0.2 rounded-full bg-neutral-100 text-neutral-700 text-[10px] font-semibold">
                            {emp.designation?.title || "Staff"}
                          </span>
                          {kids.length > 0 && (
                            <span className="px-2 py-0.2 rounded-full bg-sky-100 text-[#0284C7] text-[10px] font-bold">
                              Team: {teamStats ? teamStats.count - 1 : kids.length}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-neutral-500 flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                          <span>{emp.companyName || "Realty Smartz"}</span>
                          {empTarget ? (
                            <>
                              <span>Visits: <strong>{empTarget.currentVisits}/{empTarget.targetVisits}</strong></span>
                              <span>Bookings: <strong>{empTarget.currentBookings}/{empTarget.targetBookings}</strong></span>
                              <span>Rev: <strong>{formatCurrency(empTarget.currentRevenue)}</strong></span>
                            </>
                          ) : (
                            <span className="italic text-neutral-400">No personal target</span>
                          )}
                          {teamStats && (
                            <span className="text-[#0284C7] font-semibold">
                              Team Sum → Bookings: {teamStats.bookings}/{teamStats.targetBookings} • Rev: {formatCurrency(teamStats.achievedRev)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${rag.badgeClass}`}>
                        {empScore}%
                      </span>
                      <select
                        value={emp.managerId || ""}
                        disabled={setManagerMutation.isPending}
                        onChange={(e) =>
                          setManagerMutation.mutate({
                            employeeId: emp.id,
                            managerId: e.target.value || null,
                          })
                        }
                        className="h-7 rounded-lg border border-neutral-200 bg-neutral-50 px-2 text-[11px] font-semibold text-neutral-700 max-w-[165px]"
                        title="Assign Reporting Team Leader"
                      >
                        <option value="">No Manager (Top)</option>
                        {(rosterData?.activeEmployees ?? [])
                          .filter((m: any) => m.id !== emp.id)
                          .map((m: any) => (
                            <option key={m.id} value={m.id}>
                              TL: {m.firstName} {m.lastName}
                            </option>
                          ))}
                      </select>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openCreateModal(emp.id, emp.companyName as TargetCompany)}
                        className="h-7 px-2 text-[10px] rounded-lg font-bold border-sky-200 text-[#0284C7]"
                      >
                        {empTarget ? "Update Target" : "+ Target"}
                      </Button>
                    </div>
                  </div>
                  {kids.length > 0 && depth < 5 && (
                    <div className="space-y-2">
                      {kids.map((child: any) => renderHierarchyNode(child, depth + 1, nextAncestry))}
                    </div>
                  )}
                </div>
              );
            };

            return (
              <Card className="rounded-2xl border border-sky-100 bg-sky-50/20 p-4 shadow-xs space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2 border-b border-sky-100 pb-2.5">
                  <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-neutral-900">Organization Hierarchy &amp; Reporting Tree</h3>
                        <span className="px-2.5 py-0.5 rounded-full bg-sky-100 text-[#0284C7] text-[10px] font-extrabold uppercase tracking-wide">
                          Amit Sir / Chhavi Mittal
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-500 mt-0.5">
                        Structured reporting lines: HR Department (Unnati) • Sales TLs (Ayush, Sapna, Soma, Pihu, Pankaj) • Telesales (Mansi)
                      </p>
                  </div>
                  <span className="text-xs font-bold text-[#0284C7]">
                    {activeStaff.length} Active Staff
                  </span>
                </div>

                <div className="space-y-3">
                  {managersWithReports.map((root: any) => renderHierarchyNode(root, 0))}
                </div>

                {unassignedRoots.length > 0 && (
                  <div className="pt-3 border-t border-sky-100 space-y-2">
                    <div className="text-xs font-bold text-neutral-700">
                      Independent / Unassigned Active Staff ({unassignedRoots.length})
                    </div>
                    <div className="space-y-2">
                      {unassignedRoots.map((emp: any) => renderHierarchyNode(emp, 0))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })()}

          {(() => {
            const visibleTLs = (targetsData?.teamLeaders ?? []).filter(
              (tl: any) => selectedCompany === "ALL" || (tl.companyName || "Realty Smartz") === selectedCompany
            );
            return visibleTLs.length > 0 ? (
              <div className="space-y-4">
                {visibleTLs.map((tl: any) => (
                  <Card
                    key={tl.id}
                    className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-xs space-y-4"
                  >
                    {/* TL Header & Aggregate Stats */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-100 pb-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0284C7] text-white font-extrabold text-base shadow-xs">
                          {tl.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-neutral-900 text-base">{tl.name}</h3>
                            <span className="rounded-full bg-sky-100 text-[#0284C7] px-2.5 py-0.5 text-[11px] font-bold">
                              {tl.designation || "Team Leader"}
                            </span>
                            <span className="rounded-full bg-neutral-100 text-neutral-700 px-2.5 py-0.5 text-[11px] font-semibold">
                              {tl.companyName || "Realty Smartz"}
                            </span>
                            <span className="rounded-full bg-neutral-100 text-neutral-600 px-2 py-0.5 text-[11px] font-mono">
                              {tl.employeeCode || "RS"}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-500 mt-0.5">
                            Direct Reports: <strong>{tl.memberCount} members</strong> • Department: {tl.department}
                            {tl.managerName ? ` • Reports to: ${tl.managerName}` : ""}
                          </p>
                        </div>
                      </div>

                      {/* Team Summary Numbers */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="p-2 rounded-xl bg-neutral-50 border border-neutral-200/70 text-center">
                          <span className="text-[10px] text-neutral-400 font-bold uppercase block">Team Revenue</span>
                          <strong className="text-emerald-700 font-bold">
                            {formatCurrency(tl.teamStats.teamAchievedRevenue)}
                          </strong>
                        </div>
                        <div className="p-2 rounded-xl bg-neutral-50 border border-neutral-200/70 text-center">
                          <span className="text-[10px] text-neutral-400 font-bold uppercase block">Team Bookings</span>
                          <strong className="text-neutral-900 font-bold">
                            {tl.teamStats.teamAchievedBookings} / {tl.teamStats.teamTargetBookings}
                          </strong>
                        </div>
                        <div className="p-2 rounded-xl bg-neutral-50 border border-neutral-200/70 text-center">
                          <span className="text-[10px] text-neutral-400 font-bold uppercase block">Team Visits</span>
                          <strong className="text-neutral-900 font-bold">
                            {tl.teamStats.teamAchievedVisits} / {tl.teamStats.teamTargetVisits}
                          </strong>
                        </div>
                        <div className="p-2 rounded-xl bg-sky-50 border border-sky-100 text-center">
                          <span className="text-[10px] text-sky-600 font-bold uppercase block">Team Score</span>
                          <strong className="text-[#0284C7] font-black text-sm">
                            {tl.teamStats.teamAvgScore}%
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Team Members List */}
                    <div>
                      <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wider mb-2">
                        Reporting Members & Individual Target Progress
                      </h4>

                      {tl.members && tl.members.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                          {tl.members.map((member: any) => (
                            <div
                              key={member.id}
                              className="p-3 rounded-xl border border-neutral-200/80 bg-white hover:border-sky-300 transition-all flex flex-col justify-between"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-xs text-neutral-900 truncate">
                                    {member.name}
                                  </span>
                                  <span className="font-mono text-[10px] text-neutral-400">
                                    {member.employeeCode}
                                  </span>
                                </div>
                                <span className="text-[11px] text-neutral-500 block truncate">
                                  {member.designation}
                                </span>

                                {member.hasTarget ? (
                                  <div className="pt-2 space-y-1">
                                    <div className="flex justify-between text-[11px]">
                                      <span className="text-neutral-500">Revenue:</span>
                                      <strong className="text-emerald-700">
                                        {formatCurrency(member.achievedRevenue)} / {formatCurrency(member.targetRevenue)}
                                      </strong>
                                    </div>
                                    <div className="flex justify-between text-[11px]">
                                      <span className="text-neutral-500">Score:</span>
                                      <strong className="text-[#0284C7] font-bold">
                                        {member.score}%
                                      </strong>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="pt-2">
                                    <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-medium inline-block">
                                      No Target Assigned
                                    </span>
                                  </div>
                                )}
                              </div>

                              <div className="mt-3 pt-2 border-t border-neutral-100 flex justify-end">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openCreateModal(member.id, tl.companyName)}
                                  className="h-6 text-[10px] font-bold rounded-lg px-2"
                                >
                                  {member.hasTarget ? "Update Target" : "+ Assign Target"}
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-neutral-400 italic">
                          No team members directly reporting under this team leader yet.
                        </p>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-12 text-center rounded-2xl bg-white border border-neutral-200">
                <Users className="h-10 w-10 text-neutral-300 mx-auto mb-2" />
                <h3 className="font-bold text-neutral-800">No Team Leaders Identified</h3>
                <p className="text-xs text-neutral-500 mt-1">
                  Assign manager roles or &quot;Team Leader&quot; designations to see hierarchical team aggregations.
                </p>
              </Card>
            );
          })()}
        </div>
      )}

      {/* TAB 4: ALL TARGETS (EMPLOYEE-WISE) */}
      {activeTab === "all_targets" && (
        <div className="space-y-4">
          <Card className="rounded-2xl border-neutral-200/80 bg-white p-3.5 shadow-xs">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-400" />
                <Input
                  placeholder="Search by name, ID, or company..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-9 rounded-xl border-neutral-200 text-xs focus:border-[#0284C7]"
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => openCreateModal()}
                  className="bg-[#0284C7] hover:bg-[#0369A1] text-white rounded-xl text-xs font-bold gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New Target Sheet
                </Button>
              </div>
            </div>
          </Card>

          <Card className="rounded-2xl border-neutral-200/80 bg-white shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-neutral-50/80 border-b border-neutral-200 text-neutral-500 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-3">Company</th>
                    <th className="py-3 px-3">Target Title & Period</th>
                    <th className="py-3 px-4">Target Revenue</th>
                    <th className="py-3 px-4">Achieved</th>
                    <th className="py-3 px-3 text-center">Score</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredTargets.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-neutral-400 text-xs">
                        No targets found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredTargets.map((t) => {
                      const score = t.scorecard?.totalScore ?? 0;
                      return (
                        <tr key={t.id} className="hover:bg-neutral-50/80 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 text-[#0284C7] font-bold text-xs">
                                {t.employee.firstName.charAt(0)}
                              </div>
                              <div>
                                <strong className="font-bold text-neutral-900 block">
                                  {t.employee.firstName} {t.employee.lastName}
                                </strong>
                                <span className="text-[10px] text-neutral-400 font-mono">
                                  {t.employee.employeeCode || "RS"} • {t.employee.designation?.title || "Staff"}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="rounded-md bg-sky-50 text-[#0284C7] border border-sky-200 px-2 py-0.5 text-[10px] font-bold">
                              {t.companyName || "Realty Smartz"}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-semibold text-neutral-800 block truncate max-w-[180px]">
                              {t.title}
                            </span>
                            <span className="text-[10px] text-neutral-400">
                              {formatDate(t.startDate)} – {formatDate(t.endDate)}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-semibold text-neutral-700">
                            {formatCurrency(t.targetRevenue || 0)}
                          </td>
                          <td className="py-3 px-4 font-bold text-emerald-700">
                            {formatCurrency(t.currentRevenue || 0)}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="font-black text-sm text-[#0284C7]">
                              {score}%
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${score >= 80
                                  ? "bg-emerald-100 text-emerald-800"
                                  : score >= 50
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                            >
                              {score >= 80 ? "Exceeding" : score >= 50 ? "On Track" : "In Progress"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedEmployeeId(t.employeeId);
                                  setActiveTab("overview");
                                }}
                                className="h-7 px-2 text-[11px] text-[#0284C7] hover:bg-sky-50"
                                title="View Scorecard"
                              >
                                View
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openEditModal(t)}
                                className="h-7 px-2 text-[11px] text-neutral-700 hover:bg-neutral-100"
                                title="Edit Target Sheet"
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  if (confirm("Delete target sheet completely?")) {
                                    deleteMutation.mutate({ id: t.id });
                                  }
                                }}
                                className="h-7 px-2 text-[11px] text-rose-600 hover:bg-rose-50"
                                title="Delete Target Sheet"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 5: ENTITY MAPPING & TEAM LEADER TRANSFER */}
      {activeTab === "mapping" && (
        <div className="space-y-4">
          {mappingFeedback && (
            <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-xs font-semibold text-sky-900 flex items-center justify-between">
              <span>{mappingFeedback}</span>
              <button onClick={() => setMappingFeedback("")} className="text-sky-700 hover:text-sky-900">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Manual Employee-to-Company Entity Mapping */}
            <Card className="lg:col-span-7 rounded-2xl border-neutral-200/90 bg-white p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-3">
                <div>
                  <h2 className="text-sm font-bold text-neutral-900">
                    Company Entity Mapping (Active Staff)
                  </h2>
                  <p className="text-xs text-neutral-500">
                    Select employees and assign them to a company entity.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={mappingCompany}
                    onChange={(e) => setMappingCompany(e.target.value as TargetCompany)}
                    className="h-9 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-bold text-neutral-800 outline-none"
                  >
                    {TARGET_COMPANIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    disabled={selectedMappingIds.length === 0 || assignCompanyMutation.isPending}
                    onClick={() =>
                      assignCompanyMutation.mutate({
                        companyName: mappingCompany,
                        employeeIds: selectedMappingIds,
                      })
                    }
                    className="bg-[#0284C7] hover:bg-[#0369A1] text-white rounded-xl text-xs font-bold"
                  >
                    {assignCompanyMutation.isPending
                      ? "Saving..."
                      : `Assign (${selectedMappingIds.length})`}
                  </Button>
                </div>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-400" />
                <Input
                  placeholder="Search active employees..."
                  value={mappingSearch}
                  onChange={(e) => setMappingSearch(e.target.value)}
                  className="pl-8 h-9 rounded-xl border-neutral-200 text-xs"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Left: Add Employees NOT yet in selected mappingCompany */}
                <div className="space-y-1.5">
                  <div className="text-xs font-bold text-neutral-700">
                    Add to {mappingCompany} (From Other Companies)
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-neutral-100 border border-neutral-200 rounded-xl">
                    {(rosterData?.activeEmployees ?? [])
                      .filter((emp: any) => (emp.companyName || "Realty Smartz") !== mappingCompany)
                      .filter((emp: any) => {
                        if (!mappingSearch.trim()) return true;
                        const q = mappingSearch.toLowerCase();
                        return `${emp.firstName} ${emp.lastName} ${emp.employeeCode || ""}`.toLowerCase().includes(q);
                      })
                      .map((emp: any) => {
                        const checked = selectedMappingIds.includes(emp.id);
                        return (
                          <label
                            key={emp.id}
                            className="flex items-center justify-between gap-2 px-3 py-2 text-xs hover:bg-sky-50/40 cursor-pointer"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedMappingIds((prev) => [...prev, emp.id]);
                                  } else {
                                    setSelectedMappingIds((prev) => prev.filter((id) => id !== emp.id));
                                  }
                                }}
                                className="h-4 w-4 rounded border-neutral-300 accent-[#0284C7]"
                              />
                              <div className="min-w-0">
                                <div className="font-bold text-neutral-900 truncate">
                                  {emp.firstName} {emp.lastName}
                                </div>
                                <div className="text-[11px] text-neutral-500 truncate">
                                  {emp.employeeCode || "RS"} • {emp.designation?.title || "Staff"}
                                </div>
                              </div>
                            </div>
                            <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-600">
                              {emp.companyName || "Realty Smartz"}
                            </span>
                          </label>
                        );
                      })}
                  </div>
                </div>

                {/* Right: Currently Assigned to selected mappingCompany */}
                <div className="space-y-1.5">
                  <div className="text-xs font-bold text-[#0284C7]">
                    Assigned to {mappingCompany} (
                    {(rosterData?.activeEmployees ?? []).filter(
                      (emp: any) => (emp.companyName || "Realty Smartz") === mappingCompany
                    ).length}
                    )
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-neutral-100 border border-sky-200 bg-sky-50/20 rounded-xl">
                    {(rosterData?.activeEmployees ?? [])
                      .filter((emp: any) => (emp.companyName || "Realty Smartz") === mappingCompany)
                      .filter((emp: any) => {
                        if (!mappingSearch.trim()) return true;
                        const q = mappingSearch.toLowerCase();
                        return `${emp.firstName} ${emp.lastName} ${emp.employeeCode || ""}`.toLowerCase().includes(q);
                      })
                      .map((emp: any) => (
                        <div
                          key={emp.id}
                          className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="font-bold text-neutral-900 truncate">
                              {emp.firstName} {emp.lastName}
                            </div>
                            <div className="text-[11px] text-neutral-500 truncate">
                              {emp.employeeCode || "RS"} • {emp.designation?.title || "Staff"}
                            </div>
                          </div>
                          <span className="shrink-0 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-[#0284C7]">
                            {mappingCompany}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </Card>

            {/* Team Leader Transfer Card */}
            <Card className="lg:col-span-5 rounded-2xl border-neutral-200/90 bg-white p-5 shadow-xs space-y-4">
              <div className="border-b border-neutral-100 pb-3">
                <h2 className="text-sm font-bold text-neutral-900">
                  Team Leader Transfer
                </h2>
                <p className="text-xs text-neutral-500">
                  Move active team members from a departing or existing Team Leader to a new Team Leader.
                </p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-neutral-700">From Team Leader</Label>
                  <select
                    value={transferFromId}
                    onChange={(e) => setTransferFromId(e.target.value)}
                    className="w-full h-9 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-800 outline-none"
                  >
                    <option value="">-- Select Active Team Leader --</option>
                    {(rosterData?.activeEmployees ?? [])
                      .filter((emp: any) => (emp.directReports?.length ?? 0) > 0)
                      .map((emp: any) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.firstName} {emp.lastName} ({emp.directReports?.length ?? 0} members) - {emp.designation?.title || "Team Leader"}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-neutral-700">To New Team Leader (Active)</Label>
                  <select
                    value={transferToId}
                    onChange={(e) => setTransferToId(e.target.value)}
                    className="w-full h-9 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-800 outline-none"
                  >
                    <option value="">-- Select New Active TL --</option>
                    {(rosterData?.activeEmployees ?? []).map((emp: any) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName} ({emp.employeeCode || "RS"} • {emp.designation?.title || "Staff"})
                      </option>
                    ))}
                  </select>
                </div>

                <Button
                  type="button"
                  disabled={!transferFromId || !transferToId || transferFromId === transferToId || transferTlMutation.isPending}
                  onClick={() =>
                    transferTlMutation.mutate({
                      fromManagerId: transferFromId,
                      toManagerId: transferToId,
                    })
                  }
                  className="w-full bg-[#0284C7] hover:bg-[#0369A1] text-white rounded-xl text-xs font-bold gap-1.5"
                >
                  <ArrowRightLeft className="h-3.5 w-3.5" />
                  {transferTlMutation.isPending ? "Transferring..." : "Transfer Team & History"}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* CREATE TARGET MODAL */}
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
                  Assign Performance Target Sheet
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
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                {formError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-semibold">
                    {formError}
                  </div>
                )}

                {/* Company & Employee Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-neutral-700">Company Entity *</Label>
                    <select
                      value={formCompany}
                      onChange={(e) => {
                        const nextCompany = e.target.value as TargetCompany;
                        setFormCompany(nextCompany);
                        setFormEmployeeId("");
                      }}
                      className="w-full h-9 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-800 outline-none focus:border-[#0284C7]"
                    >
                      {TARGET_COMPANIES.map((c) => {
                        const count = (rosterData?.activeEmployees ?? []).filter(
                          (emp: any) => (emp.companyName || "Realty Smartz") === c
                        ).length;
                        return (
                          <option key={c} value={c}>
                            {c} ({count} active)
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-neutral-700">
                      Select Active Employee ({formCompany}) *
                    </Label>
                    {(() => {
                      const companyEmployees = (rosterData?.activeEmployees ?? [])
                        .filter(
                          (emp: any) => (emp.companyName || "Realty Smartz") === formCompany
                        )
                        .filter((emp: any) => {
                          if (emp.role === "ADMIN") return false;
                          if (
                            emp.employeeCode === "RS-0001" ||
                            emp.employeeCode === "SMA-0001" ||
                            emp.employeeCode === "RS-3215"
                          )
                            return false;
                          const name = `${emp.firstName || ""} ${emp.lastName || ""}`.toLowerCase();
                          const title = (emp.designation?.title || "").toLowerCase();
                          if (name.includes("hr admin") || title.includes("admin manager")) return false;
                          return true;
                        });
                      return (
                        <>
                          <select
                            value={formEmployeeId}
                            onChange={(e) => handleEmployeeSelect(e.target.value)}
                            required
                            className="w-full h-9 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-800 outline-none focus:border-[#0284C7]"
                          >
                            <option value="">
                              {companyEmployees.length === 0
                                ? `-- No active employees in ${formCompany} --`
                                : `-- Choose Employee (${companyEmployees.length}) --`}
                            </option>
                            {companyEmployees.map((emp: any) => (
                              <option key={emp.id} value={emp.id}>
                                {emp.firstName} {emp.lastName} ({emp.employeeCode || "RS"}) - {emp.designation?.title || emp.department?.name || "Staff"}
                              </option>
                            ))}
                          </select>
                          {companyEmployees.length === 0 && (
                            <p className="text-[11px] text-amber-700">
                              Map employees to {formCompany} first in the &quot;Entity Mapping &amp; TL Transfer&quot; tab.
                            </p>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Role Deliverables Preset Selector */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-neutral-700">Role Deliverables Preset</Label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      { key: "SALES", label: "Sales (20/30/40)" },
                      { key: "TELESALES", label: "Telesales (30/40/20)" },
                      { key: "TEAM_LEADER_SALES", label: "TL Sales (40/50)" },
                      { key: "TEAM_LEADER_PRESALES", label: "TL Presales (30/60)" },
                      { key: "DIRECT_SALES", label: "Direct Sales - Chhavi (40/50)" },
                      { key: "HR", label: "HR" },
                      { key: "IT", label: "IT" },
                    ].map((preset) => (
                      <button
                        key={preset.key}
                        type="button"
                        onClick={() => applyPreset(preset.key as any)}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition-all border ${formRolePreset === preset.key
                            ? "bg-[#0284C7] text-white border-[#0284C7] shadow-xs"
                            : "bg-neutral-50 text-neutral-600 border-neutral-200 hover:bg-neutral-100"
                          }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Target Title & Period Type */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label className="text-xs font-semibold text-neutral-700">Target Sheet Title *</Label>
                    <Input
                      placeholder="e.g. November 2026 Sales Target Sheet"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      required
                      className="rounded-xl border-neutral-200 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-neutral-700">Summary Period *</Label>
                    <select
                      value={formPeriodType}
                      onChange={(e) => setFormPeriodType(e.target.value as any)}
                      className="w-full h-9 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-800 outline-none focus:border-[#0284C7]"
                    >
                      <option value="WEEKLY">Weekly</option>
                      <option value="MONTHLY">Monthly</option>
                      <option value="QUARTERLY">Quarterly</option>
                      <option value="YEARLY">Yearly</option>
                    </select>
                  </div>
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

                {/* Scorecard Deliverables List */}
                <div className="space-y-3 pt-2 border-t border-neutral-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-neutral-800">
                        Deliverable KPIs & Weightage ({formTotalItemsWeight}% assigned + 10% Attendance)
                      </h4>
                      <p className="text-[11px] text-neutral-400">Total weight must equal exactly 100%</p>
                    </div>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${formTotalScorecardWeight === 100
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800"
                        }`}
                    >
                      Total: {formTotalScorecardWeight}%
                    </span>
                  </div>

                  <div className="space-y-2">
                    {formItems.map((item, idx) => (
                      <div key={idx} className="p-3 rounded-xl border border-neutral-200 bg-neutral-50/50 space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <Input
                            placeholder="KPI Title"
                            value={item.title}
                            onChange={(e) => {
                              const updated = [...formItems];
                              updated[idx].title = e.target.value;
                              setFormItems(updated);
                            }}
                            className="h-8 rounded-lg border-neutral-200 text-xs font-semibold flex-1"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const updated = formItems.filter((_, i) => i !== idx);
                              setFormItems(updated);
                            }}
                            className="text-neutral-400 hover:text-rose-600 p-1"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-[10px] text-neutral-500 font-bold">Target Value</Label>
                            <Input
                              type="number"
                              min="0"
                              value={item.targetValue}
                              onChange={(e) => {
                                const updated = [...formItems];
                                updated[idx].targetValue = parseFloat(e.target.value) || 0;
                                setFormItems(updated);
                              }}
                              className="h-8 rounded-lg border-neutral-200 text-xs"
                            />
                          </div>

                          <div>
                            <Label className="text-[10px] text-neutral-500 font-bold">Unit</Label>
                            <Input
                              value={item.unit}
                              onChange={(e) => {
                                const updated = [...formItems];
                                updated[idx].unit = e.target.value;
                                setFormItems(updated);
                              }}
                              className="h-8 rounded-lg border-neutral-200 text-xs"
                            />
                          </div>

                          <div>
                            <Label className="text-[10px] text-neutral-500 font-bold">Weight (%)</Label>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              value={item.weightPercent}
                              onChange={(e) => {
                                const updated = [...formItems];
                                updated[idx].weightPercent = parseFloat(e.target.value) || 0;
                                setFormItems(updated);
                              }}
                              className="h-8 rounded-lg border-neutral-200 text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    ))}

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setFormItems([
                          ...formItems,
                          {
                            title: "New Deliverable",
                            category: "SALES",
                            targetValue: 5,
                            unit: "Tasks",
                            weightPercent: 10,
                          },
                        ])
                      }
                      className="w-full text-xs font-bold rounded-xl h-8 border-dashed border-neutral-300 text-neutral-600 hover:bg-neutral-100"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add Another Deliverable
                    </Button>
                  </div>
                </div>

                {/* Incentives */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-neutral-100">
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
                  {createMutation.isPending ? "Assigning..." : "Assign Scorecard Target"}
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
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                {formError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-semibold">
                    {formError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-neutral-700">Company Entity *</Label>
                    <select
                      value={formCompany}
                      onChange={(e) => setFormCompany(e.target.value as TargetCompany)}
                      className="w-full h-9 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-800 outline-none focus:border-[#0284C7]"
                    >
                      {TARGET_COMPANIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-neutral-700">Target Title *</Label>
                    <Input
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      required
                      className="rounded-xl border-neutral-200 text-xs"
                    />
                  </div>
                </div>

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

                {/* Deliverables */}
                <div className="space-y-3 pt-2 border-t border-neutral-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-neutral-800">
                        Deliverable KPIs & Weightage ({formTotalItemsWeight}% + 10% Attendance)
                      </h4>
                      <p className="text-[11px] text-neutral-400">Total weight must equal 100%</p>
                    </div>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${formTotalScorecardWeight === 100
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800"
                        }`}
                    >
                      Total: {formTotalScorecardWeight}%
                    </span>
                  </div>

                  <div className="space-y-2">
                    {formItems.map((item, idx) => (
                      <div key={idx} className="p-3 rounded-xl border border-neutral-200 bg-neutral-50/50 space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <Input
                            placeholder="KPI Title"
                            value={item.title}
                            onChange={(e) => {
                              const updated = [...formItems];
                              updated[idx].title = e.target.value;
                              setFormItems(updated);
                            }}
                            className="h-8 rounded-lg border-neutral-200 text-xs font-semibold flex-1"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const updated = formItems.filter((_, i) => i !== idx);
                              setFormItems(updated);
                            }}
                            className="text-neutral-400 hover:text-rose-600 p-1"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-[10px] text-neutral-500 font-bold">Target Value</Label>
                            <Input
                              type="number"
                              min="0"
                              value={item.targetValue}
                              onChange={(e) => {
                                const updated = [...formItems];
                                updated[idx].targetValue = parseFloat(e.target.value) || 0;
                                setFormItems(updated);
                              }}
                              className="h-8 rounded-lg border-neutral-200 text-xs"
                            />
                          </div>

                          <div>
                            <Label className="text-[10px] text-neutral-500 font-bold">Unit</Label>
                            <Input
                              value={item.unit}
                              onChange={(e) => {
                                const updated = [...formItems];
                                updated[idx].unit = e.target.value;
                                setFormItems(updated);
                              }}
                              className="h-8 rounded-lg border-neutral-200 text-xs"
                            />
                          </div>

                          <div>
                            <Label className="text-[10px] text-neutral-500 font-bold">Weight (%)</Label>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              value={item.weightPercent}
                              onChange={(e) => {
                                const updated = [...formItems];
                                updated[idx].weightPercent = parseFloat(e.target.value) || 0;
                                setFormItems(updated);
                              }}
                              className="h-8 rounded-lg border-neutral-200 text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    ))}

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setFormItems([
                          ...formItems,
                          {
                            title: "New Deliverable",
                            category: "SALES",
                            targetValue: 5,
                            unit: "Tasks",
                            weightPercent: 10,
                          },
                        ])
                      }
                      className="w-full text-xs font-bold rounded-xl h-8 border-dashed border-neutral-300 text-neutral-600 hover:bg-neutral-100"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add Another Deliverable
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-neutral-100">
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
              </div>

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
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VERIFICATIONS MODAL */}
      {showVerificationModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6 backdrop-blur-xs"
          onClick={() => setShowVerificationModal(false)}
        >
          <div
            className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 flex items-center justify-between border-b border-neutral-100 p-4 sm:p-5 bg-white">
              <div className="flex items-center gap-2">
                <FileCheck2 className="h-5 w-5 text-[#0284C7]" />
                <h3 className="font-bold text-neutral-900 text-base">
                  Real-time Verification Queue ({pendingCount})
                </h3>
              </div>
              <button
                onClick={() => setShowVerificationModal(false)}
                className="text-neutral-400 hover:text-neutral-600 rounded-lg p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {pendingVerifications && pendingVerifications.length > 0 ? (
                <div className="space-y-3">
                  {pendingVerifications.map((act: any) => (
                    <div
                      key={act.id}
                      className="p-4 rounded-xl border border-neutral-200/80 bg-white hover:border-sky-300 transition-colors space-y-3"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-neutral-900">
                              {act.employee?.firstName} {act.employee?.lastName}
                            </span>
                            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-mono text-neutral-600">
                              {act.employee?.employeeCode}
                            </span>
                            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-[#0284C7]">
                              {act.activityType}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-600 font-medium">
                            {act.title || act.targetItem?.title || "Deliverable submission"}
                          </p>
                          <div className="text-[11px] text-neutral-400 flex items-center gap-3">
                            <span>Date: {formatDate(act.activityDate)}</span>
                            {act.clientName && <span>Client: {act.clientName}</span>}
                            {act.projectName && <span>Project: {act.projectName}</span>}
                            {act.revenueAmount > 0 && (
                              <strong className="text-emerald-700">
                                Value: {formatCurrency(act.revenueAmount)}
                              </strong>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            size="sm"
                            disabled={verifyActivityMutation.isPending}
                            onClick={() =>
                              verifyActivityMutation.mutate({
                                activityId: act.id,
                                action: "APPROVE",
                              })
                            }
                            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold h-8 px-3 gap-1"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={verifyActivityMutation.isPending}
                            onClick={() => setRejectingActivityId(act.id)}
                            className="text-rose-600 hover:bg-rose-50 border-rose-200 rounded-xl text-xs font-bold h-8 px-3 gap-1"
                          >
                            <X className="h-3.5 w-3.5" />
                            Reject
                          </Button>
                        </div>
                      </div>

                      {rejectingActivityId === act.id && (
                        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 space-y-2 text-xs">
                          <Label className="font-bold text-rose-900">Rejection Reason</Label>
                          <Input
                            placeholder="State reason for rejection..."
                            value={rejectionReasonInput}
                            onChange={(e) => setRejectionReasonInput(e.target.value)}
                            className="h-8 rounded-lg bg-white border-rose-300 text-xs"
                          />
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setRejectingActivityId(null);
                                setRejectionReasonInput("");
                              }}
                              className="h-7 text-xs"
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={() =>
                                verifyActivityMutation.mutate({
                                  activityId: act.id,
                                  action: "REJECT",
                                  rejectionReason: rejectionReasonInput,
                                })
                              }
                              className="bg-rose-600 hover:bg-rose-700 text-white h-7 text-xs font-bold rounded-lg"
                            >
                              Confirm Rejection
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center space-y-2">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
                  <h4 className="font-bold text-neutral-800 text-sm">All Caught Up!</h4>
                  <p className="text-xs text-neutral-400">
                    There are no pending deliverable submissions waiting for verification.
                  </p>
                </div>
              )}
            </div>

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

      {/* SYNC TO PAYROLL MODAL */}
      {showSyncModal && selectedTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6 backdrop-blur-xs"
          onClick={() => setShowSyncModal(false)}
        >
          <div
            className="relative w-full max-w-md flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 flex items-center justify-between border-b border-neutral-100 p-4 sm:p-5 bg-white">
              <div className="flex items-center gap-2">
                <Banknote className="h-5 w-5 text-emerald-600" />
                <h3 className="font-bold text-neutral-900 text-base">
                  Credit Bonus to Payroll
                </h3>
              </div>
              <button
                onClick={() => setShowSyncModal(false)}
                className="text-neutral-400 hover:text-neutral-600 rounded-lg p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSyncPayrollSubmit}>
              <div className="p-4 sm:p-6 space-y-3">
                {syncFeedback && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold">
                    {syncFeedback}
                  </div>
                )}

                <p className="text-xs text-neutral-600">
                  Credit performance incentive for{" "}
                  <strong>
                    {selectedTarget.employee.firstName} {selectedTarget.employee.lastName}
                  </strong>{" "}
                  into payroll adjustments.
                </p>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-neutral-700">Bonus Amount (₹ INR)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={customBonusAmount}
                    onChange={(e) => setCustomBonusAmount(e.target.value)}
                    required
                    className="rounded-xl border-neutral-200 text-sm font-bold text-emerald-800"
                  />
                </div>
              </div>

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
                  {syncBonusMutation.isPending ? "Crediting..." : "Confirm & Sync"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
