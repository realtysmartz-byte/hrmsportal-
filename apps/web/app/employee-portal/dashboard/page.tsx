"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays,
  Clock,
  UserPlus,
  CalendarCheck,
  Award,
  ArrowUpRight,
  TrendingUp,
  MapPin,
  Mail,
  Phone,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Sparkles,
  Building,
  CheckCircle2,
  AlertTriangle,
  LogIn,
  LogOut,
  Bell,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { CheckInOutCard } from "@/components/CheckInOutCard";
import { UpcomingBirthdaysWidget } from "@/components/UpcomingBirthdaysWidget";
import { isWeeklyOffDay, formatTimeIST } from "@realty-smartz/shared";

export default function EmployeeDashboardPage() {
  const { data: session } = useSession();
  const userName = session?.user?.name ?? "Team Member";
  const firstName = userName.split(" ")[0];
  const userEmail = session?.user?.email ?? "employee@realtysmartz.com";
  const userCode = session?.user?.employeeCode ?? "RS-EMP";

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedDay, setSelectedDay] = useState<number>(now.getDate());
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [activeTabFilter, setActiveTabFilter] = useState<"projects" | "invoices" | "settings">("projects");

  // Queries
  const { data: monthData } = trpc.attendance.myMonth.useQuery({
    year: selectedYear,
    month: selectedMonth,
  });
  const { data: balances } = trpc.leave.myBalances.useQuery();
  const { data: today } = trpc.attendance.today.useQuery();
  const { data: recentWeek } = trpc.attendance.myRecentWeek.useQuery();
  const { data: interviews } = trpc.recruitment.myInterviews.useQuery(undefined, {
    retry: false,
  });

  // Calculate stats
  const leaveLeft = balances?.reduce((s, b) => s + b.remaining, 0) ?? 0;
  const leaveTotal = balances?.reduce((s, b) => s + b.allotted, 0) ?? 20;
  const leaveUsedPercent = leaveTotal > 0 ? Math.min(100, Math.round(((leaveTotal - leaveLeft) / leaveTotal) * 100)) : 0;
  const presentDays = monthData?.summary.present ?? 0;
  const attendanceRate = Math.min(100, Math.round((presentDays / (now.getDate() || 1)) * 100)) || 85;

  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const firstDow = new Date(selectedYear, selectedMonth - 1, 1).getDay();

  const logByDay = useMemo(() => {
    const map = new Map<number, NonNullable<typeof monthData>["logs"][number]>();
    for (const log of monthData?.logs ?? []) {
      map.set(new Date(log.date).getUTCDate(), log);
    }
    return map;
  }, [monthData]);

  const selectedLog = logByDay.get(selectedDay);

  function copyToClipboard(text: string, field: string) {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  }

  return (
    <div className="space-y-6 md:space-y-8 max-w-7xl mx-auto">
      {/* Top Banner / Breadcrumb & View Pills (Matching Image 1) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
            <span>Realty Smartz Private Limited</span>
            <span>·</span>
            <span className="text-primary font-bold">Workspace V3</span>
          </div>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
            My Profile & Workflows
          </h1>
        </div>

        {/* Segmented Capsule View Filter & Status Pill */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center rounded-full bg-neutral-100 p-1 border border-neutral-200/80 shadow-inner">
            <button
              type="button"
              onClick={() => setActiveTabFilter("projects")}
              className={`rounded-full px-3.5 py-1 text-xs font-semibold transition-all ${
                activeTabFilter === "projects"
                  ? "bg-[#181C26] text-white shadow-xs"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              Ongoing
            </button>
            <button
              type="button"
              onClick={() => setActiveTabFilter("invoices")}
              className={`rounded-full px-3.5 py-1 text-xs font-semibold transition-all ${
                activeTabFilter === "invoices"
                  ? "bg-[#181C26] text-white shadow-xs"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              Leaves
            </button>
            <button
              type="button"
              onClick={() => setActiveTabFilter("settings")}
              className={`rounded-full px-3.5 py-1 text-xs font-semibold transition-all ${
                activeTabFilter === "settings"
                  ? "bg-[#181C26] text-white shadow-xs"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              Attendance
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 shadow-2xs">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Active Session</span>
          </div>
        </div>
      </div>

      {/* 1. PRIMARY SECTION: PUNCH IN / PUNCH OUT (FIRST ON HOME PAGE) */}
      <div className="w-full">
        <CheckInOutCard />
      </div>

      {/* 2. RECENT 7-DAY SHIFTS & PUNCH RECORD SUMMARY */}
      {recentWeek && recentWeek.length > 0 && (
        <div className="rounded-2xl border border-neutral-200/80 bg-white p-4 sm:p-5 shadow-2xs">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-3.5">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <h3 className="font-display text-sm font-bold text-neutral-900">
                Recent 7-Day Shifts & Punches
              </h3>
            </div>
            <Link
              href="/employee-portal/attendance"
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
            >
              <span>Full Attendance Details</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {/* Responsive Shift Grid (Fits 100% on Mobile) */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7 text-xs">
            {recentWeek.map((day) => {
              const log = day.log;
              const isCheckedIn = Boolean(log?.checkInTime);
              const isCheckedOut = Boolean(log?.checkOutTime);

              return (
                <div
                  key={day.dateStr}
                  className={cn(
                    "flex flex-col justify-between rounded-xl p-2.5 border transition-all",
                    day.isToday
                      ? "border-primary/40 bg-primary/5 shadow-2xs"
                      : "border-neutral-200/70 bg-neutral-50/60 hover:bg-neutral-50"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[11px] text-neutral-900 truncate">
                      {day.dayName}
                    </span>
                    {day.isToday && (
                      <span className="rounded-full bg-primary/20 px-1.5 py-0.2 text-[9px] font-bold text-primary">
                        Today
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-neutral-500 block -mt-0.5">
                    {day.formattedDate.split(",")[0] || day.formattedDate}
                  </span>

                  <div className="my-2 space-y-0.5">
                    {isCheckedIn ? (
                      <>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-neutral-500 text-[10px]">In:</span>
                          <span className="font-semibold text-neutral-900">
                            {formatTimeIST(log!.checkInTime)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-neutral-500 text-[10px]">Out:</span>
                          <span className="font-semibold text-neutral-900">
                            {isCheckedOut ? formatTimeIST(log!.checkOutTime) : "On Duty"}
                          </span>
                        </div>
                      </>
                    ) : (
                      <span className="text-[11px] text-neutral-400 block py-1 font-medium">
                        {day.isWeeklyOff ? "Weekly Off" : "Absent"}
                      </span>
                    )}
                  </div>

                  <div className="pt-1.5 border-t border-neutral-200/50 flex items-center justify-between text-[10px]">
                    <span className={cn(
                      "font-semibold",
                      log?.status === "PRESENT" && "text-emerald-700",
                      log?.status === "LATE" && "text-amber-700",
                      log?.status === "HALF_DAY" && "text-amber-800",
                      log?.status === "ABSENT" && "text-rose-700",
                      !log && "text-neutral-400"
                    )}>
                      {log ? (log.status === "PRESENT" ? "Present" : log.status === "LATE" ? "Late" : log.status.replace("_", " ")) : "Off"}
                    </span>
                    {log?.totalHours != null && (
                      <span className="font-bold text-neutral-700">
                        {log.totalHours}h
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. WORKSPACE STATUS CARDS (Matching Image 1 & 2) */}
      <div className="grid gap-4 md:gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {/* Card 1: Warm Amber Pastel Card */}
        <motion.div
          whileHover={{ y: -4 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="card-pastel-amber rounded-2xl p-5 shadow-sm relative overflow-hidden"
        >
          <div className="flex items-center justify-between text-xs font-medium text-amber-800/80 mb-2">
            <span>
              {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
            <span className="rounded-full bg-amber-200/60 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
              Daily Punch
            </span>
          </div>

          <h3 className="font-display text-base font-bold text-neutral-900">
            Attendance & Geofencing
          </h3>
          <p className="text-xs text-neutral-600 mt-0.5">
            {today?.checkInTime ? "Checked In" : "Pending Check-In"} · {presentDays} days logged
          </p>

          <div className="mt-4 space-y-1.5">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-neutral-700">Attendance Rate</span>
              <span className="text-amber-900">{attendanceRate}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-amber-200/50 overflow-hidden">
              <div
                className="h-full rounded-full bg-amber-500 transition-all duration-500"
                style={{ width: `${attendanceRate}%` }}
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between pt-2 border-t border-amber-200/50">
            {/* Avatar Stack */}
            <div className="flex -space-x-2 overflow-hidden">
              <div className="inline-block h-6 w-6 rounded-full bg-amber-300 ring-2 ring-white text-[10px] font-bold flex items-center justify-center text-amber-900">
                HQ
              </div>
              <div className="inline-block h-6 w-6 rounded-full bg-indigo-300 ring-2 ring-white text-[10px] font-bold flex items-center justify-center text-indigo-900">
                RS
              </div>
              <div className="inline-block h-6 w-6 rounded-full bg-neutral-300 ring-2 ring-white text-[10px] font-bold flex items-center justify-center text-neutral-800">
                +4
              </div>
            </div>
            <span className="text-[11px] font-semibold text-amber-900 bg-amber-100/90 rounded-full px-2.5 py-0.5">
              {today?.withinGeofence ? "In Geofence" : "Location Active"}
            </span>
          </div>
        </motion.div>

        {/* Card 2: Soft Sky-Blue Pastel Card */}
        <motion.div
          whileHover={{ y: -4 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="card-pastel-blue rounded-2xl p-5 shadow-sm relative overflow-hidden"
        >
          <div className="flex items-center justify-between text-xs font-medium text-sky-800/80 mb-2">
            <span>Annual Policy 2026</span>
            <span className="rounded-full bg-sky-200/60 px-2 py-0.5 text-[11px] font-semibold text-sky-900">
              Leave Quota
            </span>
          </div>

          <h3 className="font-display text-base font-bold text-neutral-900">
            Paid Time Off & Leaves
          </h3>
          <p className="text-xs text-neutral-600 mt-0.5">
            {leaveLeft} days available · {balances?.length ?? 2} categories
          </p>

          <div className="mt-4 space-y-1.5">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-neutral-700">Remaining Balance</span>
              <span className="text-sky-900">{leaveLeft} Days</span>
            </div>
            <div className="h-2 w-full rounded-full bg-sky-200/50 overflow-hidden">
              <div
                className="h-full rounded-full bg-sky-500 transition-all duration-500"
                style={{ width: `${Math.max(15, 100 - leaveUsedPercent)}%` }}
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between pt-2 border-t border-sky-200/50">
            <div className="flex -space-x-2 overflow-hidden">
              <div className="inline-block h-6 w-6 rounded-full bg-sky-300 ring-2 ring-white text-[10px] font-bold flex items-center justify-center text-sky-900">
                CL
              </div>
              <div className="inline-block h-6 w-6 rounded-full bg-emerald-300 ring-2 ring-white text-[10px] font-bold flex items-center justify-center text-emerald-900">
                SL
              </div>
            </div>
            <Link
              href="/employee-portal/leave"
              className="text-[11px] font-semibold text-sky-900 bg-sky-100/90 rounded-full px-2.5 py-0.5 hover:bg-sky-200 transition-colors"
            >
              Apply Leave →
            </Link>
          </div>
        </motion.div>

        {/* Card 3: Soft Rose/Blush Pastel Card */}
        <motion.div
          whileHover={{ y: -4 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="card-pastel-rose rounded-2xl p-5 shadow-sm relative overflow-hidden sm:col-span-2 lg:col-span-1"
        >
          <div className="flex items-center justify-between text-xs font-medium text-rose-800/80 mb-2">
            <span>Q1 2026 Growth</span>
            <span className="rounded-full bg-rose-200/60 px-2 py-0.5 text-[11px] font-semibold text-rose-900">
              Performance
            </span>
          </div>

          <h3 className="font-display text-base font-bold text-neutral-900">
            Key Results & Growth OKRs
          </h3>
          <p className="text-xs text-neutral-600 mt-0.5">
            Active evaluation cycle · Realty Smartz Excellence
          </p>

          <div className="mt-4 space-y-1.5">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-neutral-700">Target Progress</span>
              <span className="text-rose-900">65% Progress</span>
            </div>
            <div className="h-2 w-full rounded-full bg-rose-200/50 overflow-hidden">
              <div
                className="h-full rounded-full bg-rose-500 transition-all duration-500"
                style={{ width: "65%" }}
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between pt-2 border-t border-rose-200/50">
            <div className="flex -space-x-2 overflow-hidden">
              <div className="inline-block h-6 w-6 rounded-full bg-rose-300 ring-2 ring-white text-[10px] font-bold flex items-center justify-center text-rose-900">
                HR
              </div>
              <div className="inline-block h-6 w-6 rounded-full bg-purple-300 ring-2 ring-white text-[10px] font-bold flex items-center justify-center text-purple-900">
                PM
              </div>
            </div>
            <Link
              href="/employee-portal/performance"
              className="text-[11px] font-semibold text-rose-900 bg-rose-100/90 rounded-full px-2.5 py-0.5 hover:bg-rose-200 transition-colors"
            >
              View Goals →
            </Link>
          </div>
        </motion.div>
      </div>

      {/* THREE-COLUMN BENTO GRID (Exact match to Image 1: Profile, Calendar, Inbox) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* COLUMN 1: Detailed Profile & Information (4 Cols) */}
        <div className="lg:col-span-4 space-y-5">
          <motion.div
            whileHover={{ y: -3 }}
            transition={{ duration: 0.18 }}
            className="rounded-2xl border border-neutral-200/80 bg-white p-5 md:p-6 shadow-sm"
          >
            {/* User Profile Header */}
            <div className="flex items-start gap-3.5">
              <div className="relative">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2B3A67] to-[#1E294A] text-white font-bold text-lg shadow-md">
                  {userName ? userName.charAt(0).toUpperCase() : "U"}
                </div>
                <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-white" />
              </div>

              <div className="flex-1 min-w-0">
                <h2 className="font-display text-base font-bold text-neutral-900 truncate">
                  {userName}
                </h2>
                <p className="text-xs font-medium text-neutral-500 truncate">
                  {session?.user?.role} · {userCode}
                </p>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    Realty Smartz HQ
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Action Pill Bar (Matching Image 1) */}
            <div className="mt-4 flex items-center justify-between rounded-xl bg-neutral-50 p-1.5 border border-neutral-200/60">
              <a
                href={`mailto:${userEmail}`}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-neutral-700 hover:text-primary shadow-2xs hover:bg-neutral-100 transition-colors"
                title="Send Email"
              >
                <Mail className="h-4 w-4" />
              </a>
              <Link
                href="/employee-portal/directory"
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-neutral-700 hover:text-primary shadow-2xs hover:bg-neutral-100 transition-colors"
                title="View Team Directory"
              >
                <MessageSquare className="h-4 w-4" />
              </Link>
              <button
                type="button"
                onClick={() => copyToClipboard(userEmail, "email")}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-neutral-700 hover:text-primary shadow-2xs hover:bg-neutral-100 transition-colors"
                title="Copy Email"
              >
                {copiedField === "email" ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
              <Link
                href="/employee-portal/profile"
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-neutral-700 hover:text-primary shadow-2xs hover:bg-neutral-100 transition-colors"
                title="Full Profile"
              >
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Shift & Time Slots */}
            <div className="mt-4 rounded-xl border border-neutral-200/70 p-3 bg-neutral-50/50">
              <div className="flex items-center justify-between text-xs font-semibold text-neutral-700">
                <span className="flex items-center gap-1.5 text-neutral-500">
                  <Clock className="h-3.5 w-3.5" /> Shift Timing
                </span>
                <span className="text-primary font-bold">10:00 AM – 07:00 PM</span>
              </div>
              <p className="mt-1 text-[11px] text-neutral-400">
                Weekly off: Tuesday · Saturday & Sunday active
              </p>
            </div>

            {/* Detailed Information List (Matching Image 1) */}
            <div className="mt-5 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                Detailed Information
              </h4>

              <div className="rounded-xl border border-neutral-200/60 divide-y divide-neutral-100 text-xs">
                <div className="flex items-center justify-between p-2.5">
                  <span className="text-neutral-500 font-medium">Full Name</span>
                  <span className="font-semibold text-neutral-800">{userName}</span>
                </div>

                <div className="flex items-center justify-between p-2.5">
                  <span className="text-neutral-500 font-medium">Work Email</span>
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-neutral-800 truncate max-w-[130px]">
                      {userEmail}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(userEmail, "email_row")}
                      className="text-neutral-400 hover:text-neutral-700"
                    >
                      {copiedField === "email_row" ? (
                        <Check className="h-3 w-3 text-emerald-600" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-2.5">
                  <span className="text-neutral-500 font-medium">Location</span>
                  <span className="font-semibold text-neutral-800">Gurugram HQ</span>
                </div>

                <div className="flex items-center justify-between p-2.5">
                  <span className="text-neutral-500 font-medium">Geofence Status</span>
                  <span
                    className={`font-semibold ${
                      today?.withinGeofence ? "text-emerald-700" : "text-amber-800"
                    }`}
                  >
                    {today?.withinGeofence ? "Verified Inside" : "Pending Check"}
                  </span>
                </div>
              </div>
            </div>

            {/* Link to Full Attendance & Shifts */}
            <div className="mt-5 pt-2">
              <Link href="/employee-portal/attendance" className="block w-full">
                <Button
                  variant="outline"
                  className="w-full h-10 gap-2 rounded-xl text-xs font-semibold border-neutral-200 text-neutral-800 hover:bg-neutral-50 shadow-2xs"
                >
                  <Clock className="h-4 w-4 text-primary" />
                  <span>View Full Attendance History</span>
                  <ArrowRight className="h-3.5 w-3.5 ml-auto text-neutral-400" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>

        {/* COLUMN 2: Calendar Card (4 Cols - Matching Image 1) */}
        <div className="lg:col-span-4 space-y-5">
          <motion.div
            whileHover={{ y: -3 }}
            transition={{ duration: 0.18 }}
            className="rounded-2xl border border-neutral-200/80 bg-white p-5 md:p-6 shadow-sm"
          >
            {/* Calendar Header with Navigation */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" />
                <h3 className="font-display text-base font-bold text-neutral-900">
                  {new Date(selectedYear, selectedMonth - 1).toLocaleString("en-US", {
                    month: "long",
                    year: "numeric",
                  })}
                </h3>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedMonth === 1) {
                      setSelectedMonth(12);
                      setSelectedYear((y) => y - 1);
                    } else setSelectedMonth((m) => m - 1);
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-100"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedMonth === 12) {
                      setSelectedMonth(1);
                      setSelectedYear((y) => y + 1);
                    } else setSelectedMonth((m) => m + 1);
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-100"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Calendar Day of Week Labels */}
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-neutral-400 mb-1">
              <span>S</span>
              <span>M</span>
              <span>T</span>
              <span>W</span>
              <span>T</span>
              <span>F</span>
              <span>S</span>
            </div>

            {/* Calendar Day Grid (Matching Image 1 day blocks) */}
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: firstDow }).map((_, i) => (
                <div key={`empty-${i}`} className="h-9" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const log = logByDay.get(day);
                const dow = new Date(selectedYear, selectedMonth - 1, day).getDay();
                const isToday =
                  selectedYear === now.getFullYear() &&
                  selectedMonth === now.getMonth() + 1 &&
                  day === now.getDate();
                const isSelected = selectedDay === day;
                const isOffDay = isWeeklyOffDay(dow);

                // Styling logic matching the colored tiles in Image 1
                let cellColor = "bg-white text-neutral-700 border border-neutral-200/80 hover:bg-neutral-50";

                if (log) {
                  if (log.status === "PRESENT") {
                    cellColor = "bg-[#2E9E5B] text-white font-semibold shadow-2xs";
                  } else if (log.status === "LATE" || log.status === "HALF_DAY") {
                    cellColor = "bg-[#D97706] text-white font-semibold shadow-2xs";
                  } else if (log.status === "ABSENT") {
                    cellColor = "bg-[#A82A42] text-white font-semibold shadow-2xs";
                  } else if (log.status === "ON_LEAVE") {
                    cellColor = "bg-[#3B82F6] text-white font-semibold shadow-2xs";
                  }
                } else if (isOffDay) {
                  cellColor = "bg-neutral-100 text-neutral-400";
                }

                if (isSelected) {
                  cellColor += " ring-2 ring-[#181C26] ring-offset-1";
                }

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    className={`relative flex h-9 flex-col items-center justify-center rounded-lg text-xs transition-all ${cellColor}`}
                  >
                    <span>{day}</span>
                    {isToday && (
                      <span className="absolute bottom-1 h-1 w-1 rounded-full bg-current opacity-80" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Selected Date Punch Record Details */}
            <div className="mt-5 rounded-xl border border-neutral-200/70 bg-neutral-50 p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between font-bold text-neutral-900">
                <span>
                  {new Date(selectedYear, selectedMonth - 1, selectedDay).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                {selectedLog ? (
                  <Badge variant={selectedLog.status === "PRESENT" ? "success" : "secondary"}>
                    {selectedLog.status.replace("_", " ")}
                  </Badge>
                ) : (
                  <span className="text-[11px] text-neutral-400 font-normal">No logs</span>
                )}
              </div>

              {selectedLog ? (
                <div className="space-y-1 text-neutral-600">
                  <p>
                    Check In:{" "}
                    <span className="font-semibold text-neutral-900">
                      {selectedLog.checkInTime
                        ? new Date(selectedLog.checkInTime).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </span>
                  </p>
                  {selectedLog.checkOutTime && (
                    <p>
                      Check Out:{" "}
                      <span className="font-semibold text-neutral-900">
                        {new Date(selectedLog.checkOutTime).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </p>
                  )}
                  <p className="truncate text-[11px] text-neutral-500">
                    📍 {(selectedLog.checkInAddress ? selectedLog.checkInAddress.replace(/sunbreeze/gi, "Realty Smartz Private Limited") : "Realty Smartz Private Limited HQ, Gurugram")}
                  </p>
                </div>
              ) : (
                <p className="text-[11px] text-neutral-400">
                  Select any day to inspect check-in and checkout times.
                </p>
              )}
            </div>

            {/* Calendar Legend */}
            <div className="mt-4 flex flex-wrap items-center justify-between text-[11px] text-neutral-500 pt-2 border-t border-neutral-100">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#2E9E5B]" />
                <span>Present</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#D97706]" />
                <span>Late</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#A82A42]" />
                <span>Absent</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#3B82F6]" />
                <span>Leave</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* COLUMN 3: Inbox / Activities & Tasks (4 Cols - Matching Image 1 & 2) */}
        <div className="lg:col-span-4 space-y-5">
          {/* Upcoming Birthdays Widget */}
          <UpcomingBirthdaysWidget portal="employee" />

          {/* Inbox Feed Card */}
          <motion.div
            whileHover={{ y: -3 }}
            transition={{ duration: 0.18 }}
            className="rounded-2xl border border-neutral-200/80 bg-white p-5 md:p-6 shadow-sm space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                <h3 className="font-display text-base font-bold text-neutral-900">
                  Inbox & Updates
                </h3>
              </div>
              <Link
                href="/employee-portal/dashboard"
                className="text-[11px] font-semibold text-primary hover:underline"
              >
                View all
              </Link>
            </div>

            {/* Featured Message Pill (Matching Image 1 dark bubble) */}
            <div className="rounded-xl bg-[#181C26] p-3 text-white shadow-sm flex items-start gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-500 font-bold text-xs text-white">
                HR
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate">
                  Realty Smartz HR Notice
                </p>
                <p className="text-[11px] text-neutral-300 mt-0.5 line-clamp-2">
                  "Please ensure all geofence punches are submitted by 9:30 AM for on-time marking."
                </p>
              </div>
            </div>

            {/* Interviews / Meetings Feed */}
            <div className="space-y-2.5 pt-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                Scheduled Rounds
              </h4>

              {interviews && interviews.length > 0 ? (
                interviews.slice(0, 2).map((iv) => (
                  <div
                    key={iv.id}
                    className="flex items-center justify-between rounded-xl border border-neutral-200/70 p-3 hover:bg-neutral-50 transition-colors"
                  >
                    <div>
                      <p className="text-xs font-semibold text-neutral-900">
                        {iv.roundName}
                      </p>
                      <p className="text-[11px] text-neutral-500">
                        {iv.candidate.fullName} · {new Date(iv.scheduledAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {iv.status}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-neutral-200 p-3 text-center text-xs text-neutral-400">
                  No pending interview rounds.
                </div>
              )}
            </div>

            {/* Daily Tasks Checklist (Matching Image 2) */}
            <div className="space-y-2 pt-2 border-t border-neutral-100">
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                Today's Tasks
              </h4>

              <div className="space-y-2">
                <div className="flex items-center gap-2.5 rounded-lg border border-neutral-200/60 p-2.5 text-xs text-neutral-800">
                  <div className="flex h-4 w-4 items-center justify-center rounded-md bg-emerald-500 text-white">
                    <Check className="h-3 w-3" />
                  </div>
                  <span className="line-through text-neutral-400 truncate">
                    Daily office attendance check-in
                  </span>
                </div>

                <div className="flex items-center gap-2.5 rounded-lg border border-neutral-200/60 p-2.5 text-xs text-neutral-800">
                  <div className="h-4 w-4 rounded-md border border-neutral-300" />
                  <span className="truncate">Review leave quota & team requests</span>
                </div>

                <div className="flex items-center gap-2.5 rounded-lg border border-neutral-200/60 p-2.5 text-xs text-neutral-800">
                  <div className="h-4 w-4 rounded-md border border-neutral-300" />
                  <span className="truncate">Check Q1 OKR performance milestones</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
