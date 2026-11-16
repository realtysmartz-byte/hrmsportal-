"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  Clock,
  Calendar,
  ShieldCheck,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  FileText,
} from "lucide-react";

export function EmployeePolicyAgreementModal() {
  const { data: session, status } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const employeeId = session?.user?.id;

  useEffect(() => {
    if (status === "authenticated" && employeeId) {
      const storageKey = `policy_agreed_${employeeId}`;
      const hasAgreed = localStorage.getItem(storageKey);
      if (hasAgreed !== "true") {
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }
    }
  }, [status, employeeId]);

  if (!isOpen || !employeeId) {
    return null;
  }

  const handleAccept = () => {
    if (!agreed) return;
    setIsSubmitting(true);
    try {
      const storageKey = `policy_agreed_${employeeId}`;
      localStorage.setItem(storageKey, "true");
      setIsOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-[6px] border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] shadow-2xl flex flex-col my-auto max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-[var(--line)] bg-[var(--soft)]/50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-[4px] bg-[var(--accent)] text-white">
              <ShieldCheck className="h-5 w-5" strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-[var(--ink)]">
                Company Operational Policies & Rules
              </h2>
              <p className="text-[11px] text-[var(--muted)]">
                Realty Smartz Private Limited • Mandatory Login Agreement
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable Policy Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs leading-relaxed divide-y divide-[var(--line)]">
          {/* Policy 1: Shift & Late Coming */}
          <div className="pt-2 first:pt-0 space-y-2">
            <div className="flex items-center gap-2 text-[var(--ink)] font-bold text-xs">
              <Clock className="h-4 w-4 text-[var(--accent)] shrink-0" strokeWidth={1.8} />
              <span>1. Shift Timings, Punctuality & Late Coming Policy</span>
            </div>
            <div className="pl-6 space-y-1.5 text-[var(--muted)] text-[11px]">
              <p>
                <strong className="text-[var(--ink)]">Standard Working Hours:</strong> 10:00 AM to 07:00 PM.
              </p>
              <p>
                <strong className="text-[var(--ink)]">Grace Period:</strong> Punctual arrival is expected by 10:00 AM. A grace window is permitted up to 10:30 AM.
              </p>
              <p>
                <strong className="text-[var(--ink)]">Late Mark (10:30 AM – 11:00 AM):</strong> Check-ins between 10:30 AM and 11:00 AM are recorded as a Late Mark. Every 3 late marks in a calendar month incur a 0.5-day compensation deduction.
              </p>
              <p>
                <strong className="text-[var(--ink)]">Half Day (After 11:00 AM):</strong> Check-in after 11:00 AM is automatically logged as a Half Day with a 0.5-day compensation deduction.
              </p>
            </div>
          </div>

          {/* Policy 2: Weekly Off & Sandwich Rule */}
          <div className="pt-3 space-y-2">
            <div className="flex items-center gap-2 text-[var(--ink)] font-bold text-xs">
              <Calendar className="h-4 w-4 text-[var(--ok)] shrink-0" strokeWidth={1.8} />
              <span>2. Weekly Off (Tuesday) & Weekend Working Policy</span>
            </div>
            <div className="pl-6 space-y-1.5 text-[var(--muted)] text-[11px]">
              <p>
                <strong className="text-[var(--ink)]">Official Weekly Off:</strong> Official designated weekly off is <span className="text-[var(--accent)] font-semibold">Tuesday</span>.
              </p>
              <p>
                <strong className="text-[var(--ink)]">Weekend Working Days:</strong> <span className="text-[var(--accent)] font-semibold">Saturday and Sunday are regular mandatory working days</span>.
              </p>
              <p>
                <strong className="text-[var(--ink)]">Sandwich Rule:</strong> Taking leave on the preceding Monday (day prior to weekly off) and following Wednesday (day after weekly off) consecutively will automatically count the intervening Tuesday as a leave day with corresponding compensation adjustment.
              </p>
            </div>
          </div>

          {/* Policy 3: Leave Rules & Two-Stage Hierarchy */}
          <div className="pt-3 space-y-2">
            <div className="flex items-center gap-2 text-[var(--ink)] font-bold text-xs">
              <FileText className="h-4 w-4 text-[var(--info)] shrink-0" strokeWidth={1.8} />
              <span>3. Leave Policy & Two-Tier Approval Hierarchy</span>
            </div>
            <div className="pl-6 space-y-1.5 text-[var(--muted)] text-[11px]">
              <p>
                <strong className="text-[var(--ink)]">Probation Period:</strong> New employees during their 6-month probation period are not eligible for paid leaves and must apply for Unpaid Leave (Loss of Pay).
              </p>
              <p>
                <strong className="text-[var(--ink)]">Two-Stage Approval:</strong> All leave requests must be approved by your <span className="text-[var(--accent)] font-semibold">Reporting Manager</span> first. Once approved by the manager, it proceeds to <span className="text-[var(--accent)] font-semibold">HR Administration</span> for final authorization.
              </p>
              <p>
                <strong className="text-[var(--ink)]">Advance Notice:</strong> Planned leaves must be submitted through the portal at least 2 working days in advance.
              </p>
            </div>
          </div>

          {/* Policy 4: Geofence & Punch Integrity */}
          <div className="pt-3 space-y-2">
            <div className="flex items-center gap-2 text-[var(--ink)] font-bold text-xs">
              <MapPin className="h-4 w-4 text-[var(--warn)] shrink-0" strokeWidth={1.8} />
              <span>4. Geofencing & Location Verification Policy</span>
            </div>
            <div className="pl-6 space-y-1.5 text-[var(--muted)] text-[11px]">
              <p>
                <strong className="text-[var(--ink)]">Workplace Punch Radius:</strong> Attendance check-ins and check-outs are valid only within designated office coordinates and geofence boundary.
              </p>
              <p>
                <strong className="text-[var(--ink)]">Regularisation:</strong> Any punch recorded outside the permitted zone or missed punch requires formal administrative regularisation with managerial justification.
              </p>
            </div>
          </div>
        </div>

        {/* Footer / Agreement Checkbox */}
        <div className="p-4 border-t border-[var(--line)] bg-[var(--soft)]/30 space-y-3">
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded-[2px] border-[var(--line)] text-[var(--accent)] focus:ring-[var(--accent)] cursor-pointer"
            />
            <span className="text-[11px] text-[var(--ink)] font-medium leading-tight">
              I have read, understood, and unconditionally agree to abide by all the company policies, shift timings, leave hierarchy, and attendance rules mentioned above.
            </span>
          </label>

          <button
            type="button"
            disabled={!agreed || isSubmitting}
            onClick={handleAccept}
            className="w-full flex items-center justify-center gap-2 rounded-[4px] bg-[var(--accent)] text-white text-xs font-semibold h-11 hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>I Agree & Enter Portal</span>
          </button>
        </div>
      </div>
    </div>
  );
}
