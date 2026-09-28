"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Building2,
  Users,
  FileText,
  BriefcaseBusiness,
  ArrowRight,
  UserPlus,
  Clock,
  Sparkles,
  Calendar,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  MapPin,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  Layers,
  ArrowUpRight,
} from "lucide-react";
import { EmployeeCard } from "@/components/EmployeeCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageSkeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { formatDate } from "@/lib/utils";
import { UpcomingBirthdaysWidget } from "@/components/UpcomingBirthdaysWidget";

export default function AdminDashboardPage() {
  const [activeTabFilter, setActiveTabFilter] = useState<"overview" | "workforce" | "approvals">("overview");

  const { data, isLoading } = trpc.employee.dashboardStats.useQuery();
  const { data: pendingLeave } = trpc.leave.pendingApprovals.useQuery();
  const { data: jobs } = trpc.recruitment.jobList.useQuery(
    { status: "OPEN" },
    { retry: false }
  );

  if (isLoading) {
    return <PageSkeleton />;
  }

  const totalEmployees = data?.totalEmployees ?? 0;
  const deptCount = data?.departmentCount ?? 0;
  const pendingLeaveCount = pendingLeave?.length ?? 0;
  const openJobsCount = jobs?.length ?? 0;

  const currentDateFormatted = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="space-y-6 md:space-y-8 max-w-7xl mx-auto">
      {/* Top Banner / Header & View Filter Pills (Matching Image 1 & 2) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
            <span>Realty Smartz Private Limited</span>
            <span>·</span>
            <span className="text-primary font-bold">Admin Console V3</span>
          </div>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
            Executive Overview & Operations
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-neutral-500">
            Company-wide workforce telemetry, live attendance, and managerial workflows
          </p>
        </div>

        {/* View Switcher Capsule & Quick Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Segmented Filter Pills */}
          <div className="flex items-center rounded-full bg-white p-1 border border-neutral-200/80 shadow-xs">
            <button
              type="button"
              onClick={() => setActiveTabFilter("overview")}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                activeTabFilter === "overview"
                  ? "bg-gradient-to-r from-[#FF7A70] to-[#FFA07A] text-white shadow-[0_2px_10px_rgba(255,122,112,0.3)] font-bold"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => setActiveTabFilter("workforce")}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                activeTabFilter === "workforce"
                  ? "bg-gradient-to-r from-[#FF7A70] to-[#FFA07A] text-white shadow-[0_2px_10px_rgba(255,122,112,0.3)] font-bold"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              Workforce
            </button>
            <button
              type="button"
              onClick={() => setActiveTabFilter("approvals")}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                activeTabFilter === "approvals"
                  ? "bg-gradient-to-r from-[#FF7A70] to-[#FFA07A] text-white shadow-[0_2px_10px_rgba(255,122,112,0.3)] font-bold"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              Approvals
            </button>
          </div>

          {/* Quick Action Buttons */}
          <Link href="/admin-portal/attendance/team">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full border-neutral-200 bg-white shadow-2xs gap-1.5 text-xs hover:bg-neutral-50 font-medium"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Team
            </Button>
          </Link>
          <Link href="/admin-portal/employees/new">
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#FF7A70] to-[#FFA07A] px-4 py-2 text-xs font-bold text-white shadow-[0_4px_16px_rgba(255,122,112,0.35)] hover:opacity-95 active:scale-95 transition-all"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Add Employee
            </button>
          </Link>
        </div>
      </div>

      {/* TOP ROW: 4 Pastel Status / KPI Cards (Dashboards V3 Style) */}
      <div className="grid gap-4 md:gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Warm Amber Pastel Card (Headcount) */}
        <Link href="/admin-portal/employees" className="block">
          <motion.div
            whileHover={{ y: -4 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="card-pastel-amber h-full rounded-2xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between text-xs font-medium text-amber-800/80 mb-2">
                <span>{currentDateFormatted}</span>
                <span className="rounded-full bg-amber-200/60 px-2 py-0.5 text-[10px] font-semibold text-amber-900 uppercase">
                  Active
                </span>
              </div>
              <h3 className="font-display text-base font-bold text-neutral-900">
                Total Headcount
              </h3>
              <p className="text-xs text-neutral-600 mt-0.5">
                Staff & Core Contributors
              </p>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="font-display text-3xl font-bold text-neutral-900">
                  {totalEmployees}
                </span>
                <span className="flex items-center gap-0.5 text-xs font-semibold text-emerald-700">
                  <ArrowUpRight className="h-3.5 w-3.5" /> 100% On-roll
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-amber-200/50 overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-500"
                  style={{ width: "88%" }}
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between pt-2 border-t border-amber-200/60">
              <div className="flex -space-x-1.5 overflow-hidden">
                <div className="inline-block h-6 w-6 rounded-full bg-amber-300 ring-2 ring-white text-[10px] font-bold flex items-center justify-center text-amber-900">
                  RS
                </div>
                <div className="inline-block h-6 w-6 rounded-full bg-indigo-300 ring-2 ring-white text-[10px] font-bold flex items-center justify-center text-indigo-900">
                  HR
                </div>
                <div className="inline-block h-6 w-6 rounded-full bg-neutral-300 ring-2 ring-white text-[10px] font-bold flex items-center justify-center text-neutral-800">
                  +{Math.max(0, totalEmployees - 2)}
                </div>
              </div>
              <span className="text-[11px] font-semibold text-amber-900 bg-amber-100/90 rounded-full px-2.5 py-0.5 flex items-center gap-1">
                Directory <ChevronRight className="h-3 w-3" />
              </span>
            </div>
          </motion.div>
        </Link>

        {/* Card 2: Sky Blue Pastel Card (Departments) */}
        <Link href="/admin-portal/departments" className="block">
          <motion.div
            whileHover={{ y: -4 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="card-pastel-blue h-full rounded-2xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between text-xs font-medium text-sky-800/80 mb-2">
                <span>Org Matrix</span>
                <span className="rounded-full bg-sky-200/60 px-2 py-0.5 text-[10px] font-semibold text-sky-900 uppercase">
                  Units
                </span>
              </div>
              <h3 className="font-display text-base font-bold text-neutral-900">
                Departments
              </h3>
              <p className="text-xs text-neutral-600 mt-0.5">
                Functional Teams & Roles
              </p>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="font-display text-3xl font-bold text-neutral-900">
                  {deptCount}
                </span>
                <span className="text-xs font-semibold text-sky-800">
                  Active Divisions
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-sky-200/50 overflow-hidden">
                <div
                  className="h-full rounded-full bg-sky-500"
                  style={{ width: "75%" }}
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between pt-2 border-t border-sky-200/60">
              <span className="text-[11px] font-medium text-sky-900">
                Structure & Hierarchy
              </span>
              <span className="text-[11px] font-semibold text-sky-900 bg-sky-100/90 rounded-full px-2.5 py-0.5 flex items-center gap-1">
                Manage <ChevronRight className="h-3 w-3" />
              </span>
            </div>
          </motion.div>
        </Link>

        {/* Card 3: Soft Blush Rose Pastel Card (Pending Leave Approvals) */}
        <Link href="/admin-portal/leave/approvals" className="block">
          <motion.div
            whileHover={{ y: -4 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="card-pastel-rose h-full rounded-2xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between text-xs font-medium text-rose-800/80 mb-2">
                <span>Action Queue</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    pendingLeaveCount > 0
                      ? "bg-rose-200/80 text-rose-950 font-bold"
                      : "bg-emerald-200/70 text-emerald-900"
                  }`}
                >
                  {pendingLeaveCount > 0 ? "Urgent" : "Cleared"}
                </span>
              </div>
              <h3 className="font-display text-base font-bold text-neutral-900">
                Leave Approvals
              </h3>
              <p className="text-xs text-neutral-600 mt-0.5">
                Requests Awaiting Decision
              </p>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="font-display text-3xl font-bold text-neutral-900">
                  {pendingLeaveCount}
                </span>
                <span className="text-xs font-semibold text-rose-800">
                  {pendingLeaveCount > 0 ? "Action Required" : "Zero Backlog"}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-rose-200/50 overflow-hidden">
                <div
                  className="h-full rounded-full bg-rose-500"
                  style={{ width: pendingLeaveCount > 0 ? "90%" : "0%" }}
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between pt-2 border-t border-rose-200/60">
              <span className="text-[11px] font-medium text-rose-900">
                {pendingLeaveCount} pending items
              </span>
              <span className="text-[11px] font-semibold text-rose-900 bg-rose-100/90 rounded-full px-2.5 py-0.5 flex items-center gap-1">
                Review <ChevronRight className="h-3 w-3" />
              </span>
            </div>
          </motion.div>
        </Link>

        {/* Card 4: Soft Mint Pastel Card (Talent & Requisitions) */}
        <Link href="/admin-portal/recruitment" className="block">
          <motion.div
            whileHover={{ y: -4 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="card-pastel-mint h-full rounded-2xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between text-xs font-medium text-emerald-800/80 mb-2">
                <span>Hiring Pipeline</span>
                <span className="rounded-full bg-emerald-200/60 px-2 py-0.5 text-[10px] font-semibold text-emerald-900 uppercase">
                  Talent
                </span>
              </div>
              <h3 className="font-display text-base font-bold text-neutral-900">
                Open Requisitions
              </h3>
              <p className="text-xs text-neutral-600 mt-0.5">
                Active Job Openings
              </p>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="font-display text-3xl font-bold text-neutral-900">
                  {openJobsCount}
                </span>
                <span className="text-xs font-semibold text-emerald-800">
                  Active Openings
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-emerald-200/50 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: "65%" }}
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between pt-2 border-t border-emerald-200/60">
              <span className="text-[11px] font-medium text-emerald-900">
                Candidate Pipeline
              </span>
              <span className="text-[11px] font-semibold text-emerald-900 bg-emerald-100/90 rounded-full px-2.5 py-0.5 flex items-center gap-1">
                Explore <ChevronRight className="h-3 w-3" />
              </span>
            </div>
          </motion.div>
        </Link>
      </div>

      {/* 3-COLUMN BENTO GRID (Dashboards V3 Signature Layout) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* COLUMN 1: Organization Quick Control & Company Profile (~3.5/12 cols) */}
        <div className="space-y-5 lg:col-span-4">
          {/* Quick Operation Cards (Inspired by Image 2's action cards) */}
          <div className="glass-card rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-sm font-bold text-neutral-900">
                  Quick Management
                </h3>
                <p className="text-[11px] text-neutral-500">
                  Frequent executive actions
                </p>
              </div>
              <div className="h-7 w-7 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              <Link
                href="/admin-portal/employees/new"
                className="group flex items-center justify-between rounded-xl border border-neutral-200/80 bg-white/70 p-3 hover:bg-neutral-50 hover:border-neutral-300 transition-all shadow-2xs"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 group-hover:scale-105 transition-transform">
                    <UserPlus className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-neutral-900">
                      Onboard Employee
                    </p>
                    <p className="text-[11px] text-neutral-500">
                      Issue ID & assign role
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-neutral-400 group-hover:text-neutral-700 transition-colors" />
              </Link>

              <Link
                href="/admin-portal/attendance/team"
                className="group flex items-center justify-between rounded-xl border border-neutral-200/80 bg-white/70 p-3 hover:bg-neutral-50 hover:border-neutral-300 transition-all shadow-2xs"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 group-hover:scale-105 transition-transform">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-neutral-900">
                      Team Attendance
                    </p>
                    <p className="text-[11px] text-neutral-500">
                      Real-time punch & geofence
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-neutral-400 group-hover:text-neutral-700 transition-colors" />
              </Link>

              <Link
                href="/admin-portal/org-chart"
                className="group flex items-center justify-between rounded-xl border border-neutral-200/80 bg-white/70 p-3 hover:bg-neutral-50 hover:border-neutral-300 transition-all shadow-2xs"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-sky-600 group-hover:scale-105 transition-transform">
                    <Layers className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-neutral-900">
                      Org Hierarchy Chart
                    </p>
                    <p className="text-[11px] text-neutral-500">
                      Visual department trees
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-neutral-400 group-hover:text-neutral-700 transition-colors" />
              </Link>

              <Link
                href="/admin-portal/settings/company"
                className="group flex items-center justify-between rounded-xl border border-neutral-200/80 bg-white/70 p-3 hover:bg-neutral-50 hover:border-neutral-300 transition-all shadow-2xs"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600 group-hover:scale-105 transition-transform">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-neutral-900">
                      Company Profile & Office
                    </p>
                    <p className="text-[11px] text-neutral-500">
                      HQ coordinates & timings
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-neutral-400 group-hover:text-neutral-700 transition-colors" />
              </Link>
            </div>
          </div>

          {/* Company Policy & Geofence Badge Card */}
          <div className="glass-card rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                Corporate Compliance
              </h4>
            </div>

            <div className="rounded-xl bg-neutral-50 p-3 border border-neutral-200/60 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Company Name</span>
                <span className="font-semibold text-neutral-900 truncate max-w-[170px]">
                  Realty Smartz Private Limited
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Office Timings</span>
                <span className="font-semibold text-neutral-900">
                  10:00 AM – 07:00 PM
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Working Days</span>
                <span className="font-semibold text-neutral-900">
                  Mon – Sat (2nd & 4th Off)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Geofence Radius</span>
                <span className="font-semibold text-emerald-700 flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> 250m Active HQ
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* COLUMN 2: Recent Joiners & Team Talent Grid (~4.5/12 cols) */}
        <div className="space-y-5 lg:col-span-4 min-w-0">
          <div className="glass-card rounded-2xl p-5 overflow-hidden">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-display text-sm font-bold text-neutral-900">
                  Recent Team Joiners
                </h3>
                <p className="text-[11px] text-neutral-500">
                  Newest additions across departments
                </p>
              </div>
              <Link
                href="/admin-portal/employees"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline shrink-0"
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {data?.recentJoiners && data.recentJoiners.length > 0 ? (
              <div className="space-y-3">
                {data.recentJoiners.map((emp) => (
                  <div
                    key={emp.id}
                    className="flex items-center justify-between gap-2.5 rounded-xl border border-neutral-200/70 bg-white/60 p-3 hover:bg-white hover:border-neutral-300 transition-all shadow-2xs overflow-hidden"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[#FF7A70] to-[#FFA07A] text-xs font-bold text-white shadow-2xs">
                        {emp.firstName[0]}
                        {emp.lastName?.[0] ?? ""}
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/admin-portal/employees/${emp.id}`}
                          className="font-bold text-xs text-neutral-900 hover:text-primary truncate block"
                          title={`${emp.firstName} ${emp.lastName}`}
                        >
                          {emp.firstName} {emp.lastName}
                        </Link>
                        <p
                          className="text-[11px] text-neutral-500 truncate"
                          title={`${emp.designation?.title ?? "Specialist"} · ${emp.department?.name ?? "General"}`}
                        >
                          {emp.designation?.title ?? "Specialist"} · {emp.department?.name ?? "General"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 pl-1">
                      <span className="inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200/60">
                        Active
                      </span>
                      <p className="mt-1 text-[10px] text-neutral-400 whitespace-nowrap">
                        {formatDate(emp.dateOfJoining)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center">
                <Users className="mx-auto h-8 w-8 text-neutral-300" />
                <p className="mt-2 text-xs text-neutral-500">
                  No recent joiners recorded.
                </p>
              </div>
            )}
          </div>

          {/* Upcoming Birthdays Widget */}
          <UpcomingBirthdaysWidget portal="admin" />

          {/* Quick Workforce Metrics Banner */}
          <div className="rounded-2xl bg-gradient-to-br from-[#181C26] to-[#2B3A67] p-5 text-white shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
                System Health & HRMS
              </span>
              <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/60 rounded-full px-2 py-0.5 border border-emerald-800">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Production Ready
              </span>
            </div>
            <h4 className="mt-2 font-display text-base font-bold">
              Autonomous Operations
            </h4>
            <p className="mt-1 text-xs text-neutral-300 leading-relaxed">
              Geofence verification, shift rules, and automatic leave deductions are operating seamlessly.
            </p>
            <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
              <Link
                href="/admin-portal/attendance/team"
                className="text-xs font-semibold text-white flex items-center gap-1.5 hover:underline"
              >
                Inspect live punch activity <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* COLUMN 3: Action Center / Approvals & Job Openings (~4/12 cols) */}
        <div className="space-y-5 lg:col-span-4">
          {/* Pending Leave Approvals Card */}
          <div className="glass-card rounded-2xl p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-display text-sm font-bold text-neutral-900">
                  Leave Decision Queue
                </h3>
                <p className="text-[11px] text-neutral-500">
                  Requests requiring admin sanction
                </p>
              </div>
              <Badge
                variant={pendingLeaveCount > 0 ? "warning" : "secondary"}
                className="rounded-full text-[10px] px-2 py-0.5"
              >
                {pendingLeaveCount} Pending
              </Badge>
            </div>

            {pendingLeave && pendingLeave.length > 0 ? (
              <div className="space-y-2.5">
                {pendingLeave.slice(0, 4).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-neutral-200/70 bg-white/70 p-3 text-xs hover:border-neutral-300 transition-all shadow-2xs"
                  >
                    <div className="truncate pr-2">
                      <p className="font-bold text-neutral-900 truncate">
                        {item.employee.firstName} {item.employee.lastName}
                      </p>
                      <p className="text-neutral-500 text-[11px] mt-0.5">
                        {item.leaveType.name} · {item.numberOfDays} day(s)
                      </p>
                    </div>
                    <Link href="/admin-portal/leave/approvals">
                      <Button
                        size="sm"
                        className="h-7 text-[11px] px-2.5 rounded-full bg-[#181C26] hover:bg-neutral-800 text-white"
                      >
                        Review
                      </Button>
                    </Link>
                  </div>
                ))}
                {pendingLeave.length > 4 && (
                  <Link
                    href="/admin-portal/leave/approvals"
                    className="block text-center text-xs font-semibold text-primary hover:underline pt-1"
                  >
                    +{pendingLeave.length - 4} more requests
                  </Link>
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-neutral-500">
                <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-500 mb-1.5" />
                All employee leave requests are approved and cleared.
              </div>
            )}
          </div>

          {/* Active Job Openings Widget */}
          <div className="glass-card rounded-2xl p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-display text-sm font-bold text-neutral-900">
                  Active Requisitions
                </h3>
                <p className="text-[11px] text-neutral-500">
                  Open vacancies in Realty Smartz
                </p>
              </div>
              <Badge variant="secondary" className="rounded-full text-[10px] px-2 py-0.5">
                {openJobsCount} Open
              </Badge>
            </div>

            {jobs && jobs.length > 0 ? (
              <div className="space-y-2.5">
                {jobs.slice(0, 3).map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between rounded-xl border border-neutral-200/70 bg-white/70 p-3 text-xs hover:border-neutral-300 transition-all shadow-2xs"
                  >
                    <div className="truncate pr-2">
                      <p className="font-bold text-neutral-900 truncate">
                        {job.title}
                      </p>
                      <p className="text-neutral-500 text-[11px] mt-0.5">
                        {job.department?.name ?? "General"} · {job._count.candidates} applicants
                      </p>
                    </div>
                    <Link href={`/admin-portal/recruitment/${job.id}`}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] px-2.5 rounded-full border-neutral-200 hover:bg-neutral-50"
                      >
                        Inspect
                      </Button>
                    </Link>
                  </div>
                ))}
                <Link
                  href="/admin-portal/recruitment"
                  className="block text-center text-xs font-semibold text-primary hover:underline pt-1"
                >
                  View full recruitment pipeline →
                </Link>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-neutral-500">
                No active openings currently open.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
