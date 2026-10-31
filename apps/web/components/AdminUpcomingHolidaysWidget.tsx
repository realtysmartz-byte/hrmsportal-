"use client";

import Link from "next/link";

import { useState, FormEvent } from "react";
import {
  CalendarDays,
  ArrowRight,
  Plus,
  Calendar,
  Sparkles,
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
  return "Past";
}

function formatHolidayDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const month = dt.toLocaleString("en-US", { month: "short", timeZone: "UTC" }).toUpperCase();
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
  const { data: holidays, isLoading, refetch } = trpc.holiday.upcoming.useQuery(
    { limit: 6 },
    { staleTime: 0 }
  );

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
        `Announced ${createdList.length} holiday date${
          createdList.length > 1 ? "s" : ""
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
    <div className="rounded-2xl border border-[#EAEBF0] bg-white p-6 shadow-xs">
      {/* 1. Header with Announce Action */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-neutral-100">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#6D28D9] text-white shadow-2xs">
            <CalendarDays className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-neutral-900">Upcoming Holidays</h2>
            <p className="text-[11px] text-neutral-400 font-medium">
              Announce and manage team holidays dynamically
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin-portal/settings/holidays"
            className="flex items-center gap-1 text-xs font-bold text-[#6D28D9] hover:underline"
          >
            <span>View all</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          {!isAnnouncing && (
            <Button
              size="sm"
              onClick={() => {
                setError("");
                setSuccess("");
                setIsAnnouncing(true);
              }}
              className="gap-1.5 bg-[#6D28D9] hover:bg-[#5B21B6] text-white rounded-xl shadow-2xs text-xs font-bold h-8 px-3"
            >
              <Megaphone className="h-3.5 w-3.5" />
              <span>Announce Holiday</span>
            </Button>
          )}
        </div>
      </div>

      {/* Success & Error alerts */}
      {success && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-medium text-emerald-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{success}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccess("")}
            className="text-emerald-600 hover:text-emerald-900"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {error && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-medium text-rose-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError("")}
            className="text-rose-600 hover:text-rose-900"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* 2. Dynamic Announce Holiday Form with Multi-Date Selection */}
      {isAnnouncing && (
        <div className="mt-4 rounded-xl border border-[#D8C7F8] bg-gradient-to-br from-[#FAF8FE] to-white p-4 shadow-2xs">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#ECE6F8]">
            <div className="flex items-center gap-2 text-xs font-bold text-[#6D28D9]">
              <Megaphone className="h-4 w-4" />
              <span>Announce New Holiday (Select Multiple Dates at once)</span>
            </div>
            <button
              type="button"
              onClick={() => setIsAnnouncing(false)}
              className="text-neutral-400 hover:text-neutral-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={onSubmit} className="space-y-3.5">
            <div className="grid gap-3 sm:grid-cols-2">
              {/* Holiday Name */}
              <div className="space-y-1">
                <Label className="text-[11px] font-bold text-neutral-700">
                  Holiday Name <span className="text-rose-500">*</span>
                </Label>
                <Input
                  placeholder="e.g. Diwali Break, Holi, Foundation Day"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="h-9 rounded-xl border-[#E2E4E9] text-xs font-medium focus:border-[#6D28D9]"
                />
              </div>

              {/* Date(s) - Interactive Multi-Date Calendar Picker */}
              <div className="space-y-1">
                <Label className="text-[11px] font-bold text-neutral-700">
                  Select Date(s) — Multi-Select Calendar <span className="text-rose-500">*</span>
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
                <Label className="text-[11px] font-bold text-neutral-700">Category</Label>
                <Select
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                  className="h-9 rounded-xl border-[#E2E4E9] text-xs font-medium focus:border-[#6D28D9]"
                >
                  <option value="PUBLIC">Public / Gazetted</option>
                  <option value="RESTRICTED">Restricted / Optional</option>
                  <option value="COMPANY">Company Specific Off</option>
                </Select>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <Label className="text-[11px] font-bold text-neutral-700">
                  Announcement Note (Optional)
                </Label>
                <Input
                  placeholder="e.g. Office will remain closed in celebration"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="h-9 rounded-xl border-[#E2E4E9] text-xs font-medium focus:border-[#6D28D9]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAnnouncing(false)}
                className="h-8 rounded-lg text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={announceMutation.isLoading}
                className="h-8 rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-xs font-bold px-3.5 gap-1.5"
              >
                <Megaphone className="h-3 w-3" />
                <span>
                  {announceMutation.isLoading
                    ? "Announcing..."
                    : selectedDates.length > 1
                    ? `Announce ${selectedDates.length} Dates`
                    : "Announce Holiday"}
                </span>
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* 3. Dynamic Upcoming Holidays Grid */}
      <div className="mt-4">
        {isLoading ? (
          <div className="py-6 text-center text-xs text-neutral-400">
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
                  className="group relative flex items-center justify-between gap-3 p-3 rounded-xl border border-[#EAEBF0] bg-neutral-50/50 hover:bg-neutral-50 hover:border-[#D8C7F8] transition-all shadow-2xs"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Date badge */}
                    <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl border border-[#E7DBFA] bg-white shadow-2xs">
                      <span className="text-[8px] font-extrabold text-[#6D28D9] tracking-wider uppercase leading-none">
                        {month}
                      </span>
                      <span className="text-sm font-black text-neutral-900 leading-tight">
                        {day}
                      </span>
                    </div>

                    {/* Holiday info */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-neutral-900 leading-tight">
                        {h.name}
                      </p>
                      <p className="text-[10px] text-neutral-400 truncate leading-none mt-0.5">
                        {h.dayName} · {full}
                      </p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="rounded-full bg-[#F3EAFD] px-2 py-0.5 text-[9px] font-bold text-[#6D28D9] border border-[#E7DBFA]">
                          {daysUntil}
                        </span>
                        <span className="text-[9px] text-neutral-400 truncate">
                          {h.type === "PUBLIC" ? "Public" : "Company"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Delete Action button right on the card */}
                  <button
                    type="button"
                    onClick={(e) => handleDelete(h.id, h.name, e)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg text-neutral-400 hover:text-rose-600 hover:bg-rose-50"
                    title="Remove Holiday"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 px-4 text-center rounded-xl border border-dashed border-[#E2E4E9] bg-neutral-50/40">
            <CalendarDays className="h-7 w-7 text-neutral-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-neutral-700">No holidays scheduled</p>
            <p className="text-[11px] text-neutral-400 mt-0.5 max-w-sm mx-auto">
              Click &ldquo;Announce Holiday&rdquo; above to select multiple dates together from the calendar and announce for your team.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
