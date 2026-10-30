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
            <p className="text-sm font-semibold text-neutral-800">No finalized payslips available</p>
            <p className="text-xs text-neutral-500 mt-1">
              Your payslip will appear here once the month&apos;s payroll is finalized by HR.
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
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-neutral-200 max-h-[92vh] overflow-y-auto">
            {/* Payslip Document (Printed Content) */}
            <div id="printable-payslip" className="border border-neutral-300 rounded-xl p-6 bg-white space-y-5">
              {/* Company & Document Header */}
              <div className="flex justify-between items-start border-b border-neutral-200 pb-4">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-neutral-900">Realty Smartz HRMS</h2>
                  <p className="text-xs text-neutral-500">Official Monthly Salary Statement</p>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-neutral-800">PAYSLIP</div>
                  <div className="text-xs text-neutral-500 font-medium">
                    {months[selectedPayslip.month]} {selectedPayslip.year}
                  </div>
                </div>
              </div>

              {/* Employee Summary Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-neutral-50 p-3 rounded-lg border border-neutral-200 text-xs">
                <div>
                  <div className="text-neutral-500 text-[10px] uppercase font-semibold">Employee Name</div>
                  <div className="font-semibold text-neutral-900">{selectedPayslip.employeeName}</div>
                </div>
                <div>
                  <div className="text-neutral-500 text-[10px] uppercase font-semibold">Employee Code</div>
                  <div className="font-mono text-neutral-900">{selectedPayslip.employeeCode}</div>
                </div>
                <div>
                  <div className="text-neutral-500 text-[10px] uppercase font-semibold">Department</div>
                  <div className="text-neutral-900">{selectedPayslip.department}</div>
                </div>
                <div>
                  <div className="text-neutral-500 text-[10px] uppercase font-semibold">Designation</div>
                  <div className="text-neutral-900">{selectedPayslip.designation}</div>
                </div>
              </div>

              {/* Attendance & Leave Breakdown */}
              <div>
                <h3 className="text-xs font-bold text-neutral-800 uppercase tracking-wider mb-2">
                  Attendance Details
                </h3>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs">
                  <div className="bg-neutral-50 border border-neutral-200 rounded p-2">
                    <div className="text-[10px] text-neutral-500 font-medium">Present</div>
                    <div className="font-bold text-neutral-900 mt-0.5">{selectedPayslip.presentDays}</div>
                  </div>
                  <div className="bg-neutral-50 border border-neutral-200 rounded p-2">
                    <div className="text-[10px] text-neutral-500 font-medium">Half Days</div>
                    <div className="font-bold text-neutral-900 mt-0.5">{selectedPayslip.halfDays}</div>
                  </div>
                  <div className="bg-neutral-50 border border-neutral-200 rounded p-2">
                    <div className="text-[10px] text-neutral-500 font-medium">Weekly Offs</div>
                    <div className="font-bold text-neutral-900 mt-0.5">{selectedPayslip.weeklyOffDays}</div>
                  </div>
                  <div className="bg-neutral-50 border border-neutral-200 rounded p-2">
                    <div className="text-[10px] text-neutral-500 font-medium">Holidays</div>
                    <div className="font-bold text-neutral-900 mt-0.5">{selectedPayslip.holidayDays}</div>
                  </div>
                  <div className="bg-neutral-50 border border-neutral-200 rounded p-2">
                    <div className="text-[10px] text-neutral-500 font-medium">Late Marks</div>
                    <div className="font-bold text-neutral-900 mt-0.5">{selectedPayslip.lateMarks}</div>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 rounded p-2">
                    <div className="text-[10px] text-emerald-700 font-bold">Paid Days</div>
                    <div className="font-bold text-emerald-900 mt-0.5">{selectedPayslip.paidDays}</div>
                  </div>
                </div>
              </div>

              {/* Earnings & Deductions Tables */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* Earnings */}
                <div className="border border-neutral-200 rounded-lg overflow-hidden">
                  <div className="bg-neutral-100 px-3 py-1.5 font-bold text-neutral-800">Earnings</div>
                  <div className="p-3 space-y-2">
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
                  <div className="p-3 space-y-2">
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
              <div className="bg-neutral-900 text-white rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                    Net Salary Payable
                  </div>
                  <div className="text-2xl font-black tracking-tight text-white mt-0.5">
                    ₹{selectedPayslip.netSalary.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className={`inline-block px-3 py-1 rounded text-xs font-bold ${
                      selectedPayslip.payoutStatus === "paid"
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

            {/* Modal Controls */}
            <div className="flex justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={() => setSelectedPayslip(null)}
                className="px-4 py-2 border border-neutral-300 text-xs font-semibold rounded-lg text-neutral-700 hover:bg-neutral-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-neutral-900 text-white text-xs font-semibold rounded-lg hover:bg-neutral-800"
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
