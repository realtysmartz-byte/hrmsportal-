import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@realty-smartz/db";
import {
  calculateMonthlyPayroll,
  finalizeMonthlyPayroll,
  getPayrollSettings,
  safeQueryRaw,
  safeExecuteRaw,
  checkTableExists,
} from "../services/salaryCalculator";
import {
  encryptAccountNumber,
  decryptAccountNumber,
  maskAccountNumber,
  isValidIFSC,
  isValidAccountNumber,
} from "../services/encryption";
import { payoutProvider, type PayoutRequest } from "../services/payoutProvider";
import { getEligiblePayrollEmployees } from "../config/employeeSource";

function isAuthorizedAdminOrHR(role?: string): boolean {
  return role === "ADMIN" || role === "HR";
}

async function logAudit(
  action: string,
  performedBy: string,
  details: Record<string, any>,
  ip?: string | null
): Promise<void> {
  const tableExists = await checkTableExists(prisma, "payroll_audit_log");
  if (!tableExists) return;

  const id = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  // Strictly avoid logging sensitive bank account numbers or secrets
  const sanitizedDetails = JSON.stringify(details);
  await prisma.$executeRawUnsafe(
    `INSERT INTO payroll_audit_log (id, action, performed_by, details, ip_address, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    id,
    action,
    performedBy,
    sanitizedDetails,
    ip || null
  ).catch ((err: unknown) => console.error("[PAYROLL_AUDIT_LOG_ERROR]", err));
}

// GET: /api/payroll?action=...
export async function GET(req: NextRequest) {
  try {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role as string;
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  // =========================================================================
  // EMPLOYEE ACTION: View own finalized payslips only
  // =========================================================================
  if (action === "my-payslips") {
    const employeeId = session.user.id;
    const runs = await safeQueryRaw<any>(
      prisma,
      "payroll_runs",
      `SELECT r.*, p.status as payout_status, to_char(p.updated_at, 'DD Mon YYYY') as paid_on_date
       FROM payroll_runs r
       LEFT JOIN payroll_payouts p ON p.employee_id = r.employee_id AND p.month = r.month AND p.year = r.year
       WHERE r.employee_id = $1 AND r.status = 'finalized'
       ORDER BY r.year DESC, r.month DESC`,
      employeeId
    );

    const emp = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeCode: true,
        department: { select: { name: true } },
        designation: { select: { title: true } },
      },
    });

    const payslips = (runs || []).map((r: any) => ({
      id: r.id,
      month: Number(r.month),
      year: Number(r.year),
      employeeName: emp ? `${emp.firstName} ${emp.lastName}`.trim() : "Employee",
      employeeCode: emp?.employeeCode || "",
      department: emp?.department?.name || "General",
      designation: emp?.designation?.title || "Staff",
      presentDays: Number(r.present_days),
      halfDays: Number(r.half_days),
      absentDays: Number(r.absent_days),
      lateMarks: Number(r.late_marks),
      weeklyOffDays: Number(r.weekly_off_days),
      holidayDays: Number(r.holiday_days),
      paidDays: Number(r.paid_days),
      perDaySalary: Number(r.per_day_salary),
      monthlyGross: Number(r.monthly_gross),
      grossPayable: Number(r.gross_payable),
      deductions: Number(r.deductions),
      additions: Number(r.additions),
      netSalary: Number(r.net_salary),
      payoutStatus: r.payout_status || "unpaid",
      paidOnDate: r.paid_on_date || null,
      createdAt: r.created_at,
    }));

    return NextResponse.json({ payslips });
  }

  // =========================================================================
  // ADMIN ONLY ACTIONS: Verify Admin or HR privileges
  // =========================================================================
  if (!isAuthorizedAdminOrHR(role)) {
    return NextResponse.json({ error: "Forbidden: Admin or HR role required" }, { status: 403 });
  }

  // 1. Get Company Account Information (Provider name & masked account)
  if (action === "get-company-account") {
    const info = payoutProvider.getCompanyAccountInfo();
    return NextResponse.json({ companyAccount: info });
  }

  // 2. Get Settings
  if (action === "get-settings") {
    const settings = await getPayrollSettings(prisma);
    return NextResponse.json({ settings });
  }

  // 3. Get Employee Salaries & Bank Details
  if (action === "get-salaries") {
    const eligibleEmployees = await getEligiblePayrollEmployees(prisma);

    const salaryRows = await safeQueryRaw<any>(
      prisma,
      "payroll_salary",
      `SELECT employee_id, monthly_gross, deductions_fixed FROM payroll_salary`
    );
    const salaryMap = new Map<string, any>();
    for (const r of salaryRows) {
      salaryMap.set(r.employee_id, r);
    }

    const bankRows = await safeQueryRaw<any>(
      prisma,
      "payroll_bank_details",
      `SELECT employee_id, account_holder_name, account_number_masked, ifsc, bank_name, upi_id, is_verified 
       FROM payroll_bank_details`
    );
    const bankMap = new Map<string, any>();
    for (const b of bankRows) {
      bankMap.set(b.employee_id, b);
    }

    const employeesWithSalary = eligibleEmployees.map((emp) => {
      const sal = salaryMap.get(emp.id);
      const bank = bankMap.get(emp.id);
      const gross = Number(sal?.monthly_gross || 0);
      const fixedDed = Number(sal?.deductions_fixed || 0);
      const hasBank = Boolean(bank && bank.account_number_masked && bank.ifsc);

      return {
        employeeId: emp.id,
        name: emp.name,
        employeeCode: emp.employeeCode,
        department: emp.department,
        email: emp.email,
        phone: emp.phone,
        monthlyGross: gross,
        deductionsFixed: fixedDed,
        hasSalary: gross > 0,
        hasBankDetails: hasBank,
        accountHolderName: bank?.account_holder_name || "",
        accountNumberMasked: bank?.account_number_masked || "",
        ifsc: bank?.ifsc || "",
        bankName: bank?.bank_name || "",
        upiId: bank?.upi_id || "",
        isVerified: Boolean(bank?.is_verified),
      };
    });

    return NextResponse.json({ employees: employeesWithSalary });
  }

  // 4. Get Holidays
  if (action === "get-holidays") {
    const holidays = await safeQueryRaw<any>(
      prisma,
      "payroll_holidays",
      `SELECT id, to_char(date, 'YYYY-MM-DD') as date, name FROM payroll_holidays ORDER BY date ASC`
    );
    return NextResponse.json({ holidays });
  }

  // 5. View Month Payroll
  if (action === "view-month") {
    const month = Number(searchParams.get("month") || new Date().getMonth() + 1);
    const year = Number(searchParams.get("year") || new Date().getFullYear());
    const rows = await calculateMonthlyPayroll(prisma, month, year);
    return NextResponse.json({ rows });
  }

  // 6. Bank File Export Fallback (CSV with Decrypted Account Numbers for Bulk Bank Upload)
  if (action === "export-bank-file") {
    const month = Number(searchParams.get("month") || new Date().getMonth() + 1);
    const year = Number(searchParams.get("year") || new Date().getFullYear());

    const rows = await calculateMonthlyPayroll(prisma, month, year);
    if (rows.length === 0) {
      return NextResponse.json({ error: "No payroll rows found for this month" }, { status: 400 });
    }

    const bankRows = await safeQueryRaw<any>(
      prisma,
      "payroll_bank_details",
      `SELECT employee_id, account_holder_name, account_number_encrypted, ifsc, bank_name 
       FROM payroll_bank_details`
    );
    const bankMap = new Map<string, any>();
    for (const b of bankRows) {
      bankMap.set(b.employee_id, b);
    }

    const monthNames = [
      "", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];
    const narrationRef = `Salary ${monthNames[month] || month} ${year}`;

    // Header row
    const csvLines: string[] = [
      "Employee Code,Employee Name,Account Holder Name,Account Number,IFSC,Bank Name,Net Amount,Reference"
    ];

    let totalAmount = 0;
    let exportedCount = 0;

    for (const r of rows) {
      if (r.net_salary <= 0) continue; // Skip zero salaries
      const b = bankMap.get(r.employee_id);
      if (!b || !b.account_number_encrypted || !b.ifsc) continue; // Skip missing bank details

      let plainAccount = "";
      try {
        plainAccount = decryptAccountNumber(b.account_number_encrypted);
      } catch {
        continue;
      }

      totalAmount += r.net_salary;
      exportedCount++;

      csvLines.push(
        [
          `"${r.employee_code}"`,
          `"${r.name.replace(/"/g, '""')}"`,
          `"${(b.account_holder_name || r.name).replace(/"/g, '""')}"`,
          `"${plainAccount}"`,
          `"${b.ifsc.toUpperCase()}"`,
          `"${(b.bank_name || "").replace(/"/g, '""')}"`,
          r.net_salary.toFixed(2),
          `"${narrationRef}"`,
        ].join(",")
      );
    }

    await logAudit(
      "BANK_FILE_EXPORT",
      session.user.id,
      { month, year, exportedCount, totalAmount },
      req.headers.get("x-forwarded-for")
    );

    const csvContent = csvLines.join("\r\n");
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="Bank_Payout_${month}_${year}.csv"`,
      },
    });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    console.error("[PAYROLL_GET_ERROR]", err);
    return NextResponse.json({ error: err?.message || "Internal server error fetching payroll data" }, { status: 500 });
  }
}

// POST: /api/payroll
export async function POST(req: NextRequest) {
  try {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role as string;
  if (!isAuthorizedAdminOrHR(role)) {
    return NextResponse.json({ error: "Forbidden: Admin or HR role required" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const action = body.action;

  // 1. Update Settings
  if (action === "update-settings") {
    const {
      working_hours_full_day,
      working_hours_half_day,
      late_after_time,
      lates_per_half_day_cut,
      weekly_off_day,
    } = body;

    await safeExecuteRaw(
      prisma,
      `INSERT INTO payroll_settings (
        id, working_hours_full_day, working_hours_half_day,
        late_after_time, lates_per_half_day_cut, weekly_off_day, updated_at
      ) VALUES (
        'singleton', $1, $2, $3, $4, $5, NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        working_hours_full_day = EXCLUDED.working_hours_full_day,
        working_hours_half_day = EXCLUDED.working_hours_half_day,
        late_after_time = EXCLUDED.late_after_time,
        lates_per_half_day_cut = EXCLUDED.lates_per_half_day_cut,
        weekly_off_day = EXCLUDED.weekly_off_day,
        updated_at = NOW()`,
      Number(working_hours_full_day) || 8.0,
      Number(working_hours_half_day) || 4.0,
      String(late_after_time || "10:15"),
      Number(lates_per_half_day_cut) || 3,
      Number(weekly_off_day ?? 2)
    );

    await logAudit("SETTINGS_UPDATED", session.user.id, { settings: body });
    return NextResponse.json({ success: true });
  }

  // 2. Set Employee Salary
  if (action === "set-salary") {
    const { employeeId, monthlyGross, deductionsFixed } = body;
    if (!employeeId) {
      return NextResponse.json({ error: "employeeId is required" }, { status: 400 });
    }

    const id = `sal_${employeeId}`;
    await safeExecuteRaw(
      prisma,
      `INSERT INTO payroll_salary (id, employee_id, monthly_gross, deductions_fixed, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (employee_id) DO UPDATE SET
         monthly_gross = EXCLUDED.monthly_gross,
         deductions_fixed = EXCLUDED.deductions_fixed,
         updated_at = NOW()`,
      id,
      employeeId,
      Number(monthlyGross) || 0,
      Number(deductionsFixed) || 0
    );

    await logAudit("SALARY_UPDATED", session.user.id, {
      employeeId,
      monthlyGross: Number(monthlyGross) || 0,
      deductionsFixed: Number(deductionsFixed) || 0,
    });
    return NextResponse.json({ success: true });
  }

  // 3. Set Employee Bank Details (Strict Validation & AES-256-GCM Encryption)
  if (action === "set-bank-details") {
    const {
      employeeId,
      accountHolderName,
      accountNumber,
      confirmAccountNumber,
      ifsc,
      bankName,
      upiId,
    } = body;

    if (!employeeId) {
      return NextResponse.json({ error: "employeeId is required" }, { status: 400 });
    }

    if (!accountHolderName || !accountHolderName.trim()) {
      return NextResponse.json({ error: "Account holder name is required" }, { status: 400 });
    }

    if (!accountNumber || !confirmAccountNumber) {
      return NextResponse.json({ error: "Account number and confirmation are required" }, { status: 400 });
    }

    const cleanAcc = String(accountNumber).trim();
    const cleanConfirm = String(confirmAccountNumber).trim();

    if (cleanAcc !== cleanConfirm) {
      return NextResponse.json({ error: "Account numbers do not match" }, { status: 400 });
    }

    if (!isValidAccountNumber(cleanAcc)) {
      return NextResponse.json({ error: "Invalid account number. Must be between 9 and 18 digits." }, { status: 400 });
    }

    const cleanIFSC = String(ifsc || "").trim().toUpperCase();
    if (!isValidIFSC(cleanIFSC)) {
      return NextResponse.json({
        error: "Invalid IFSC format. Must be 4 letters, followed by 0, followed by 6 alphanumeric characters.",
      }, { status: 400 });
    }

    if (!bankName || !bankName.trim()) {
      return NextResponse.json({ error: "Bank name is required" }, { status: 400 });
    }

    // Encrypt account number with AES-256-GCM
    const encryptedNumber = encryptAccountNumber(cleanAcc);
    const maskedNumber = maskAccountNumber(cleanAcc);
    const id = `bank_${employeeId}`;

    await safeExecuteRaw(
      prisma,
      `INSERT INTO payroll_bank_details (
        id, employee_id, account_holder_name, account_number_encrypted,
        account_number_masked, ifsc, bank_name, upi_id, is_verified, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, TRUE, NOW()
      )
      ON CONFLICT (employee_id) DO UPDATE SET
        account_holder_name = EXCLUDED.account_holder_name,
        account_number_encrypted = EXCLUDED.account_number_encrypted,
        account_number_masked = EXCLUDED.account_number_masked,
        ifsc = EXCLUDED.ifsc,
        bank_name = EXCLUDED.bank_name,
        upi_id = EXCLUDED.upi_id,
        is_verified = TRUE,
        updated_at = NOW()`,
      id,
      employeeId,
      accountHolderName.trim(),
      encryptedNumber,
      maskedNumber,
      cleanIFSC,
      bankName.trim(),
      upiId ? String(upiId).trim() : null
    );

    await logAudit("BANK_DETAILS_UPDATED", session.user.id, {
      employeeId,
      maskedAccount: maskedNumber,
      ifsc: cleanIFSC,
      bankName: bankName.trim(),
    });

    return NextResponse.json({ success: true, maskedNumber });
  }

  // 4. Add Paid Holiday
  if (action === "add-holiday") {
    const { date, name } = body;
    if (!date || !name) {
      return NextResponse.json({ error: "Date and name are required" }, { status: 400 });
    }

    const id = `hol_${date}`;
    await safeExecuteRaw(
      prisma,
      `INSERT INTO payroll_holidays (id, date, name) VALUES ($1, $2::date, $3)
       ON CONFLICT (date) DO UPDATE SET name = EXCLUDED.name`,
      id,
      date,
      name
    );
    return NextResponse.json({ success: true });
  }

  // 5. Delete Paid Holiday
  if (action === "delete-holiday") {
    const { id } = body;
    await safeExecuteRaw(prisma, `DELETE FROM payroll_holidays WHERE id = $1`, id);
    return NextResponse.json({ success: true });
  }

  // 6. Add Adjustment
  if (action === "add-adjustment") {
    const { employeeId, month, year, type, amount, remark } = body;
    const runs = await safeQueryRaw<any>(
      prisma,
      "payroll_runs",
      `SELECT status FROM payroll_runs WHERE employee_id = $1 AND month = $2 AND year = $3 LIMIT 1`,
      employeeId,
      Number(month),
      Number(year)
    );
    if (runs.length > 0 && runs[0].status === "finalized") {
      return NextResponse.json(
        { error: "Cannot add adjustment. This month's payroll is already finalized and locked." },
        { status: 400 }
      );
    }

    const id = `adj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    await safeExecuteRaw(
      prisma,
      `INSERT INTO payroll_adjustments (id, employee_id, month, year, type, amount, remark)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      id,
      employeeId,
      Number(month),
      Number(year),
      type,
      Number(amount) || 0,
      remark || null
    );
    return NextResponse.json({ success: true });
  }

  // 7. Generate Month
  if (action === "generate-month") {
    const { month, year } = body;
    const rows = await calculateMonthlyPayroll(prisma, Number(month), Number(year));
    return NextResponse.json({ rows });
  }

  // 8. Finalize Month
  if (action === "finalize-month") {
    const { month, year } = body;
    await calculateMonthlyPayroll(prisma, Number(month), Number(year));
    const result = await finalizeMonthlyPayroll(prisma, Number(month), Number(year));
    await logAudit("PAYROLL_FINALIZED", session.user.id, { month, year, count: result.count });
    return NextResponse.json(result);
  }

  // =========================================================================
  // 9. Automated Salary Payout Execution (Admin Confirmation Required)
  // =========================================================================
  if (action === "initiate-payout") {
    const { month, year } = body;
    const m = Number(month);
    const y = Number(year);

    // Verify payroll runs are finalized for this month
    const existingFinalized = await safeQueryRaw<any>(
      prisma,
      "payroll_runs",
      `SELECT status FROM payroll_runs WHERE month = $1 AND year = $2 AND status = 'finalized' LIMIT 1`,
      m,
      y
    );

    if (existingFinalized.length === 0) {
      return NextResponse.json(
        { error: "Payroll must be finalized before initiating salary payout." },
        { status: 400 }
      );
    }

    // Get current payroll rows
    const rows = await calculateMonthlyPayroll(prisma, m, y);

    // Get bank details with encrypted account numbers
    const bankRows = await safeQueryRaw<any>(
      prisma,
      "payroll_bank_details",
      `SELECT employee_id, account_holder_name, account_number_encrypted, ifsc, bank_name 
       FROM payroll_bank_details`
    );
    const bankMap = new Map<string, any>();
    for (const b of bankRows) {
      bankMap.set(b.employee_id, b);
    }

    const monthNames = [
      "", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];
    const narration = `Salary ${monthNames[m] || m} ${y}`;

    let processedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const r of rows) {
      // Skip if net salary is 0 or less
      if (r.net_salary <= 0) {
        skippedCount++;
        continue;
      }

      const bank = bankMap.get(r.employee_id);
      if (!bank || !bank.account_number_encrypted || !bank.ifsc) {
        skippedCount++;
        continue;
      }

      // Check if already paid or processing to enforce idempotency
      const idempotencyKey = `sal_${r.employee_id}_${m}_${y}`;
      const existingPayout = await safeQueryRaw<any>(
        prisma,
        "payroll_payouts",
        `SELECT id, status FROM payroll_payouts WHERE idempotency_key = $1 LIMIT 1`,
        idempotencyKey
      );

      if (existingPayout.length > 0 && (existingPayout[0].status === "paid" || existingPayout[0].status === "processing")) {
        // Already successfully paid or processing
        continue;
      }

      let decryptedAccount = "";
      try {
        decryptedAccount = decryptAccountNumber(bank.account_number_encrypted);
      } catch (err: any) {
        errors.push(`Decryption failed for ${r.name}`);
        continue;
      }

      const payoutReq: PayoutRequest = {
        employeeId: r.employee_id,
        employeeName: bank.account_holder_name || r.name,
        accountNumber: decryptedAccount,
        ifsc: bank.ifsc,
        amount: r.net_salary,
        month: m,
        year: y,
        narration,
        idempotencyKey,
      };

      const result = await payoutProvider.createPayout(payoutReq);
      const payoutId = `pout_${r.employee_id}_${m}_${y}`;

      await safeExecuteRaw(
        prisma,
        `INSERT INTO payroll_payouts (
          id, employee_id, month, year, amount,
          provider_payout_id, status, failure_reason, idempotency_key, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()
        )
        ON CONFLICT (idempotency_key) DO UPDATE SET
          amount = EXCLUDED.amount,
          provider_payout_id = EXCLUDED.provider_payout_id,
          status = EXCLUDED.status,
          failure_reason = EXCLUDED.failure_reason,
          updated_at = NOW()`,
        payoutId,
        r.employee_id,
        m,
        y,
        r.net_salary,
        result.providerPayoutId,
        result.status,
        result.failureReason || null,
        idempotencyKey
      );

      processedCount++;
    }

    await logAudit("PAYOUT_INITIATED", session.user.id, {
      month: m,
      year: y,
      processedCount,
      skippedCount,
      errorsCount: errors.length,
      isSandbox: payoutProvider.isSandbox,
    });

    return NextResponse.json({
      success: true,
      processedCount,
      skippedCount,
      errors,
      isSandbox: payoutProvider.isSandbox,
    });
  }

  // =========================================================================
  // 10. Retry Single Failed Payout
  // =========================================================================
  if (action === "retry-payout") {
    const { employeeId, month, year } = body;
    const m = Number(month);
    const y = Number(year);

    const rows = await calculateMonthlyPayroll(prisma, m, y);
    const r = rows.find((row) => row.employee_id === employeeId);
    if (!r) {
      return NextResponse.json({ error: "Employee payroll record not found" }, { status: 404 });
    }

    const bankRows = await safeQueryRaw<any>(
      prisma,
      "payroll_bank_details",
      `SELECT employee_id, account_holder_name, account_number_encrypted, ifsc 
       FROM payroll_bank_details WHERE employee_id = $1 LIMIT 1`,
      employeeId
    );

    if (bankRows.length === 0 || !bankRows[0].account_number_encrypted) {
      return NextResponse.json({ error: "Employee bank details are missing" }, { status: 400 });
    }

    const bank = bankRows[0];
    const decryptedAccount = decryptAccountNumber(bank.account_number_encrypted);
    const idempotencyKey = `sal_${employeeId}_${m}_${y}`;
    const narration = `Salary ${m}/${y} Retry`;

    const payoutReq: PayoutRequest = {
      employeeId,
      employeeName: bank.account_holder_name || r.name,
      accountNumber: decryptedAccount,
      ifsc: bank.ifsc,
      amount: r.net_salary,
      month: m,
      year: y,
      narration,
      idempotencyKey,
    };

    const result = await payoutProvider.createPayout(payoutReq);
    const payoutId = `pout_${employeeId}_${m}_${y}`;

    await safeExecuteRaw(
      prisma,
      `INSERT INTO payroll_payouts (
        id, employee_id, month, year, amount,
        provider_payout_id, status, failure_reason, idempotency_key, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()
      )
      ON CONFLICT (idempotency_key) DO UPDATE SET
        provider_payout_id = EXCLUDED.provider_payout_id,
        status = EXCLUDED.status,
        failure_reason = EXCLUDED.failure_reason,
        updated_at = NOW()`,
      payoutId,
      employeeId,
      m,
      y,
      r.net_salary,
      result.providerPayoutId,
      result.status,
      result.failureReason || null,
      idempotencyKey
    );

    await logAudit("PAYOUT_RETRY", session.user.id, {
      employeeId,
      month: m,
      year: y,
      status: result.status,
      failureReason: result.failureReason,
    });

    return NextResponse.json({ success: true, result });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    console.error("[PAYROLL_POST_ERROR]", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error processing payroll action" },
      { status: 500 }
    );
  }
}