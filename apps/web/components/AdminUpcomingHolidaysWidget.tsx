"use client";

import Link from "next/link";
import { useState, useMemo, FormEvent } from "react";
import {
  CalendarDays,
  ArrowRight,
  X,
  CheckCircle2,
  AlertCircle,
  Megaphone,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { userFacingErrorMessage } from "@/lib/user-facing-error";
import { MultiDatePicker } from "@/components/MultiDatePicker";

function getDaysUntil(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays > 1 && diffDays <= 30) return `In ${diffDays} days`;
  if (diffDays > 30) {
    const months = Math.floor(diffDays / 30);
    return `In ~${months} mo`;
  }
  if (diffDays < 0 && diffDays >= -35) {
    return `${Math.abs(diffDays)}d ago`;
  }
  return "Past";
}

function formatHolidayDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const month = dt.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const day = String(d).padStart(2, "0");
  const full = dt.toLocaleDateString("en-IN", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  });
  return { month, day, full };
}

export function AdminUpcomingHolidaysWidget() {
  const utils = trpc.useUtils();
  const { data: rawHolidays, isLoading, refetch } = trpc.holiday.upcoming.useQuery(
    { limit: 6 },
    { staleTime: 0 }
  );

  // Filter out any past holidays (must be today or future date in IST)
  const holidays = useMemo(() => {
    if (!rawHolidays) return [];
    const todayIST = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    return rawHolidays.filter((h) => h.date >= todayIST);
  }, [rawHolidays]);

  const [isAnnouncing, setIsAnnouncing] = useState(false);
  const [name, setName] = useState("");
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [type, setType] = useState<"PUBLIC" | "RESTRICTED" | "COMPANY">("PUBLIC");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const announceMutation = trpc.holiday.announceMany.useMutation({
    onSuccess: (createdList) => {
      setName("");
      setSelectedDates([]);
      setDescription("");
      setType("PUBLIC");
      setError("");
      setSuccess(
        `Announced ${createdList.length} holiday date${createdList.length > 1 ? "s" : ""
        } ("${createdList[0]?.name ?? name}") successfully.`
      );
      setIsAnnouncing(false);
      utils.holiday.invalidate();
      refetch();
    },
    onError: (err) => {
      setError(userFacingErrorMessage(err));
      setSuccess("");
    },
  });

  const deleteMutation = trpc.holiday.delete.useMutation({
    onSuccess: () => {
      setSuccess("Holiday removed successfully.");
      setError("");
      utils.holiday.invalidate();
      refetch();
    },
    onError: (err) => {
      setError(userFacingErrorMessage(err));
      setSuccess("");
    },
  });

  function handleDelete(id: string, hName: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete the holiday "${hName}"?`)) {
      deleteMutation.mutate({ id });
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!name.trim()) {
      setError("Please provide a holiday name.");
      return;
    }

    if (selectedDates.length === 0) {
      setError("Please select at least one date from the calendar.");
      return;
    }

    announceMutation.mutate({
      name: name.trim(),
      dates: selectedDates,
      type,
      description: description.trim() || null,
    });
  }

  return (
    <div className="rounded border border-[var(--line)] bg-[var(--card)] p-5 sm:p-6 text-[var(--ink)]">
      {/* 1. Header with Announce Action */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-[var(--line)]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-[var(--field)] border border-[var(--line)] text-[var(--accent)]">
            <CalendarDays className="h-4 w-4" strokeWidth={1.8} />
          </div>
          <div>
            <h2 className="text-base font-bold text-[var(--ink)]">Upcoming holidays</h2>
            <p className="text-xs text-[var(--muted)]">
              Announce and manage team holidays
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin-portal/settings/holidays"
            className="flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:underline"
          >
            <span>View all</span>
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
          </Link>
          {!isAnnouncing && (
            <button
              type="button"
              onClick={() => {
                setError("");
                setSuccess("");
                setIsAnnouncing(true);
              }}
              className="flex items-center gap-1.5 bg-[var(--accent)] hover:brightness-110 text-white rounded text-xs font-semibold h-8 px-3 transition-all"
            >
              <Megaphone className="h-3.5 w-3.5" strokeWidth={1.8} />
              <span>Announce holiday</span>
            </button>
          )}
        </div>
      </div>

      {/* Success & Error alerts */}
      {success && (
        <div className="mt-4 flex items-center justify-between rounded border border-[var(--ok)]/30 bg-[var(--ok)]/10 px-3.5 py-2 text-xs font-medium text-[var(--ok)]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={1.8} />
            <span>{success}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccess("")}
            className="hover:opacity-75"
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.8} />
          </button>
        </div>
      )}
      {error && (
        <div className="mt-4 flex items-center justify-between rounded border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3.5 py-2 text-xs font-medium text-[var(--danger)]">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={1.8} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError("")}
            className="hover:opacity-75"
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.8} />
          </button>
        </div>
      )}

      {/* 2. Announce Holiday Form */}
      {isAnnouncing && (
        <div className="mt-4 rounded border border-[var(--line)] bg-[var(--field)] p-4">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--line)]">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--accent)]">
              <Megaphone className="h-4 w-4" strokeWidth={1.8} />
              <span>Announce new holiday (select multiple dates)</span>
            </div>
            <button
              type="button"
              onClick={() => setIsAnnouncing(false)}
              className="text-[var(--muted)] hover:text-[var(--ink)]"
            >
              <X className="h-4 w-4" strokeWidth={1.8} />
            </button>
          </div>

          <form onSubmit={onSubmit} className="space-y-3.5">
            <div className="grid gap-3 sm:grid-cols-2">
              {/* Holiday Name */}
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-[var(--ink)]">
                  Holiday name <span className="text-[var(--danger)]">*</span>
                </Label>
                <Input
                  placeholder="e.g. Diwali Break, Holi, Foundation Day"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="h-10 rounded border-[var(--line)] bg-[var(--card)] text-xs text-[var(--ink)] focus:border-[var(--accent)]"
                />
              </div>

              {/* Date(s) */}
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-[var(--ink)]">
                  Select date(s) <span className="text-[var(--danger)]">*</span>
                </Label>
                <MultiDatePicker
                  selectedDates={selectedDates}
                  onChange={setSelectedDates}
                  placeholder="Click to select multiple dates together..."
                />
              </div>
            </div>

            {/* Category & Description */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-[var(--ink)]">Category</Label>
                <Select
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                  className="h-10 rounded border-[var(--line)] bg-[var(--card)] text-xs text-[var(--ink)] focus:border-[var(--accent)]"
                >
                  <option value="PUBLIC">Public / Gazetted</option>
                  <option value="RESTRICTED">Restricted / Optional</option>
                  <option value="COMPANY">Company Specific Off</option>
                </Select>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <Label className="text-[11px] font-semibold text-[var(--ink)]">
                  Announcement note (optional)
                </Label>
                <Input
                  placeholder="e.g. Office will remain closed in celebration"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="h-10 rounded border-[var(--line)] bg-[var(--card)] text-xs text-[var(--ink)] focus:border-[var(--accent)]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--line)]">
              <button
                type="button"
                onClick={() => setIsAnnouncing(false)}
                className="h-9 rounded border border-[var(--line)] bg-[var(--card)] px-3 text-xs font-medium text-[var(--ink)] hover:bg-[var(--hover)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={announceMutation.isLoading}
                className="h-9 rounded bg-[var(--accent)] hover:brightness-110 text-white text-xs font-semibold px-4 flex items-center gap-1.5 transition-all"
              >
                <Megaphone className="h-3.5 w-3.5" strokeWidth={1.8} />
                <span>
                  {announceMutation.isLoading
                    ? "Announcing..."
                    : selectedDates.length > 1
                      ? `Announce ${selectedDates.length} dates`
                      : "Announce holiday"}
                </span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. Upcoming Holidays Grid */}
      <div className="mt-4">
        {isLoading ? (
          <div className="py-6 text-center text-xs text-[var(--muted)]">
            Loading upcoming holidays...
          </div>
        ) : holidays && holidays.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {holidays.map((h) => {
              const { month, day, full } = formatHolidayDate(h.date);
              const daysUntil = getDaysUntil(h.date);
              return (
                <div
                  key={h.id}
                  className="group relative flex items-center justify-between gap-3 p-3 rounded border border-[var(--line)] bg-[var(--field)] hover:bg-[var(--hover)] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Date badge */}
                    <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded border border-[var(--line)] bg-[var(--card)]">
                      <span className="text-[10px] font-bold text-[var(--accent)] uppercase leading-none">
                        {month}
                      </span>
                      <span className="text-sm font-bold text-[var(--ink)] leading-tight">
                        {day}
                      </span>
                    </div>

                    {/* Holiday info */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-[var(--ink)] leading-tight">
                        {h.name}
                      </p>
                      <p className="text-[11px] text-[var(--muted)] truncate leading-none mt-1">
                        {h.dayName} · {full}
                      </p>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span
                          className={cn(
                            "rounded-sm px-1.5 py-0.5 text-[10px] font-semibold",
                            daysUntil === "Today" || daysUntil === "Tomorrow"
                              ? "chip-warn"
                              : daysUntil === "Past" || daysUntil.endsWith("ago")
                                ? "bg-[var(--field)] text-[var(--muted)]"
                                : "chip-ok"
                          )}
                        >
                          {daysUntil}
                        </span>
                        <span className="text-[10px] text-[var(--muted)] truncate">
                          {h.type === "PUBLIC" ? "Public" : "Company"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Delete Action button */}
                  <button
                    type="button"
                    onClick={(e) => handleDelete(h.id, h.name, e)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded text-[var(--muted)] hover:text-[var(--danger)] hover:bg-[var(--card)]"
                    title="Remove Holiday"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 px-4 text-center rounded border border-dashed border-[var(--line)] bg-[var(--field)]">
            <CalendarDays className="h-7 w-7 text-[var(--muted)] mx-auto mb-2" strokeWidth={1.8} />
            <p className="text-xs font-semibold text-[var(--ink)]">No holidays scheduled</p>
            <p className="text-[11px] text-[var(--muted)] mt-0.5 max-w-sm mx-auto">
              Click &ldquo;Announce holiday&rdquo; above to select multiple dates together from the calendar and announce for your team.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
