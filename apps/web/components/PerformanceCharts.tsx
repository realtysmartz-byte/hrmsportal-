"use client";

import React, { useMemo } from "react";
import { formatCurrency } from "@/lib/utils";

// --- 1. CIRCULAR PERFORMANCE SCORE GAUGE ---
interface CircularScoreGaugeProps {
  score: number;
  size?: number;
  title?: string;
  subtitle?: string;
}

export function CircularScoreGauge({
  score = 0,
  size = 180,
  title = "Overall Score",
  subtitle = "Monthly Performance",
}: CircularScoreGaugeProps) {
  const normalizedScore = Math.min(100, Math.max(0, Math.round(score * 10) / 10));
  const strokeWidth = 14;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  // Semi-circle gauge (180 to 360 deg or 240 deg arc)
  const arcLength = circumference * 0.75;
  const strokeDashoffset = arcLength - (arcLength * normalizedScore) / 100;

  const color =
    normalizedScore >= 80
      ? "#059669" // Green
      : normalizedScore >= 50
      ? "#D97706" // Amber
      : "#DC2626"; // Red

  const glowColor =
    normalizedScore >= 80
      ? "rgba(5, 150, 105, 0.2)"
      : normalizedScore >= 50
      ? "rgba(217, 119, 6, 0.2)"
      : "rgba(220, 38, 38, 0.2)";

  return (
    <div className="flex flex-col items-center justify-center p-3">
      <div className="relative" style={{ width: size, height: size * 0.85 }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-[135deg] overflow-visible"
        >
          {/* Background Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--line, #e2e8f0)"
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
          />
          {/* Progress Arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{
              transition: "stroke-dashoffset 0.8s ease-out, stroke 0.5s ease",
              filter: `drop-shadow(0 2px 6px ${glowColor})`,
            }}
          />
        </svg>

        {/* Center Score Label */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none"
          style={{ paddingTop: size * 0.08 }}
        >
          <span
            className="text-3xl sm:text-4xl font-black tracking-tight"
            style={{ color }}
          >
            {normalizedScore}%
          </span>
          <span className="text-[11px] font-bold text-[var(--muted, #64748b)] uppercase tracking-wider mt-0.5">
            {normalizedScore >= 80
              ? "On Target (Green)"
              : normalizedScore >= 50
              ? "At Risk (Amber)"
              : "Behind (Red)"}
          </span>
        </div>
      </div>

      <div className="text-center mt-1">
        <h4 className="text-xs font-bold text-[var(--ink, #0f172a)]">{title}</h4>
        {subtitle && (
          <p className="text-[10px] text-[var(--muted, #64748b)]">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

// --- 2. TARGET VS ACHIEVED HORIZONTAL BAR CHART ---
interface MetricItem {
  label: string;
  target: number;
  achieved: number;
  unit?: string;
  weight?: number;
}

export function TargetVsActualBarChart({
  items,
  title = "Deliverables: Target vs Achieved",
}: {
  items: MetricItem[];
  title?: string;
}) {
  if (!items || items.length === 0) return null;

  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between border-b border-[var(--line, #e2e8f0)] pb-2">
        <h4 className="text-xs font-bold text-[var(--ink, #0f172a)] flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#0284c7]" />
          {title}
        </h4>
        <div className="flex items-center gap-3 text-[10px] font-semibold text-[var(--muted, #64748b)]">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-3 rounded-xs bg-[var(--line, #cbd5e1)]" /> Target
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-3 rounded-xs bg-[#0284c7]" /> Achieved
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {items.map((item, idx) => {
          const pct = item.target > 0 ? Math.round((item.achieved / item.target) * 100) : 0;
          const cappedPct = Math.min(100, Math.max(0, pct));
          const isCurrency = item.unit === "INR";
          const formattedTarget = isCurrency ? formatCurrency(item.target) : `${item.target} ${item.unit || ""}`;
          const formattedAchieved = isCurrency ? formatCurrency(item.achieved) : `${item.achieved} ${item.unit || ""}`;

          const barColor =
            pct >= 100
              ? "bg-emerald-600"
              : pct >= 50
              ? "bg-amber-500"
              : "bg-rose-600";

          return (
            <div key={idx} className="space-y-1.5">
              <div className="flex items-baseline justify-between text-xs gap-2">
                <span className="font-bold text-[var(--ink, #0f172a)] truncate">
                  {item.label}
                  {item.weight != null && (
                    <span className="ml-1.5 text-[10px] font-normal text-[var(--muted, #64748b)]">
                      ({item.weight}% weight)
                    </span>
                  )}
                </span>
                <span className="text-[11px] font-extrabold text-[var(--ink, #0f172a)] shrink-0">
                  <span className="text-[#0284c7] font-black">{formattedAchieved}</span>
                  <span className="text-[var(--muted, #64748b)] font-normal"> / {formattedTarget}</span>
                  <span
                    className={`ml-1.5 px-1.5 py-0.2 rounded text-[10px] font-black ${
                      pct >= 100
                        ? "bg-emerald-100 text-emerald-800"
                        : pct >= 50
                        ? "bg-amber-100 text-amber-800"
                        : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {pct}%
                  </span>
                </span>
              </div>

              {/* Progress bar with target boundary marker */}
              <div className="relative h-3 w-full rounded-full bg-[var(--line, #e2e8f0)] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                  style={{ width: `${Math.max(3, cappedPct)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- 3. TEAM MEMBERS COMPARISON BAR CHART (FOR TEAM LEADERS) ---
interface TeamMemberMetric {
  id: string;
  name: string;
  role: string;
  score: number;
  visits: number;
  targetVisits: number;
  bookings: number;
  targetBookings: number;
  revenue: number;
  targetRevenue: number;
}

export function TeamLeaderComparisonChart({
  members,
  teamTargetVisits = 0,
  teamAchievedVisits = 0,
  teamTargetBookings = 0,
  teamAchievedBookings = 0,
  teamTargetRevenue = 0,
  teamAchievedRevenue = 0,
}: {
  members: TeamMemberMetric[];
  teamTargetVisits?: number;
  teamAchievedVisits?: number;
  teamTargetBookings?: number;
  teamAchievedBookings?: number;
  teamTargetRevenue?: number;
  teamAchievedRevenue?: number;
}) {
  if (!members || members.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Top Rollup Summary Cards */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2.5 rounded-xl border border-sky-100 bg-sky-50/50">
          <span className="text-[10px] font-bold uppercase text-sky-800 block">Team Visits</span>
          <span className="text-sm sm:text-base font-black text-sky-950">
            {teamAchievedVisits} <span className="text-[10px] text-sky-600 font-normal">/ {teamTargetVisits}</span>
          </span>
          <div className="mt-1 h-1.5 w-full rounded-full bg-sky-200 overflow-hidden">
            <div
              className="h-full bg-[#0284c7] rounded-full"
              style={{
                width: `${Math.min(100, teamTargetVisits > 0 ? (teamAchievedVisits / teamTargetVisits) * 100 : 0)}%`,
              }}
            />
          </div>
        </div>

        <div className="p-2.5 rounded-xl border border-indigo-100 bg-indigo-50/50">
          <span className="text-[10px] font-bold uppercase text-indigo-800 block">Team Bookings</span>
          <span className="text-sm sm:text-base font-black text-indigo-950">
            {teamAchievedBookings} <span className="text-[10px] text-indigo-600 font-normal">/ {teamTargetBookings}</span>
          </span>
          <div className="mt-1 h-1.5 w-full rounded-full bg-indigo-200 overflow-hidden">
            <div
              className="h-full bg-indigo-600 rounded-full"
              style={{
                width: `${Math.min(100, teamTargetBookings > 0 ? (teamAchievedBookings / teamTargetBookings) * 100 : 0)}%`,
              }}
            />
          </div>
        </div>

        <div className="p-2.5 rounded-xl border border-emerald-100 bg-emerald-50/50">
          <span className="text-[10px] font-bold uppercase text-emerald-800 block">Team Revenue</span>
          <span className="text-xs sm:text-sm font-black text-emerald-950 truncate block">
            {formatCurrency(teamAchievedRevenue)}
          </span>
          <div className="mt-1 h-1.5 w-full rounded-full bg-emerald-200 overflow-hidden">
            <div
              className="h-full bg-emerald-600 rounded-full"
              style={{
                width: `${Math.min(100, teamTargetRevenue > 0 ? (teamAchievedRevenue / teamTargetRevenue) * 100 : 0)}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Side-by-side Member Performance Comparison Visual Bars */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-xs font-bold text-neutral-700 px-1">
          <span>Team Member Breakdown</span>
          <span>Score %</span>
        </div>

        {members.map((m) => {
          const score = Math.min(100, Math.max(0, Math.round(m.score)));
          const barColor =
            score >= 80 ? "bg-emerald-600" : score >= 50 ? "bg-amber-500" : "bg-rose-600";
          const badgeColor =
            score >= 80
              ? "bg-emerald-100 text-emerald-800"
              : score >= 50
              ? "bg-amber-100 text-amber-800"
              : "bg-rose-100 text-rose-800";

          return (
            <div
              key={m.id}
              className="p-3 rounded-xl border border-neutral-200 bg-white shadow-xs space-y-2 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-bold text-neutral-900 truncate">{m.name}</div>
                  <div className="text-[10px] text-neutral-500 truncate">{m.role}</div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold shrink-0 ${badgeColor}`}>
                  {score}%
                </span>
              </div>

              {/* Score Bar */}
              <div className="h-2.5 w-full rounded-full bg-neutral-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                  style={{ width: `${Math.max(4, score)}%` }}
                />
              </div>

              {/* Targets Summary Line */}
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] pt-1 border-t border-neutral-100 text-neutral-600">
                <span>
                  Visits: <strong className="text-neutral-900">{m.visits}/{m.targetVisits}</strong>
                </span>
                <span>
                  Bookings: <strong className="text-neutral-900">{m.bookings}/{m.targetBookings}</strong>
                </span>
                <span>
                  Rev: <strong className="text-emerald-700">{formatCurrency(m.revenue)}</strong>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- 4. COMPANY TARGETS COMPARISON GRAPH (FOR ADMIN PORTAL) ---
interface CompanyStat {
  name: string;
  activeCount: number;
  totalTargetRev: number;
  totalAchievedRev: number;
  totalTargetBookings: number;
  totalAchievedBookings: number;
  avgScore: number;
}

export function CompanyComparisonGraph({ companies }: { companies: CompanyStat[] }) {
  if (!companies || companies.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {companies.map((c) => {
          const revPct =
            c.totalTargetRev > 0
              ? Math.min(100, Math.round((c.totalAchievedRev / c.totalTargetRev) * 100))
              : 0;

          return (
            <div
              key={c.name}
              className="p-4 rounded-2xl border border-neutral-200 bg-white shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-black text-xs text-neutral-900 truncate">{c.name}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-sky-100 text-[#0284c7]">
                  {c.avgScore}% Score
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-neutral-500">Revenue</span>
                  <span className="font-bold text-emerald-700">{formatCurrency(c.totalAchievedRev)}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-neutral-100 overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 rounded-full"
                    style={{ width: `${Math.max(3, revPct)}%` }}
                  />
                </div>
                <div className="text-[10px] text-neutral-400 text-right">
                  Target: {formatCurrency(c.totalTargetRev)} ({revPct}%)
                </div>
              </div>

              <div className="pt-2 border-t border-neutral-100 flex justify-between items-center text-xs">
                <span className="text-neutral-500">Bookings</span>
                <span className="font-bold text-neutral-900">
                  {c.totalAchievedBookings} / {c.totalTargetBookings}
                </span>
              </div>

              <div className="text-[10px] text-neutral-400">
                Staff: <strong className="text-neutral-700">{c.activeCount} active</strong>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
