"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "@/lib/toast";
import type { EmployeePayrollRow, PayrollSettings } from "../services/salaryCalculator";

interface EmployeeSalaryBankItem {
  employeeId: string;
  name: string;
  employeeCode: string;
  department: string;
  email: string;
  phone: string | null;
  monthlyGross: number;
  deductionsFixed: number;
  hasSalary: boolean;
  hasBankDetails: boolean;
  accountHolderName: string;
  accountNumberMasked: string;
  ifsc: string;
  bankName: string;
  upiId: string;
  isVerified: boolean;
}

interface HolidayItem {
  id: string;
  date: string;
  name: string;
}

interface CompanyAccountInfo {
  providerName: string;
  maskedAccountNumber: string;
  isSandbox: boolean;
}

export function AdminPayrollScreen() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [activeTab, setActiveTab] = useState<"payroll" | "salaries" | "settings" | "holidays">("payroll");

  // Company Account info
  const [companyAccount, setCompanyAccount] = useState<CompanyAccountInfo | null>(null);

  // Data states
  const [payrollRows, setPayrollRows] = useState<EmployeePayrollRow[]>([]);
  const [isPayrollLoading, setIsPayrollLoading] = useState(false);

  const [employees, setEmployees] = useState<EmployeeSalaryBankItem[]>([]);
  const [isEmployeesLoading, setIsEmployeesLoading] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");

  const [settings, setSettings] = useState<PayrollSettings | null>(null);
  const [isSettingsLoading, setIsSettingsLoading] = useState(false);

  const [holidays, setHolidays] = useState<HolidayItem[]>([]);
  const [isHolidaysLoading, setIsHolidaysLoading] = useState(false);

  // Action pending states
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isInitiatingPayout, setIsInitiatingPayout] = useState(false);
  const [retryingEmpId, setRetryingEmpId] = useState<string | null>(null);
  const [isSavingSalaryBank, setIsSavingSalaryBank] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isAddingHoliday, setIsAddingHoliday] = useState(false);
  const [isAddingAdj, setIsAddingAdj] = useState(false);

  // Payout confirmation modal state
  const [showPayoutModal, setShowPayoutModal] = useState(false);

  // Salary & Bank Details Modal state
  const [editingEmp, setEditingEmp] = useState<EmployeeSalaryBankItem | null>(null);
  const [modalGross, setModalGross] = useState<string>("0");
  const [modalFixedDed, setModalFixedDed] = useState<string>("0");
  const [modalHolderName, setModalHolderName] = useState("");
  const [modalAccountNum, setModalAccountNum] = useState("");
  const [modalConfirmAccountNum, setModalConfirmAccountNum] = useState("");
  const [modalIFSC, setModalIFSC] = useState("");
  const [modalBankName, setModalBankName] = useState("");
  const [modalUpiId, setModalUpiId] = useState("");

  // Adjustment Modal state
  const [adjEmpId, setAdjEmpId] = useState<string | null>(null);
  const [adjType, setAdjType] = useState<"bonus" | "deduction">("bonus");
  const [adjAmount, setAdjAmount] = useState<number>(0);
  const [adjRemark, setAdjRemark] = useState("");

  // Holiday state
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayName, setNewHolidayName] = useState("");

  // Fetch Company Account Info
  const fetchCompanyAccount = useCallback(async () => {
    try {
      const res = await fetch("/api/payroll?action=get-company-account");
      const data = await res.json();
      if (res.ok && data.companyAccount) {
        setCompanyAccount(data.companyAccount);
      }
    } catch {
      // Ignore
    }
  }, []);

  // Fetch Payroll View
  const fetchPayroll = useCallback(async (m: number, y: number) => {
    setIsPayrollLoading(true);
    try {
      const res = await fetch(`/api/payroll?action=view-month&month=${m}&year=${y}`);
      const data = await res.json();
      if (res.ok) {
        setPayrollRows(data.rows || []);
      } else {
        toast("error", data.error || "Failed to load payroll");
      }
    } catch {
      toast("error", "Network error while loading payroll");
    } finally {
      setIsPayrollLoading(false);
    }
  }, []);

  // Fetch Salaries & Bank details
  const fetchSalaries = useCallback(async () => {
    setIsEmployeesLoading(true);
    try {
      const res = await fetch("/api/payroll?action=get-salaries");
      const data = await res.json();
      if (res.ok) {
        setEmployees(data.employees || []);
      } else {
        toast("error", data.error || "Failed to load employee list");
      }
    } catch {
      toast("error", "Network error loading employee details");
    } finally {
      setIsEmployeesLoading(false);
    }
  }, []);

  // Fetch Settings
  const fetchSettings = useCallback(async () => {
    setIsSettingsLoading(true);
    try {
      const res = await fetch("/api/payroll?action=get-settings");
      const data = await res.json();
      if (res.ok) {
        setSettings(data.settings);
      }
    } finally {
      setIsSettingsLoading(false);
    }
  }, []);

  // Fetch Holidays
  const fetchHolidays = useCallback(async () => {
    setIsHolidaysLoading(true);
    try {
      const res = await fetch("/api/payroll?action=get-holidays");
      const data = await res.json();
      if (res.ok) {
        setHolidays(data.holidays || []);
      }
    } finally {
      setIsHolidaysLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCompanyAccount();
    void fetchPayroll(selectedMonth, selectedYear);
    void fetchSalaries();
    void fetchSettings();
    void fetchHolidays();
  }, [fetchCompanyAccount, fetchPayroll, fetchSalaries, fetchSettings, fetchHolidays, selectedMonth, selectedYear]);

  // Generate Month
  async function handleGenerate() {
    setIsGenerating(true);
    try {
      const res = await fetch("/api/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate-month",
          month: selectedMonth,
          year: selectedYear,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast("success", `Generated payroll for ${selectedMonth}/${selectedYear}`);
        setPayrollRows(data.rows || []);
      } else {
        toast("error", data.error || "Failed to generate payroll");
      }
    } catch {
      toast("error", "Network error generating payroll");
    } finally {
      setIsGenerating(false);
    }
  }

  // Finalize Month
  async function handleFinalize() {
    if (!window.confirm(`Finalize and lock payroll for ${selectedMonth}/${selectedYear}? Figures will be locked.`)) {
      return;
    }
    setIsFinalizing(true);
    try {
      const res = await fetch("/api/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "finalize-month",
          month: selectedMonth,
          year: selectedYear,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast("success", `Payroll finalized and locked (${data.count} employees)`);
        void fetchPayroll(selectedMonth, selectedYear);
      } else {
        toast("error", data.error || "Failed to finalize payroll");
      }
    } catch {
      toast("error", "Network error finalizing payroll");
    } finally {
      setIsFinalizing(false);
    }
  }

  // Payout Initiation (After Confirmation Modal)
  async function handleConfirmPayout() {
    setIsInitiatingPayout(true);
    try {
      const res = await fetch("/api/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "initiate-payout",
          month: selectedMonth,
          year: selectedYear,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowPayoutModal(false);
        const modeText = data.isSandbox ? "(Test / Sandbox Mode)" : "(Live)";
        toast("success", `Payout initiated for ${data.processedCount} employees ${modeText}`);
        void fetchPayroll(selectedMonth, selectedYear);
      } else {
        toast("error", data.error || "Failed to initiate payout");
      }
    } catch {
      toast("error", "Network error during payout initiation");
    } finally {
      setIsInitiatingPayout(false);
    }
  }

  // Retry Failed Payout
  async function handleRetryPayout(employeeId: string) {
    setRetryingEmpId(employeeId);
    try {
      const res = await fetch("/api/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "retry-payout",
          employeeId,
          month: selectedMonth,
          year: selectedYear,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast("success", "Payout retried successfully");
        void fetchPayroll(selectedMonth, selectedYear);
      } else {
        toast("error", data.error || "Retry failed");
      }
    } catch {
      toast("error", "Network error while retrying payout");
    } finally {
      setRetryingEmpId(null);
    }
  }

  // Save Employee Salary & Bank Details
  async function handleSaveSalaryAndBank(e: React.FormEvent) {
    e.preventDefault();
    if (!editingEmp) return;

    const gross = Number(modalGross) || 0;
    const fixedDed = Number(modalFixedDed) || 0;

    setIsSavingSalaryBank(true);
    try {
      // 1. Save Salary
      const salRes = await fetch("/api/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set-salary",
          employeeId: editingEmp.employeeId,
          monthlyGross: gross,
          deductionsFixed: fixedDed,
        }),
      });
      if (!salRes.ok) {
        const d = await salRes.json();
        throw new Error(d.error || "Failed to save salary");
      }

      // 2. Save Bank Details if entered
      if (modalAccountNum.trim() || modalIFSC.trim()) {
        const bankRes = await fetch("/api/payroll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "set-bank-details",
            employeeId: editingEmp.employeeId,
            accountHolderName: modalHolderName.trim() || editingEmp.name,
            accountNumber: modalAccountNum.trim(),
            confirmAccountNumber: modalConfirmAccountNum.trim(),
            ifsc: modalIFSC.trim().toUpperCase(),
            bankName: modalBankName.trim(),
            upiId: modalUpiId.trim() || null,
          }),
        });
        const bankData = await bankRes.json();
        if (!bankRes.ok) {
          throw new Error(bankData.error || "Failed to save bank details");
        }
      }

      toast("success", `Updated details for ${editingEmp.name}`);
      setEditingEmp(null);
      void fetchSalaries();
      void fetchPayroll(selectedMonth, selectedYear);
    } catch (err: any) {
      toast("error", err.message || "Failed to save details");
    } finally {
      setIsSavingSalaryBank(false);
    }
  }

  function openEditModal(emp: EmployeeSalaryBankItem) {
    setEditingEmp(emp);
    setModalGross(String(emp.monthlyGross || 0));
    setModalFixedDed(String(emp.deductionsFixed || 0));
    setModalHolderName(emp.accountHolderName || emp.name);
    setModalAccountNum("");
    setModalConfirmAccountNum("");
    setModalIFSC(emp.ifsc || "");
    setModalBankName(emp.bankName || "");
    setModalUpiId(emp.upiId || "");
  }

  // Add Adjustment
  async function handleAddAdjustment() {
    if (!adjEmpId || adjAmount <= 0) return;
    setIsAddingAdj(true);
    try {
      const res = await fetch("/api/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add-adjustment",
          employeeId: adjEmpId,
          month: selectedMonth,
          year: selectedYear,
          type: adjType,
          amount: adjAmount,
          remark: adjRemark,
        }),
      });
      if (res.ok) {
        toast("success", "Adjustment added");
        setAdjEmpId(null);
        setAdjAmount(0);
        setAdjRemark("");
        void fetchPayroll(selectedMonth, selectedYear);
      } else {
        const data = await res.json();
        toast("error", data.error || "Failed to add adjustment");
      }
    } catch {
      toast("error", "Network error adding adjustment");
    } finally {
      setIsAddingAdj(false);
    }
  }

  // Add Holiday
  async function handleAddHoliday(e: React.FormEvent) {
    e.preventDefault();
    if (!newHolidayDate || !newHolidayName) return;
    setIsAddingHoliday(true);
    try {
      const res = await fetch("/api/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add-holiday",
          date: newHolidayDate,
          name: newHolidayName,
        }),
      });
      if (res.ok) {
        toast("success", "Holiday added");
        setNewHolidayDate("");
        setNewHolidayName("");
        void fetchHolidays();
      } else {
        const data = await res.json();
        toast("error", data.error || "Failed to add holiday");
      }
    } catch {
      toast("error", "Error adding holiday");
    } finally {
      setIsAddingHoliday(false);
    }
  }

  // Delete Holiday
  async function handleDeleteHoliday(id: string) {
    try {
      const res = await fetch("/api/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete-holiday", id }),
      });
      if (res.ok) {
        toast("success", "Holiday removed");
        void fetchHolidays();
      }
    } catch {
      toast("error", "Error removing holiday");
    }
  }

  // Save Settings
  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setIsSavingSettings(true);
    try {
      const res = await fetch("/api/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-settings",
          ...settings,
        }),
      });
      if (res.ok) {
        toast("success", "Payroll settings saved");
      } else {
        toast("error", "Failed to save settings");
      }
    } catch {
      toast("error", "Error saving settings");
    } finally {
      setIsSavingSettings(false);
    }
  }

  const isFinalized = payrollRows.length > 0 && payrollRows[0].status === "finalized";

  // Standard CSV Export
  function exportCSV() {
    if (payrollRows.length === 0) {
      toast("error", "No payroll data to export");
      return;
    }
    const headers = [
      "Employee Code",
      "Employee Name",
      "Department",
      "Month",
      "Year",
      "Total Days",
      "Present Days",
      "Half Days",
      "Absent Days",
      "Late Marks",
      "Weekly Offs",
      "Holidays",
      "Paid Days",
      "Monthly Gross",
      "Per Day Salary",
      "Gross Payable",
      "Fixed Deductions",
      "Manual Deductions",
      "Additions",
      "Net Salary",
      "Needs Review",
      "Status",
      "Payout Status",
    ];

    const rows = payrollRows.map((r) => [
      `"${r.employee_code}"`,
      `"${r.name.replace(/"/g, '""')}"`,
      `"${r.department}"`,
      r.month,
      r.year,
      r.total_days_in_month,
      r.present_days,
      r.half_days,
      r.absent_days,
      r.late_marks,
      r.weekly_off_days,
      r.holiday_days,
      r.paid_days,
      r.monthly_gross,
      r.per_day_salary,
      r.gross_payable,
      r.fixed_deductions,
      r.manual_deductions,
      r.additions,
      r.net_salary,
      r.needs_review ? "Yes" : "No",
      r.status,
      r.payout_status || "unpaid",
    ]);

    const csvContent = [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Payroll_${selectedMonth}_${selectedYear}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  // Bank File Export
  function exportBankFile() {
    window.open(`/api/payroll?action=export-bank-file&month=${selectedMonth}&year=${selectedYear}`, "_blank");
  }

  // Filtered employees for Salaries & Bank Tab
  const filteredEmployees = useMemo(() => {
    if (!employeeSearch.trim()) return employees;
    const q = employeeSearch.toLowerCase();
    return employees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.employeeCode.toLowerCase().includes(q) ||
        e.department.toLowerCase().includes(q)
    );
  }, [employees, employeeSearch]);

  // Statistics for Payout Modal
  const payoutStats = useMemo(() => {
    let totalNet = 0;
    let eligibleCount = 0;
    let skippedCount = 0;
    const skippedDetails: { name: string; reason: string }[] = [];

    for (const r of payrollRows) {
      if (r.net_salary <= 0) {
        skippedCount++;
        skippedDetails.push({ name: r.name, reason: "Zero net salary" });
      } else if (!r.has_bank_details) {
        skippedCount++;
        skippedDetails.push({ name: r.name, reason: "Missing bank details" });
      } else {
        totalNet += r.net_salary;
        eligibleCount++;
      }
    }

    return { totalNet, eligibleCount, skippedCount, skippedDetails };
  }, [payrollRows]);

  const totalPayrollPayable = useMemo(() => {
    return payrollRows.reduce((sum, r) => sum + r.net_salary, 0);
  }, [payrollRows]);

  const paidCount = useMemo(() => {
    return payrollRows.filter((r) => r.payout_status === "paid").length;
  }, [payrollRows]);

  const failedCount = useMemo(() => {
    return payrollRows.filter((r) => r.payout_status === "failed").length;
  }, [payrollRows]);

  return (
    <div className="space-y-4 max-w-full overflow-x-hidden">
      {/* Top Header & Read-Only Company Account Bar */}
      <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-neutral-900 tracking-tight">Payroll Management</h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              Attendance-based salary calculation, bank account verification, and automated payouts.
            </p>
          </div>

          {/* Company Payout Account Info (Read-only) */}
          <div className="bg-neutral-50 rounded-lg border border-neutral-200 px-3 py-2 flex items-center gap-3">
            <div>
              <div className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                Payout Account ({companyAccount?.providerName || "RazorpayX"})
              </div>
              <div className="text-xs font-mono font-medium text-neutral-800">
                A/C: {companyAccount?.maskedAccountNumber || "Not configured"}
              </div>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                companyAccount?.isSandbox
                  ? "bg-amber-100 text-amber-800 border border-amber-300"
                  : "bg-emerald-100 text-emerald-800 border border-emerald-300"
              }`}
            >
              {companyAccount?.isSandbox ? "SANDBOX MODE" : "LIVE ACCOUNT"}
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 mt-4 border-b border-neutral-200 text-xs font-medium overflow-x-auto">
          <button
            onClick={() => setActiveTab("payroll")}
            className={`px-3 py-2 border-b-2 whitespace-nowrap transition-colors ${
              activeTab === "payroll"
                ? "border-neutral-900 text-neutral-900 font-semibold"
                : "border-transparent text-neutral-500 hover:text-neutral-700"
            }`}
          >
            Payroll Runs
          </button>
          <button
            onClick={() => setActiveTab("salaries")}
            className={`px-3 py-2 border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeTab === "salaries"
                ? "border-neutral-900 text-neutral-900 font-semibold"
                : "border-transparent text-neutral-500 hover:text-neutral-700"
            }`}
          >
            <span>Salaries &amp; Bank Details</span>
            <span className="px-1.5 py-0.2 bg-neutral-100 text-neutral-600 rounded-full text-[10px]">
              {employees.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`px-3 py-2 border-b-2 whitespace-nowrap transition-colors ${
              activeTab === "settings"
                ? "border-neutral-900 text-neutral-900 font-semibold"
                : "border-transparent text-neutral-500 hover:text-neutral-700"
            }`}
          >
            Policy Settings
          </button>
          <button
            onClick={() => setActiveTab("holidays")}
            className={`px-3 py-2 border-b-2 whitespace-nowrap transition-colors ${
              activeTab === "holidays"
                ? "border-neutral-900 text-neutral-900 font-semibold"
                : "border-transparent text-neutral-500 hover:text-neutral-700"
            }`}
          >
            Paid Holidays
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: PAYROLL RUNS */}
      {/* ========================================================================= */}
      {activeTab === "payroll" && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="text-xs bg-white border border-neutral-300 rounded-lg px-2.5 py-1.5 font-medium"
              >
                {[
                  "January", "February", "March", "April", "May", "June",
                  "July", "August", "September", "October", "November", "December",
                ].map((name, i) => (
                  <option key={i + 1} value={i + 1}>
                    {name}
                  </option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="text-xs bg-white border border-neutral-300 rounded-lg px-2.5 py-1.5 font-medium"
              >
                {[2024, 2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>

              <button
                onClick={handleGenerate}
                disabled={isGenerating || isPayrollLoading}
                className="text-xs bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-white font-medium px-3 py-1.5 rounded-lg transition-colors"
              >
                {isGenerating ? "Calculating..." : "Generate Payroll"}
              </button>

              {!isFinalized ? (
                <button
                  onClick={handleFinalize}
                  disabled={isFinalizing || payrollRows.length === 0}
                  className="text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium px-3 py-1.5 rounded-lg transition-colors"
                >
                  {isFinalizing ? "Locking..." : "Finalize"}
                </button>
              ) : (
                <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                  Finalized (Locked)
                </span>
              )}
            </div>

            {/* Right Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {isFinalized && (
                <button
                  onClick={() => setShowPayoutModal(true)}
                  disabled={payrollRows.length === 0}
                  className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-3 py-1.5 rounded-lg shadow-2xs transition-colors"
                >
                  Pay Salaries
                </button>
              )}

              <button
                onClick={exportCSV}
                disabled={payrollRows.length === 0}
                className="text-xs border border-neutral-300 hover:bg-neutral-50 disabled:opacity-50 text-neutral-700 font-medium px-3 py-1.5 rounded-lg transition-colors"
              >
                Export CSV
              </button>

              <button
                onClick={exportBankFile}
                disabled={payrollRows.length === 0}
                className="text-xs border border-neutral-300 hover:bg-neutral-50 disabled:opacity-50 text-neutral-700 font-medium px-3 py-1.5 rounded-lg transition-colors"
                title="Download bulk payment CSV for bank portal upload"
              >
                Bank File Export
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          {payrollRows.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white rounded-xl border border-neutral-200 p-3 shadow-2xs">
                <div className="text-[10px] font-semibold text-neutral-500 uppercase">Total Employees</div>
                <div className="text-lg font-bold text-neutral-900 mt-0.5">{payrollRows.length}</div>
              </div>
              <div className="bg-white rounded-xl border border-neutral-200 p-3 shadow-2xs">
                <div className="text-[10px] font-semibold text-neutral-500 uppercase">Net Payable</div>
                <div className="text-lg font-bold text-neutral-900 mt-0.5">
                  ₹{totalPayrollPayable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-neutral-200 p-3 shadow-2xs">
                <div className="text-[10px] font-semibold text-neutral-500 uppercase">Paid / Processed</div>
                <div className="text-lg font-bold text-emerald-600 mt-0.5">
                  {paidCount} / {payrollRows.length}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-neutral-200 p-3 shadow-2xs">
                <div className="text-[10px] font-semibold text-neutral-500 uppercase">Failed Payouts</div>
                <div className={`text-lg font-bold mt-0.5 ${failedCount > 0 ? "text-rose-600" : "text-neutral-400"}`}>
                  {failedCount}
                </div>
              </div>
            </div>
          )}

          {/* Payroll Table Container */}
          <div className="bg-white rounded-xl border border-neutral-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto max-w-full">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-neutral-50/80 border-b border-neutral-200 text-neutral-600 font-semibold">
                    <th className="py-2.5 px-3">Employee</th>
                    <th className="py-2.5 px-2 text-center">Pres</th>
                    <th className="py-2.5 px-2 text-center">Half</th>
                    <th className="py-2.5 px-2 text-center">Abs</th>
                    <th className="py-2.5 px-2 text-center">Late</th>
                    <th className="py-2.5 px-2 text-center font-bold">Paid Days</th>
                    <th className="py-2.5 px-3 text-right">Gross</th>
                    <th className="py-2.5 px-3 text-right">Deductions</th>
                    <th className="py-2.5 px-3 text-right font-bold text-neutral-900">Net Salary</th>
                    <th className="py-2.5 px-3">Bank Details</th>
                    <th className="py-2.5 px-2 text-center">Payout</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-neutral-700">
                  {isPayrollLoading ? (
                    <tr>
                      <td colSpan={12} className="text-center py-8 text-neutral-500">
                        Loading payroll data...
                      </td>
                    </tr>
                  ) : payrollRows.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="text-center py-8 text-neutral-500">
                        No payroll generated for this month. Click &quot;Generate Payroll&quot; above.
                      </td>
                    </tr>
                  ) : (
                    payrollRows.map((r) => (
                      <tr key={r.employee_id} className="hover:bg-neutral-50/50">
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-neutral-900">{r.name}</div>
                          <div className="text-[11px] text-neutral-500 font-mono">
                            {r.employee_code} • {r.department}
                          </div>
                          {r.needs_review && (
                            <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800">
                              Needs Review ({r.missing_punch_out_count} no punch-out)
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-center">{r.present_days}</td>
                        <td className="py-2.5 px-2 text-center">{r.half_days}</td>
                        <td className="py-2.5 px-2 text-center">{r.absent_days}</td>
                        <td className="py-2.5 px-2 text-center">{r.late_marks}</td>
                        <td className="py-2.5 px-2 text-center font-bold text-neutral-900">{r.paid_days}</td>
                        <td className="py-2.5 px-3 text-right">₹{r.gross_payable.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-right text-rose-600">
                          -₹{r.deductions.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-neutral-900">
                          ₹{r.net_salary.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3">
                          {r.has_bank_details ? (
                            <div>
                              <div className="font-mono text-[11px] text-neutral-800 font-medium">
                                {r.masked_account}
                              </div>
                              <div className="text-[10px] text-neutral-500 font-mono">{r.ifsc}</div>
                            </div>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              Missing Bank
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          {r.payout_status === "paid" ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              Paid
                            </span>
                          ) : r.payout_status === "processing" ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                              Processing
                            </span>
                          ) : r.payout_status === "queued" ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                              Queued
                            </span>
                          ) : r.payout_status === "failed" ? (
                            <span
                              className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 cursor-pointer"
                              title={r.failure_reason || "Payout failed"}
                            >
                              Failed
                            </span>
                          ) : !r.is_payout_eligible ? (
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-neutral-100 text-neutral-600"
                              title={r.ineligibility_reason}
                            >
                              Skipped
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-neutral-100 text-neutral-500">
                              Unpaid
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {!isFinalized && (
                              <button
                                onClick={() => setAdjEmpId(r.employee_id)}
                                className="text-[11px] text-neutral-600 hover:text-neutral-900 border border-neutral-300 rounded px-2 py-0.5"
                              >
                                Adjust
                              </button>
                            )}

                            {r.payout_status === "failed" && (
                              <button
                                onClick={() => handleRetryPayout(r.employee_id)}
                                disabled={retryingEmpId === r.employee_id}
                                className="text-[11px] bg-rose-600 hover:bg-rose-500 text-white font-medium rounded px-2 py-0.5"
                              >
                                {retryingEmpId === r.employee_id ? "..." : "Retry"}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SALARIES & BANK DETAILS (ADMIN ONLY) */}
      {/* ========================================================================= */}
      {activeTab === "salaries" && (
        <div className="space-y-3">
          {/* Search bar & info */}
          <div className="bg-white rounded-xl border border-neutral-200 p-3 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="w-full sm:w-72">
              <input
                type="text"
                placeholder="Search employee by name, code or dept..."
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                className="w-full text-xs bg-neutral-50 border border-neutral-300 rounded-lg px-3 py-1.5 focus:bg-white focus:outline-hidden"
              />
            </div>
            <div className="text-xs text-neutral-500">
              Showing {filteredEmployees.length} of {employees.length} active employees
            </div>
          </div>

          {/* Employee Salary + Bank Table */}
          <div className="bg-white rounded-xl border border-neutral-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto max-w-full">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-neutral-50/80 border-b border-neutral-200 text-neutral-600 font-semibold">
                    <th className="py-2.5 px-3">Employee</th>
                    <th className="py-2.5 px-3 text-right">Monthly Gross</th>
                    <th className="py-2.5 px-3 text-right">Fixed Deductions</th>
                    <th className="py-2.5 px-3">Bank Details (AES-256 Masked)</th>
                    <th className="py-2.5 px-3 text-center">Readiness</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-neutral-700">
                  {isEmployeesLoading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-neutral-500">
                        Loading employees...
                      </td>
                    </tr>
                  ) : filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-neutral-500">
                        No employees found matching search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredEmployees.map((emp) => {
                      const isReady = emp.hasSalary && emp.hasBankDetails;
                      return (
                        <tr key={emp.employeeId} className="hover:bg-neutral-50/50">
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-neutral-900">{emp.name}</div>
                            <div className="text-[11px] text-neutral-500 font-mono">
                              {emp.employeeCode} • {emp.department}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium">
                            {emp.hasSalary ? (
                              `₹${emp.monthlyGross.toLocaleString("en-IN")}`
                            ) : (
                              <span className="text-amber-600 font-normal">Not Set</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right text-rose-600">
                            {emp.deductionsFixed > 0 ? `-₹${emp.deductionsFixed.toLocaleString("en-IN")}` : "₹0"}
                          </td>
                          <td className="py-2.5 px-3">
                            {emp.hasBankDetails ? (
                              <div>
                                <div className="font-mono text-neutral-900 font-medium">
                                  {emp.accountNumberMasked}
                                </div>
                                <div className="text-[11px] text-neutral-500 font-mono">
                                  {emp.ifsc} • {emp.bankName}
                                </div>
                              </div>
                            ) : (
                              <span className="text-rose-600 font-medium text-[11px]">Missing</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {isReady ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                Ready for Payout
                              </span>
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                {!emp.hasSalary && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800">
                                    Missing Salary
                                  </span>
                                )}
                                {!emp.hasBankDetails && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-100 text-rose-800">
                                    Missing Bank
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              onClick={() => openEditModal(emp)}
                              className="text-xs bg-neutral-900 hover:bg-neutral-800 text-white font-medium rounded-lg px-2.5 py-1 transition-colors"
                            >
                              Edit Details
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: POLICY SETTINGS */}
      {/* ========================================================================= */}
      {activeTab === "settings" && settings && (
        <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-2xs max-w-xl">
          <h2 className="text-base font-bold text-neutral-900 mb-1">Payroll Policy &amp; Rules</h2>
          <p className="text-xs text-neutral-500 mb-4">
            Threshold hours and cutoff timings applied during monthly salary calculation.
          </p>

          <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
            <div>
              <label className="block text-neutral-700 font-medium mb-1">
                Full-Day Minimum Working Hours (Default: 8.0h)
              </label>
              <input
                type="number"
                step="0.5"
                value={settings.working_hours_full_day}
                onChange={(e) =>
                  setSettings({ ...settings, working_hours_full_day: parseFloat(e.target.value) || 8 })
                }
                className="w-full border border-neutral-300 rounded-lg px-3 py-1.5"
              />
            </div>

            <div>
              <label className="block text-neutral-700 font-medium mb-1">
                Half-Day Minimum Working Hours (Default: 4.0h)
              </label>
              <input
                type="number"
                step="0.5"
                value={settings.working_hours_half_day}
                onChange={(e) =>
                  setSettings({ ...settings, working_hours_half_day: parseFloat(e.target.value) || 4 })
                }
                className="w-full border border-neutral-300 rounded-lg px-3 py-1.5"
              />
            </div>

            <div>
              <label className="block text-neutral-700 font-medium mb-1">
                Late Mark Cutoff Time IST (HH:MM, e.g. 10:15)
              </label>
              <input
                type="text"
                value={settings.late_after_time}
                onChange={(e) => setSettings({ ...settings, late_after_time: e.target.value })}
                className="w-full border border-neutral-300 rounded-lg px-3 py-1.5"
              />
            </div>

            <div>
              <label className="block text-neutral-700 font-medium mb-1">
                Late Marks per 0.5 Day Cut (Default: 3)
              </label>
              <input
                type="number"
                value={settings.lates_per_half_day_cut}
                onChange={(e) =>
                  setSettings({ ...settings, lates_per_half_day_cut: parseInt(e.target.value, 10) || 3 })
                }
                className="w-full border border-neutral-300 rounded-lg px-3 py-1.5"
              />
            </div>

            <div>
              <label className="block text-neutral-700 font-medium mb-1">Weekly Off Day</label>
              <select
                value={settings.weekly_off_day}
                onChange={(e) => setSettings({ ...settings, weekly_off_day: parseInt(e.target.value, 10) })}
                className="w-full border border-neutral-300 rounded-lg px-3 py-1.5 bg-white"
              >
                <option value={0}>Sunday</option>
                <option value={1}>Monday</option>
                <option value={2}>Tuesday (Default)</option>
                <option value={3}>Wednesday</option>
                <option value={4}>Thursday</option>
                <option value={5}>Friday</option>
                <option value={6}>Saturday</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isSavingSettings}
              className="bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {isSavingSettings ? "Saving..." : "Save Settings"}
            </button>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: PAID HOLIDAYS */}
      {/* ========================================================================= */}
      {activeTab === "holidays" && (
        <div className="space-y-4 max-w-xl">
          <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-2xs">
            <h2 className="text-sm font-bold text-neutral-900 mb-2">Add Paid Holiday</h2>
            <form onSubmit={handleAddHoliday} className="flex flex-wrap items-center gap-2 text-xs">
              <input
                type="date"
                required
                value={newHolidayDate}
                onChange={(e) => setNewHolidayDate(e.target.value)}
                className="border border-neutral-300 rounded-lg px-2.5 py-1.5"
              />
              <input
                type="text"
                required
                placeholder="Holiday Name (e.g. Diwali)"
                value={newHolidayName}
                onChange={(e) => setNewHolidayName(e.target.value)}
                className="border border-neutral-300 rounded-lg px-2.5 py-1.5 flex-1 min-w-[150px]"
              />
              <button
                type="submit"
                disabled={isAddingHoliday}
                className="bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-white font-medium px-3 py-1.5 rounded-lg transition-colors"
              >
                {isAddingHoliday ? "Adding..." : "Add Holiday"}
              </button>
            </form>
          </div>

          <div className="bg-white rounded-xl border border-neutral-200 shadow-2xs overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-neutral-50/80 border-b border-neutral-200 text-neutral-600 font-semibold">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Holiday Name</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-neutral-700">
                {isHolidaysLoading ? (
                  <tr>
                    <td colSpan={3} className="text-center py-6 text-neutral-500">
                      Loading holidays...
                    </td>
                  </tr>
                ) : holidays.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center py-6 text-neutral-500">
                      No paid holidays configured yet.
                    </td>
                  </tr>
                ) : (
                  holidays.map((h) => (
                    <tr key={h.id} className="hover:bg-neutral-50/50">
                      <td className="py-2.5 px-3 font-mono font-medium">{h.date}</td>
                      <td className="py-2.5 px-3">{h.name}</td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => handleDeleteHoliday(h.id)}
                          className="text-rose-600 hover:text-rose-800 text-[11px]"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: PAYOUT CONFIRMATION DIALOG (STRICT REQUIREMENT) */}
      {/* ========================================================================= */}
      {showPayoutModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-xl border border-neutral-200 space-y-4">
            <div className="border-b border-neutral-200 pb-3">
              <h2 className="text-base font-bold text-neutral-900">Confirm Monthly Salary Payout</h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Review payout parameters before executing transfer. Money moves only after confirmation.
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-neutral-100">
                <span className="text-neutral-500">Period:</span>
                <span className="font-semibold text-neutral-900">{selectedMonth}/{selectedYear}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-100">
                <span className="text-neutral-500">Company Source A/C:</span>
                <span className="font-mono font-semibold text-neutral-900">
                  {companyAccount?.maskedAccountNumber} ({companyAccount?.providerName})
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-100">
                <span className="text-neutral-500">Eligible Employees:</span>
                <span className="font-semibold text-emerald-600">{payoutStats.eligibleCount} employees</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-100">
                <span className="text-neutral-500">Skipped Employees:</span>
                <span className="font-semibold text-neutral-600">{payoutStats.skippedCount} employees</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-neutral-100">
                <span className="text-neutral-700 font-bold">Total Payout Amount:</span>
                <span className="text-base font-bold text-neutral-900">
                  ₹{payoutStats.totalNet.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>

              {companyAccount?.isSandbox && (
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px]">
                  <strong>Sandbox / Test Mode Active:</strong> No real bank funds will be transferred. Provider calls are simulated safely.
                </div>
              )}

              {payoutStats.skippedDetails.length > 0 && (
                <div className="p-2 rounded bg-neutral-50 border border-neutral-200 max-h-24 overflow-y-auto">
                  <div className="font-semibold text-neutral-600 text-[10px] uppercase mb-1">Skipped Reasons:</div>
                  {payoutStats.skippedDetails.slice(0, 5).map((d, i) => (
                    <div key={i} className="text-[10px] text-neutral-500">
                      • {d.name}: {d.reason}
                    </div>
                  ))}
                  {payoutStats.skippedDetails.length > 5 && (
                    <div className="text-[10px] text-neutral-400 mt-0.5">
                      + {payoutStats.skippedDetails.length - 5} more
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPayoutModal(false)}
                disabled={isInitiatingPayout}
                className="px-3 py-1.5 border border-neutral-300 rounded-lg text-xs font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPayout}
                disabled={isInitiatingPayout || payoutStats.eligibleCount === 0}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-2xs"
              >
                {isInitiatingPayout ? "Initiating Payout..." : "Confirm & Initiate Payout"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: EDIT SALARY & BANK DETAILS (ADMIN ONLY) */}
      {/* ========================================================================= */}
      {editingEmp && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-xl border border-neutral-200 max-h-[90vh] overflow-y-auto">
            <div className="border-b border-neutral-200 pb-3 mb-4">
              <h2 className="text-base font-bold text-neutral-900">
                Edit Salary &amp; Bank Details
              </h2>
              <p className="text-xs text-neutral-500">
                {editingEmp.name} ({editingEmp.employeeCode} • {editingEmp.department})
              </p>
            </div>

            <form onSubmit={handleSaveSalaryAndBank} className="space-y-4 text-xs">
              {/* Section 1: Salary Configuration */}
              <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-200 space-y-3">
                <div className="font-semibold text-neutral-800 text-xs">Monthly Compensation</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-neutral-600 font-medium mb-1">
                      Monthly Gross Salary (₹)
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="1"
                      value={modalGross}
                      onChange={(e) => setModalGross(e.target.value)}
                      className="w-full border border-neutral-300 rounded-lg px-2.5 py-1.5 bg-white font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-neutral-600 font-medium mb-1">
                      Fixed Monthly Deductions (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={modalFixedDed}
                      onChange={(e) => setModalFixedDed(e.target.value)}
                      className="w-full border border-neutral-300 rounded-lg px-2.5 py-1.5 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Bank Details with Double Account Entry & Validation */}
              <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-neutral-800 text-xs">Bank Account Information</span>
                  <span className="text-[10px] text-neutral-400 font-mono">AES-256 Encrypted</span>
                </div>

                {editingEmp.hasBankDetails && !modalAccountNum && (
                  <div className="text-[11px] text-neutral-600 bg-white p-2 rounded border border-neutral-200 font-mono">
                    Current Account: {editingEmp.accountNumberMasked} ({editingEmp.ifsc} • {editingEmp.bankName})
                    <div className="text-[10px] text-neutral-400 mt-0.5">
                      Leave account number fields blank to keep existing details.
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-neutral-600 font-medium mb-1">
                    Account Holder Name
                  </label>
                  <input
                    type="text"
                    value={modalHolderName}
                    onChange={(e) => setModalHolderName(e.target.value)}
                    placeholder="As printed on bank passbook"
                    className="w-full border border-neutral-300 rounded-lg px-2.5 py-1.5 bg-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-neutral-600 font-medium mb-1">
                      Account Number (9-18 digits)
                    </label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={modalAccountNum}
                      onChange={(e) => setModalAccountNum(e.target.value)}
                      placeholder="Enter account number"
                      className="w-full border border-neutral-300 rounded-lg px-2.5 py-1.5 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-neutral-600 font-medium mb-1">
                      Confirm Account Number
                    </label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={modalConfirmAccountNum}
                      onChange={(e) => setModalConfirmAccountNum(e.target.value)}
                      placeholder="Re-enter account number"
                      className="w-full border border-neutral-300 rounded-lg px-2.5 py-1.5 bg-white font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-neutral-600 font-medium mb-1">
                      IFSC Code (11 chars, e.g. HDFC0001234)
                    </label>
                    <input
                      type="text"
                      maxLength={11}
                      value={modalIFSC}
                      onChange={(e) => setModalIFSC(e.target.value.toUpperCase())}
                      placeholder="HDFC0001234"
                      className="w-full border border-neutral-300 rounded-lg px-2.5 py-1.5 bg-white font-mono uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-neutral-600 font-medium mb-1">Bank Name</label>
                    <input
                      type="text"
                      value={modalBankName}
                      onChange={(e) => setModalBankName(e.target.value)}
                      placeholder="e.g. HDFC Bank"
                      className="w-full border border-neutral-300 rounded-lg px-2.5 py-1.5 bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-neutral-600 font-medium mb-1">
                    UPI ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={modalUpiId}
                    onChange={(e) => setModalUpiId(e.target.value)}
                    placeholder="name@upi"
                    className="w-full border border-neutral-300 rounded-lg px-2.5 py-1.5 bg-white font-mono"
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingEmp(null)}
                  disabled={isSavingSalaryBank}
                  className="px-3 py-1.5 border border-neutral-300 rounded-lg text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingSalaryBank}
                  className="px-4 py-1.5 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold"
                >
                  {isSavingSalaryBank ? "Saving Details..." : "Save Details"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: ADJUSTMENT MODAL (BONUS / DEDUCTION) */}
      {/* ========================================================================= */}
      {adjEmpId && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl border border-neutral-200 space-y-3">
            <h2 className="text-sm font-bold text-neutral-900">Add Manual Adjustment</h2>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-neutral-600 font-medium mb-1">Type</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjType("bonus")}
                    className={`flex-1 py-1.5 rounded-lg border font-medium ${
                      adjType === "bonus"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-800"
                        : "border-neutral-300 text-neutral-600"
                    }`}
                  >
                    Bonus (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjType("deduction")}
                    className={`flex-1 py-1.5 rounded-lg border font-medium ${
                      adjType === "deduction"
                        ? "bg-rose-50 border-rose-500 text-rose-800"
                        : "border-neutral-300 text-neutral-600"
                    }`}
                  >
                    Deduction (-)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-neutral-600 font-medium mb-1">Amount (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={adjAmount || ""}
                  onChange={(e) => setAdjAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full border border-neutral-300 rounded-lg px-3 py-1.5"
                />
              </div>

              <div>
                <label className="block text-neutral-600 font-medium mb-1">Remark</label>
                <input
                  type="text"
                  value={adjRemark}
                  onChange={(e) => setAdjRemark(e.target.value)}
                  placeholder="Reason for adjustment"
                  className="w-full border border-neutral-300 rounded-lg px-3 py-1.5"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjEmpId(null)}
                  className="px-3 py-1.5 border border-neutral-300 rounded-lg text-neutral-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddAdjustment}
                  disabled={isAddingAdj || adjAmount <= 0}
                  className="px-4 py-1.5 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-white rounded-lg font-medium"
                >
                  {isAddingAdj ? "Saving..." : "Add"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
