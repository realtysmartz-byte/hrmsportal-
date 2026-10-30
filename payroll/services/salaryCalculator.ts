import type { PrismaClient } from "@realty-smartz/db";
import {
  getEligiblePayrollEmployees,
  getAttendanceLogsForMonth,
  type PayrollEmployeeRecord,
} from "../config/employeeSource";

export interface PayrollSettings {
  working_hours_full_day: number;
  working_hours_half_day: number;
  late_after_time: string; // e.g. "10:15"
  lates_per_half_day_cut: number;
  weekly_off_day: number; // JS getDay: 0=Sun, 1=Mon, 2=Tue, etc.
}

export interface EmployeePayrollRow {
  employee_id: string;
  name: string;
  employee_code: string;
  department: string;
  email: string;
  phone: string | null;
  month: number;
  year: number;
  total_days_in_month: number;
  present_days: number;
  half_days: number;
  absent_days: number;
  late_marks: number;
  weekly_off_days: number;
  holiday_days: number;
  late_deductions_days: number;
  paid_days: number;
  monthly_gross: number;
  per_day_salary: number;
  gross_payable: number;
  fixed_deductions: number;
  manual_deductions: number;
  deductions: number;
  additions: number;
  net_salary: number;
  missing_punch_out_count: number;
  needs_review: boolean;
  status: "draft" | "finalized";
  // Bank details fields (masked)
  has_bank_details: boolean;
  bank_name?: string;
  ifsc?: string;
  masked_account?: string;
  account_holder_name?: string;
  // Payout eligibility & status
  is_payout_eligible: boolean;
  ineligibility_reason?: string;
  payout_id?: string;
  payout_status?: "queued" | "processing" | "paid" | "failed" | "unpaid" | "skipped";
  failure_reason?: string;
  paid_at?: string;
}

export const DEFAULT_PAYROLL_SETTINGS: PayrollSettings = {
  working_hours_full_day: 8.0,
  working_hours_half_day: 4.0,
  late_after_time: "10:15",
  lates_per_half_day_cut: 3,
  weekly_off_day: 2, // Tuesday default
};

function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = (timeStr || "10:15").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function getISTMinutesFromMidnight(d: Date): number {
  const utc = d.getTime();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(utc + istOffsetMs);
  return istDate.getUTCHours() * 60 + istDate.getUTCMinutes();
}

