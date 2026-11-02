"use client";

import { useState, useEffect } from "react";

interface PayslipItem {
  id: string;
  month: number;
  year: number;
  employeeName: string;
  employeeCode: string;
  department: string;
  designation: string;
  presentDays: number;
  halfDays: number;
  absentDays: number;
  approvedLeaveDays?: number;
  lateMarks: number;
  weeklyOffDays: number;
  holidayDays: number;
  paidDays: number;
  perDaySalary: number;
  monthlyGross: number;
  grossPayable: number;
  deductions: number;
  additions: number;
  netSalary: number;
  payoutStatus: "paid" | "processing" | "queued" | "failed" | "unpaid";
  paidOnDate: string | null;
  createdAt: string;
}

export function EmployeePayslipsScreen() {
  const [payslips, setPayslips] = useState<PayslipItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPayslip, setSelectedPayslip] = useState<PayslipItem | null>(null);

  useEffect(() => {
    async function loadPayslips() {
      try {
        const res = await fetch("/api/payroll?action=my-payslips");
        const data = await res.json();
        if (res.ok) {
          setPayslips(data.payslips || []);
        }
      } finally {
        setIsLoading(false);
      }
    }
    void loadPayslips();
  }, []);

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (!selectedPayslip) return;
    const scrollY = window.scrollY;
    const originalPosition = document.body.style.position;
    const originalTop = document.body.style.top;
    const originalWidth = document.body.style.width;
    const originalOverflow = document.body.style.overflow;

    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.position = originalPosition;
      document.body.style.top = originalTop;
      document.body.style.width = originalWidth;
      document.body.style.overflow = originalOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [selectedPayslip]);

  const months = [
    "",
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  return (
    <div className="space-y-4 max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="border-b border-neutral-200 pb-3">
        <h1 className="text-xl font-bold text-neutral-900 tracking-tight">My Payslips</h1>
        <p className="text-xs text-neutral-500">View and print your finalized monthly salary payslips and payment receipts.</p>
      </div>

      {/* Main List */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-neutral-500">Loading payslips...</div>
        ) : payslips.length === 0 ? (
          <div className="p-10 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-neutral-800">No paid payslips available yet</p>
              <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                Your payslip will appear here once your monthly salary has been disbursed and marked as paid by HR.
              </p>
          </div>
        ) : (
          <div className="overflow-x-auto max-w-full">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-neutral-50/80 border-b border-neutral-200 text-neutral-600 font-semibold">
                  <th className="py-2.5 px-3">Month &amp; Year</th>
                  <th className="py-2.5 px-3 text-center">Paid Days</th>
                  <th className="py-2.5 px-3 text-right">Gross Payable</th>
                  <th className="py-2.5 px-3 text-right">Deductions</th>
                  <th className="py-2.5 px-3 text-right">Net Salary</th>
                  <th className="py-2.5 px-3 text-center">Payment Status</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-neutral-700">
                {payslips.map((p) => (
                  <tr key={p.id} className="hover:bg-neutral-50/50">
                    <td className="py-2.5 px-3 font-semibold text-neutral-900">
                      {months[p.month]} {p.year}
                    </td>
                    <td className="py-2.5 px-3 text-center">{p.paidDays} days</td>
                    <td className="py-2.5 px-3 text-right">₹{p.grossPayable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    <td className="py-2.5 px-3 text-right text-rose-600">-₹{p.deductions.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-neutral-900 text-sm">
                      ₹{p.netSalary.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {p.payoutStatus === "paid" ? (
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {p.paidOnDate ? `Paid on ${p.paidOnDate}` : "Paid"}
                        </span>
                      ) : p.payoutStatus === "processing" || p.payoutStatus === "queued" ? (
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                          Processing
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-neutral-100 text-neutral-600">
                          Pending Payout
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedPayslip(p)}
                        className="px-2.5 py-1 text-xs font-semibold rounded bg-neutral-900 text-white hover:bg-neutral-800 transition-colors"
                      >
                        View / Print
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Printable Payslip Modal */}
      {selectedPayslip && (
                <div
                  className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 touch-none"
                  onClick={() => setSelectedPayslip(null)}
                >
                  <div
                    className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-neutral-200 max-h-[92vh] flex flex-col overflow-hidden my-auto overscroll-contain"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Top Modal Header with quick Close button */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 bg-neutral-50/90 shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                          {months[selectedPayslip.month]} {selectedPayslip.year} Payslip
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {selectedPayslip.paidOnDate ? `Paid on ${selectedPayslip.paidOnDate}` : "Paid"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedPayslip(null)}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200 transition-colors"
                        aria-label="Close"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                        {/* Scrollable Document Area */}
                        <div className="flex-1 overflow-y-auto p-3 sm:p-6 overscroll-contain">
                          {/* Payslip Document (Printed Content) */}
                          <div id="printable-payslip" className="border border-neutral-300 rounded-xl p-3.5 sm:p-6 bg-white space-y-4 sm:space-y-5">
                            {/* Company & Document Header */}
                            <div className="flex justify-between items-start border-b border-neutral-200 pb-3 sm:pb-4">
                              <div>
                                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-neutral-900">Realty Smartz HRMS</h2>
                                <p className="text-[11px] sm:text-xs text-neutral-500">Official Monthly Salary Statement</p>
                              </div>
                              <div className="text-right">
                                <div className="text-xs sm:text-sm font-bold text-neutral-800">PAYSLIP</div>
                                <div className="text-[11px] sm:text-xs text-neutral-500 font-medium">
                                  {months[selectedPayslip.month]} {selectedPayslip.year}
                                </div>
                              </div>
                            </div>

                                {/* Employee Summary Grid */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 bg-neutral-50 p-2.5 sm:p-3 rounded-lg border border-neutral-200 text-xs">
                                  <div>
                                    <div className="text-neutral-500 text-[10px] uppercase font-semibold">Employee Name</div>
                                    <div className="font-semibold text-neutral-900 truncate">{selectedPayslip.employeeName}</div>
                                  </div>
                                    <div>
                                      <div className="text-neutral-500 text-[10px] uppercase font-semibold">Employee Code</div>
                                      <div className="font-mono text-neutral-900 truncate">{selectedPayslip.employeeCode}</div>
                                    </div>
                                      <div>
                                        <div className="text-neutral-500 text-[10px] uppercase font-semibold">Department</div>
                                        <div className="text-neutral-900 truncate">{selectedPayslip.department}</div>
                                      </div>
                                        <div>
                                          <div className="text-neutral-500 text-[10px] uppercase font-semibold">Designation</div>
                                          <div className="text-neutral-900 truncate">{selectedPayslip.designation}</div>
                                        </div>
                                      </div>

                                            {/* Attendance & Leave Breakdown */}
                                            <div>
                                              <h3 className="text-xs font-bold text-neutral-800 uppercase tracking-wider mb-2">
                                                Attendance Details
                                              </h3>
                                              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-1.5 sm:gap-2 text-center text-xs">
                                                <div className="bg-neutral-50 border border-neutral-200 rounded p-1.5 sm:p-2">
                                                  <div className="text-[10px] text-neutral-500 font-medium">Present</div>
                                                  <div className="font-bold text-neutral-900 mt-0.5">{selectedPayslip.presentDays}</div>
                                                </div>
                                                  <div className="bg-neutral-50 border border-neutral-200 rounded p-1.5 sm:p-2">
                                                    <div className="text-[10px] text-neutral-500 font-medium">Half Days</div>
                                                    <div className="font-bold text-neutral-900 mt-0.5">{selectedPayslip.halfDays}</div>
                                                  </div>
                                                    <div className="bg-emerald-50/70 border border-emerald-200 rounded p-1.5 sm:p-2">
                                                      <div className="text-[10px] text-emerald-700 font-medium">Approved Leaves</div>
                                                      <div className="font-bold text-emerald-800 mt-0.5">{selectedPayslip.approvedLeaveDays ?? 0}</div>
                                                    </div>
                                                          <div className="bg-neutral-50 border border-neutral-200 rounded p-1.5 sm:p-2">
                                                            <div className="text-[10px] text-neutral-500 font-medium">Weekly Offs</div>
                                                            <div className="font-bold text-neutral-900 mt-0.5">{selectedPayslip.weeklyOffDays}</div>
                                                          </div>
                                                          <div className="bg-neutral-50 border border-neutral-200 rounded p-1.5 sm:p-2">
                                                            <div className="text-[10px] text-neutral-500 font-medium">Holidays</div>
                                                            <div className="font-bold text-neutral-900 mt-0.5">{selectedPayslip.holidayDays}</div>
                                                          </div>
                                                          <div className="bg-neutral-50 border border-neutral-200 rounded p-1.5 sm:p-2">
                                                            <div className="text-[10px] text-neutral-500 font-medium">Late Marks</div>
                                                            <div className="font-bold text-neutral-900 mt-0.5">{selectedPayslip.lateMarks}</div>
                                                          </div>
                                                          <div className="bg-emerald-50 border border-emerald-300 rounded p-1.5 sm:p-2 col-span-3 sm:col-span-1">
                                                            <div className="text-[10px] text-emerald-700 font-bold">Paid Days</div>
                                                            <div className="font-bold text-emerald-900 mt-0.5">{selectedPayslip.paidDays}</div>
                                                          </div>
                                                      </div>
                </div>

                                                  {/* Earnings & Deductions Tables */}
                                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs">
                                                    {/* Earnings */}
                                                    <div className="border border-neutral-200 rounded-lg overflow-hidden">
                                                      <div className="bg-neutral-100 px-3 py-1.5 font-bold text-neutral-800">Earnings</div>
                                                      <div className="p-2.5 sm:p-3 space-y-2">
                                                        <div className="flex justify-between text-neutral-600">
                                                          <span>Monthly Gross Rate:</span>
                                                          <span className="font-medium text-neutral-900">
                                                            ₹{selectedPayslip.monthlyGross.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                                          </span>
                                                        </div>
                                                        <div className="flex justify-between text-neutral-600">
                                                          <span>Per Day Salary:</span>
                                                          <span className="font-medium text-neutral-900">
                                                            ₹{selectedPayslip.perDaySalary.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                                          </span>
                                                        </div>
                                                        <div className="flex justify-between text-neutral-600">
                                                          <span>Gross Payable ({selectedPayslip.paidDays}d):</span>
                                                          <span className="font-medium text-neutral-900">
                                                            ₹{selectedPayslip.grossPayable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                                          </span>
                                                        </div>
                                                        {selectedPayslip.additions > 0 && (
                                                          <div className="flex justify-between text-emerald-700">
                                                            <span>Bonuses / Additions:</span>
                                                            <span className="font-medium">
                                                              +₹{selectedPayslip.additions.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                                            </span>
                                                          </div>
                                                        )}
                                                      </div>
                                                    </div>

                                                    {/* Deductions */}
                                                    <div className="border border-neutral-200 rounded-lg overflow-hidden">
                                                      <div className="bg-neutral-100 px-3 py-1.5 font-bold text-neutral-800">Deductions</div>
                                                      <div className="p-2.5 sm:p-3 space-y-2">
                                                        <div className="flex justify-between text-neutral-600">
                                                          <span>Total Deductions:</span>
                                                          <span className="font-medium text-rose-600">
                                                            -₹{selectedPayslip.deductions.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                                          </span>
                                                        </div>
                                                        <div className="text-[11px] text-neutral-500 pt-2 border-t border-neutral-100">
                                                          Includes fixed salary deductions, manual cuts, and attendance-based penalty adjustments.
                                                        </div>
                                                      </div>
                                                    </div>
                                                  </div>

                                                        {/* Net Salary Highlight & Payment Receipt Bar */}
                                                        <div className="bg-neutral-900 text-white rounded-xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                                          <div>
                                                            <div className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                                                              Net Salary Payable
                                                            </div>
                                                              <div className="text-xl sm:text-2xl font-black tracking-tight text-white mt-0.5">
                                                                ₹{selectedPayslip.netSalary.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                                              </div>
                                                            </div>

                                                              <div className="w-full sm:w-auto text-left sm:text-right">
                                                                <span
                                                                  className={`inline-block px-3 py-1 rounded text-xs font-bold ${selectedPayslip.payoutStatus === "paid"
                                                                      ? "bg-emerald-500 text-white"
                                                                      : selectedPayslip.payoutStatus === "processing"
                                                                        ? "bg-blue-500 text-white"
                                                                        : "bg-neutral-800 text-neutral-300"
                                                                    }`}
                                                                >
                                                                  {selectedPayslip.payoutStatus === "paid"
                                                                    ? selectedPayslip.paidOnDate
                                                                      ? `Paid on ${selectedPayslip.paidOnDate}`
                                                                      : "Salary Paid"
                                                                    : "Pending Disbursement"}
                                                                </span>
                                                              </div>
                                                            </div>

                                                              {/* Footer Note */}
                                                              <div className="text-center text-[10px] text-neutral-400 pt-2 border-t border-neutral-100">
                                                                This is a computer-generated statement issued by Realty Smartz HRMS and does not require a physical signature.
                                                              </div>
                                                            </div>
                                                          </div>

                                                            {/* Modal Bottom Controls */}
                                                            <div className="flex justify-end gap-2 p-3 sm:px-6 sm:py-4 border-t border-neutral-200 bg-neutral-50/80 shrink-0">
                                                              <button
                                                                type="button"
                                                                onClick={() => setSelectedPayslip(null)}
                                                                className="px-4 py-2 border border-neutral-300 text-xs font-semibold rounded-lg text-neutral-700 hover:bg-neutral-100 transition-colors"
                                                              >
                                                                Close
                                                              </button>
                                                              <button
                                                                type="button"
                                                                onClick={() => window.print()}
                                                                className="px-4 py-2 bg-neutral-900 text-white text-xs font-semibold rounded-lg hover:bg-neutral-800 transition-colors"
                                                              >
                                                                Print / Save PDF
                                                              </button>
                                                            </div>
                                                          </div>
                                                        </div>
      )}
                                                      </div>
                                                      );
}
