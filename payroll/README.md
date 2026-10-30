# Payroll Module
Tables: payroll_salary, payroll_bank_details, payroll_settings, payroll_holidays, payroll_adjustments, payroll_runs, payroll_payouts, payroll_audit_log
Endpoints: /api/payroll (get-settings, get-salaries, set-salary, set-bank-details, view-month, generate-month, finalize-month, initiate-payout, retry-payout, export-bank-file, my-payslips), /api/payroll/webhook
Per Day Salary = Monthly Gross / Total days in month (IST)
Paid Days = Present + (Half days x 0.5) + Weekly offs + Holidays - (Floor(Late marks / N) x 0.5)
Gross Payable = Round(Per Day Salary x Paid Days, 2)
Deductions = Fixed deductions + Manual adjustments
Net Salary = Max(0, Round(Gross Payable - Deductions + Additions, 2))
Automated Payout: Idempotent transfer via RazorpayX (AES-256 bank encryption, webhook verification, confirmation modal).
Security: Admin only for salary/bank/payouts, Employee sees own payslips only. Sandbox mode supported.
