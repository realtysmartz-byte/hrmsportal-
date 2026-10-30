-- ============================================================================
-- PAYROLL MODULE SCHEMA (Standalone - Run manually in PostgreSQL / Supabase)
-- Strict Safety:
-- 1. All new tables prefixed with payroll_
-- 2. No alterations, migrations, or drops on existing tables
-- 3. Plain text foreign references for employee_id (No FK on existing tables)
-- ============================================================================

-- 1. Employee Monthly Gross Salary and Fixed Deductions
CREATE TABLE IF NOT EXISTS payroll_salary (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL UNIQUE,
  monthly_gross DOUBLE PRECISION NOT NULL DEFAULT 0,
  deductions_fixed DOUBLE PRECISION NOT NULL DEFAULT 0,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payroll_salary_employee_id ON payroll_salary(employee_id);

-- 2. Employee Bank Details (AES-256-GCM Encrypted Account Number)
CREATE TABLE IF NOT EXISTS payroll_bank_details (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL UNIQUE,
  account_holder_name TEXT NOT NULL,
  account_number_encrypted TEXT NOT NULL,
  account_number_masked TEXT NOT NULL,
  ifsc TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  upi_id TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payroll_bank_employee_id ON payroll_bank_details(employee_id);

-- 3. Payroll Policy Thresholds and Calculation Settings
CREATE TABLE IF NOT EXISTS payroll_settings (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  working_hours_full_day DOUBLE PRECISION NOT NULL DEFAULT 8.0,
  working_hours_half_day DOUBLE PRECISION NOT NULL DEFAULT 4.0,
  late_after_time TEXT NOT NULL DEFAULT '10:15',
  lates_per_half_day_cut INTEGER NOT NULL DEFAULT 3,
  weekly_off_day INTEGER NOT NULL DEFAULT 2, -- JS getDay: 0=Sun, 1=Mon, 2=Tue... (2=Tuesday)
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 4. Paid Public / Company Holidays
CREATE TABLE IF NOT EXISTS payroll_holidays (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payroll_holidays_date ON payroll_holidays(date);

-- 5. Manual Bonuses and Deductions for a given Month & Year
CREATE TABLE IF NOT EXISTS payroll_adjustments (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('bonus', 'deduction')),
  amount DOUBLE PRECISION NOT NULL,
  remark TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payroll_adj_emp_m_y ON payroll_adjustments(employee_id, month, year);

-- 6. Monthly Payroll Calculation Runs (Draft or Finalized)
CREATE TABLE IF NOT EXISTS payroll_runs (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  present_days DOUBLE PRECISION NOT NULL DEFAULT 0,
  half_days INTEGER NOT NULL DEFAULT 0,
  absent_days INTEGER NOT NULL DEFAULT 0,
  late_marks INTEGER NOT NULL DEFAULT 0,
  weekly_off_days INTEGER NOT NULL DEFAULT 0,
  holiday_days INTEGER NOT NULL DEFAULT 0,
  paid_days DOUBLE PRECISION NOT NULL DEFAULT 0,
  per_day_salary DOUBLE PRECISION NOT NULL DEFAULT 0,
  monthly_gross DOUBLE PRECISION NOT NULL DEFAULT 0,
  gross_payable DOUBLE PRECISION NOT NULL DEFAULT 0,
  deductions DOUBLE PRECISION NOT NULL DEFAULT 0,
  additions DOUBLE PRECISION NOT NULL DEFAULT 0,
  net_salary DOUBLE PRECISION NOT NULL DEFAULT 0,
  missing_punch_out_count INTEGER NOT NULL DEFAULT 0,
  needs_review BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'finalized')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_runs_unique ON payroll_runs(employee_id, month, year);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_emp_m_y ON payroll_runs(employee_id, month, year);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_m_y_status ON payroll_runs(month, year, status);

-- 7. Automated Salary Payouts via Provider (RazorpayX)
CREATE TABLE IF NOT EXISTS payroll_payouts (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  provider_payout_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'paid', 'failed')),
  failure_reason TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_payouts_unique ON payroll_payouts(employee_id, month, year);
CREATE INDEX IF NOT EXISTS idx_payroll_payouts_status ON payroll_payouts(status);

-- 8. Immutable Security Audit Log for Payroll & Payout Operations
CREATE TABLE IF NOT EXISTS payroll_audit_log (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  performed_by TEXT NOT NULL,
  details TEXT NOT NULL,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payroll_audit_created ON payroll_audit_log(created_at);