function formatISTDateStr(year: number, month: number, day: number): string {
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

const verifiedTables = new Set<string>();

export async function checkTableExists(prisma: PrismaClient, tableName: string): Promise<boolean> {
  if (verifiedTables.has(tableName)) return true;
  try {
    const res = await prisma.$queryRawUnsafe<any[]>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1 LIMIT 1`,
      tableName
    );
    if (res && res.length > 0) {
      verifiedTables.add(tableName);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Safe query execution wrapper that prevents crashes if new payroll_ tables
 * have not yet been manually created by the user.
 */
export async function safeQueryRaw<T = any>(
  prisma: PrismaClient,
  tableName: string,
  query: string,
  ...values: any[]
): Promise<T[]> {
  const exists = await checkTableExists(prisma, tableName);
  if (!exists) {
    return [];
  }
  try {
    return await prisma.$queryRawUnsafe<T[]>(query, ...values);
  } catch (err: any) {
    console.error(`[PAYROLL_RAW_QUERY_ERROR] on table ${tableName}:`, err);
    return [];
  }
}

export async function safeExecuteRaw(
  prisma: PrismaClient,
  query: string,
  ...values: any[]
): Promise<number> {
  try {
    return await prisma.$executeRawUnsafe(query, ...values);
  } catch (err: any) {
    if (err?.code === "P2010" && err?.meta?.code === "42P01") {
      throw new Error("Payroll tables are not created in the database yet. Please run payroll/payroll_schema.sql first.");
    }
    throw err;
  }
}

export async function getPayrollSettings(prisma: PrismaClient): Promise<PayrollSettings> {
  const rows = await safeQueryRaw<any>(
    prisma,
    "payroll_settings",
    `SELECT working_hours_full_day, working_hours_half_day, late_after_time, lates_per_half_day_cut, weekly_off_day 
     FROM payroll_settings WHERE id = 'singleton' LIMIT 1`
  );
  if (rows && rows.length > 0) {
    const r = rows[0];
    return {
      working_hours_full_day: Number(r.working_hours_full_day) || 8.0,
      working_hours_half_day: Number(r.working_hours_half_day) || 4.0,
      late_after_time: String(r.late_after_time || "10:15"),
      lates_per_half_day_cut: Number(r.lates_per_half_day_cut) || 3,
      weekly_off_day: Number(r.weekly_off_day ?? 2),
    };
  }
  return DEFAULT_PAYROLL_SETTINGS;
}

export async function calculateMonthlyPayroll(
  prisma: PrismaClient,
  month: number,
  year: number
): Promise<EmployeePayrollRow[]> {
  const settings = await getPayrollSettings(prisma);
  const lateCutoffMinutes = parseTimeToMinutes(settings.late_after_time);
  const totalDaysInMonth = new Date(year, month, 0).getDate();

  // 1. Read Eligible Active Employees via configured mapping (Excludes Admin accounts)
  const employees: PayrollEmployeeRecord[] = await getEligiblePayrollEmployees(prisma);
  if (employees.length === 0) {
    return [];
  }

  const employeeIds = employees.map((e) => e.id);

  // 2. Read Salary records from payroll_salary
  const salaryRows = await safeQueryRaw<any>(
    prisma,
    "payroll_salary",
    `SELECT employee_id, monthly_gross, deductions_fixed FROM payroll_salary`
  );
  const salaryMap = new Map<string, { monthly_gross: number; deductions_fixed: number }>();
  for (const s of salaryRows) {
    salaryMap.set(s.employee_id, {
      monthly_gross: Number(s.monthly_gross || 0),
      deductions_fixed: Number(s.deductions_fixed || 0),
    });
  }

  // 3. Read Bank Details from payroll_bank_details
  const bankRows = await safeQueryRaw<any>(
    prisma,
    "payroll_bank_details",
    `SELECT employee_id, account_holder_name, account_number_masked, ifsc, bank_name, is_verified 
     FROM payroll_bank_details`
  );
  const bankMap = new Map<string, any>();
  for (const b of bankRows) {
    bankMap.set(b.employee_id, b);
  }

  // 4. Read Payouts for this month from payroll_payouts
  const payoutRows = await safeQueryRaw<any>(
    prisma,
    "payroll_payouts",
    `SELECT id, employee_id, status, failure_reason, to_char(updated_at, 'DD Mon YYYY, HH12:MI AM') as paid_at 
     FROM payroll_payouts WHERE month = $1 AND year = $2`,
    month,
    year
  );
  const payoutMap = new Map<string, any>();
  for (const p of payoutRows) {
    payoutMap.set(p.employee_id, p);
  }

  // 5. Read Holidays for this month from payroll_holidays
  const holidayRows = await safeQueryRaw<any>(
    prisma,
    "payroll_holidays",
    `SELECT to_char(date, 'YYYY-MM-DD') as date_str, name FROM payroll_holidays`
  );
  const holidaySet = new Set<string>();
  for (const h of holidayRows) {
    if (h.date_str) holidaySet.add(h.date_str);
  }

  // 6. Read Adjustments for this month & year
  const adjRows = await safeQueryRaw<any>(
    prisma,
    "payroll_adjustments",
    `SELECT employee_id, type, amount FROM payroll_adjustments WHERE month = $1 AND year = $2`,
    month,
    year
  );
  const adjustmentsMap = new Map<string, { bonus: number; deduction: number }>();
  for (const a of adjRows) {
    const cur = adjustmentsMap.get(a.employee_id) || { bonus: 0, deduction: 0 };
    if (a.type === "bonus") {
      cur.bonus += Number(a.amount || 0);
    } else if (a.type === "deduction") {
      cur.deduction += Number(a.amount || 0);
    }
    adjustmentsMap.set(a.employee_id, cur);
  }

  // 7. Read Existing Runs to check for finalized lock
  const existingRuns = await safeQueryRaw<any>(
    prisma,
    "payroll_runs",
    `SELECT * FROM payroll_runs WHERE month = $1 AND year = $2`,
    month,
    year
  );
  const existingRunsMap = new Map<string, any>();
  for (const r of existingRuns) {
    existingRunsMap.set(r.employee_id, r);
  }

  // 8. Read Attendance Logs for the entire month via mapped attendanceSourceConfig
  const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const monthEnd = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  const attendanceLogs = await getAttendanceLogsForMonth(prisma, employeeIds, monthStart, monthEnd);

  const empDayAttendanceMap = new Map<string, Map<number, any>>();
  for (const log of attendanceLogs) {
    let dayMap = empDayAttendanceMap.get(log.employeeId);
    if (!dayMap) {
      dayMap = new Map();
      empDayAttendanceMap.set(log.employeeId, dayMap);
    }
    const logDate = new Date(log.date);
    const dayOfMonth = logDate.getUTCDate();
    dayMap.set(dayOfMonth, log);
  }

  const resultRows: EmployeePayrollRow[] = [];

  for (const emp of employees) {
    const existing = existingRunsMap.get(emp.id);

    // If month is already finalized, use locked values from payroll_runs
    if (existing && existing.status === "finalized") {
      const bank = bankMap.get(emp.id);
      const payout = payoutMap.get(emp.id);
      const hasBank = Boolean(bank && bank.account_number_masked && bank.ifsc);
      const net = Number(existing.net_salary || 0);

      let isEligible = true;
      let ineligibilityReason: string | undefined;

      if (net <= 0) {
        isEligible = false;
        ineligibilityReason = "Zero Net Salary";
      } else if (!hasBank) {
        isEligible = false;
        ineligibilityReason = "Missing Bank Details";
      }

      resultRows.push({
        employee_id: emp.id,
        name: emp.name,
        employee_code: emp.employeeCode,
        department: emp.department,
        email: emp.email,
        phone: emp.phone,
        month,
        year,
        total_days_in_month: totalDaysInMonth,
        present_days: Number(existing.present_days),
        half_days: Number(existing.half_days),
        absent_days: Number(existing.absent_days),
        late_marks: Number(existing.late_marks),
        weekly_off_days: Number(existing.weekly_off_days),
        holiday_days: Number(existing.holiday_days),
        late_deductions_days: (Number(existing.late_marks) / (settings.lates_per_half_day_cut || 3)) * 0.5,
        paid_days: Number(existing.paid_days),
        monthly_gross: Number(existing.monthly_gross),
        per_day_salary: Number(existing.per_day_salary),
        gross_payable: Number(existing.gross_payable),
        fixed_deductions: Number(existing.monthly_gross) - Number(existing.gross_payable),
        manual_deductions: 0,
        deductions: Number(existing.deductions),
        additions: Number(existing.additions),
        net_salary: net,
        missing_punch_out_count: Number(existing.missing_punch_out_count),
        needs_review: Boolean(existing.needs_review),
        status: "finalized",
        has_bank_details: hasBank,
        bank_name: bank?.bank_name,
        ifsc: bank?.ifsc,
        masked_account: bank?.account_number_masked,
        account_holder_name: bank?.account_holder_name,
        is_payout_eligible: isEligible,
        ineligibility_reason: ineligibilityReason,
        payout_id: payout?.id,
        payout_status: payout?.status || "unpaid",
        failure_reason: payout?.failure_reason,
        paid_at: payout?.paid_at,
      });
      continue;
    }

    // Dynamic Calculation from Attendance
    let presentDays = 0;
    let halfDays = 0;
    let absentDays = 0;
    let lateMarks = 0;
    let weeklyOffDays = 0;
    let holidayDays = 0;
    let missingPunchOutCount = 0;

    const dayAttendance = empDayAttendanceMap.get(emp.id) || new Map<number, any>();

    for (let day = 1; day <= totalDaysInMonth; day++) {
      const dateObj = new Date(year, month - 1, day);
      const dayOfWeek = dateObj.getDay();
      const dateStr = formatISTDateStr(year, month, day);

      const isWeeklyOff = dayOfWeek === settings.weekly_off_day;
      const isHoliday = holidaySet.has(dateStr);

      if (isHoliday) {
        holidayDays++;
        continue;
      }
      if (isWeeklyOff) {
        weeklyOffDays++;
        continue;
      }

      const log = dayAttendance.get(day);
      if (!log || (!log.checkInTime && (log.totalHours === null || log.totalHours === undefined))) {
        absentDays++;
        continue;
      }

      if (log.checkInTime) {
        const checkInISTMinutes = getISTMinutesFromMidnight(new Date(log.checkInTime));
        if (checkInISTMinutes > lateCutoffMinutes) {
          lateMarks++;
        }
      }

      if (log.checkInTime && !log.checkOutTime && (log.totalHours === null || log.totalHours === undefined)) {
        missingPunchOutCount++;
      }

      const hours = Number(log.totalHours || 0);

      if (hours >= settings.working_hours_full_day) {
        presentDays++;
      } else if (hours >= settings.working_hours_half_day) {
        halfDays++;
      } else {
        if (log.checkInTime && !log.checkOutTime) {
          presentDays++;
        } else {
          absentDays++;
        }
      }
    }

    const lateDeductionPeriods = Math.floor(lateMarks / (settings.lates_per_half_day_cut || 3));
    const lateDeductionsDays = lateDeductionPeriods * 0.5;

    let paidDays = presentDays + halfDays * 0.5 + weeklyOffDays + holidayDays - lateDeductionsDays;
    if (paidDays < 0) paidDays = 0;
    paidDays = Math.round(paidDays * 100) / 100;

    const salary = salaryMap.get(emp.id) || { monthly_gross: 0, deductions_fixed: 0 };
    const monthlyGross = Math.round((salary.monthly_gross || 0) * 100) / 100;
    const fixedDeductions = Math.round((salary.deductions_fixed || 0) * 100) / 100;

    const perDaySalary = totalDaysInMonth > 0 ? Math.round((monthlyGross / totalDaysInMonth) * 100) / 100 : 0;
    const grossPayable = Math.round(perDaySalary * paidDays * 100) / 100;

    const adj = adjustmentsMap.get(emp.id) || { bonus: 0, deduction: 0 };
    const manualDeductions = Math.round(adj.deduction * 100) / 100;
    const additions = Math.round(adj.bonus * 100) / 100;
    const totalDeductions = Math.round((fixedDeductions + manualDeductions) * 100) / 100;

    let netSalary = grossPayable - fixedDeductions + additions - manualDeductions;
    if (netSalary < 0) netSalary = 0;
    netSalary = Math.round(netSalary * 100) / 100;

    const needsReview = missingPunchOutCount > 0;
    const bank = bankMap.get(emp.id);
    const payout = payoutMap.get(emp.id);
    const hasBank = Boolean(bank && bank.account_number_masked && bank.ifsc);

    let isEligible = true;
    let ineligibilityReason: string | undefined;

    if (monthlyGross <= 0) {
      isEligible = false;
      ineligibilityReason = "Missing Salary";
    } else if (!hasBank) {
      isEligible = false;
      ineligibilityReason = "Missing Bank Details";
    } else if (netSalary <= 0) {
      isEligible = false;
      ineligibilityReason = "Zero Net Salary";
    }

    resultRows.push({
      employee_id: emp.id,
      name: emp.name,
      employee_code: emp.employeeCode,
      department: emp.department,
      email: emp.email,
      phone: emp.phone,
      month,
      year,
      total_days_in_month: totalDaysInMonth,
      present_days: presentDays,
      half_days: halfDays,
      absent_days: absentDays,
      late_marks: lateMarks,
      weekly_off_days: weeklyOffDays,
      holiday_days: holidayDays,
      late_deductions_days: lateDeductionsDays,
      paid_days: paidDays,
      monthly_gross: monthlyGross,
      per_day_salary: perDaySalary,
      gross_payable: grossPayable,
      fixed_deductions: fixedDeductions,
      manual_deductions: manualDeductions,
      deductions: totalDeductions,
      additions: additions,
      net_salary: netSalary,
      missing_punch_out_count: missingPunchOutCount,
      needs_review: needsReview,
      status: "draft",
      has_bank_details: hasBank,
      bank_name: bank?.bank_name,
      ifsc: bank?.ifsc,
      masked_account: bank?.account_number_masked,
      account_holder_name: bank?.account_holder_name,
      is_payout_eligible: isEligible,
      ineligibility_reason: ineligibilityReason,
      payout_id: payout?.id,
      payout_status: payout?.status || "unpaid",
      failure_reason: payout?.failure_reason,
      paid_at: payout?.paid_at,
    });
  }

  return resultRows;
}

export async function finalizeMonthlyPayroll(
  prisma: PrismaClient,
  month: number,
  year: number
): Promise<{ success: boolean; count: number }> {
  const rows = await calculateMonthlyPayroll(prisma, month, year);
  if (rows.length === 0) {
    return { success: false, count: 0 };
  }

  for (const r of rows) {
    const id = `run_${r.employee_id}_${month}_${year}`;
    await safeExecuteRaw(
      prisma,
      `INSERT INTO payroll_runs (
        id, employee_id, month, year,
        present_days, half_days, absent_days, late_marks,
        weekly_off_days, holiday_days, paid_days,
        per_day_salary, monthly_gross, gross_payable,
        deductions, additions, net_salary,
        missing_punch_out_count, needs_review, status, updated_at
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8,
        $9, $10, $11,
        $12, $13, $14,
        $15, $16, $17,
        $18, $19, 'finalized', NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        present_days = EXCLUDED.present_days,
        half_days = EXCLUDED.half_days,
        absent_days = EXCLUDED.absent_days,
        late_marks = EXCLUDED.late_marks,
        weekly_off_days = EXCLUDED.weekly_off_days,
        holiday_days = EXCLUDED.holiday_days,
        paid_days = EXCLUDED.paid_days,
        per_day_salary = EXCLUDED.per_day_salary,
        monthly_gross = EXCLUDED.monthly_gross,
        gross_payable = EXCLUDED.gross_payable,
        deductions = EXCLUDED.deductions,
        additions = EXCLUDED.additions,
        net_salary = EXCLUDED.net_salary,
        missing_punch_out_count = EXCLUDED.missing_punch_out_count,
        needs_review = EXCLUDED.needs_review,
        status = 'finalized',
        updated_at = NOW()`,
      id,
      r.employee_id,
      month,
      year,
      r.present_days,
      r.half_days,
      r.absent_days,
      r.late_marks,
      r.weekly_off_days,
      r.holiday_days,
      r.paid_days,
      r.per_day_salary,
      r.monthly_gross,
      r.gross_payable,
      r.deductions,
      r.additions,
      r.net_salary,
      r.missing_punch_out_count,
      r.needs_review
    );
  }

  return { success: true, count: rows.length };
}
