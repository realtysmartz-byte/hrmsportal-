"use client";

import { userFacingErrorMessage } from "@/lib/user-facing-error";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Plus,
  Pencil,
  Trash2,
  Sparkles,
  Calendar,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { canManageHolidays } from "@realty-smartz/shared";
import type { Role } from "@realty-smartz/shared";
import { cn } from "@/lib/utils";
import { MultiDatePicker } from "@/components/MultiDatePicker";

interface HolidayItem {
  id: string;
  name: string;
  date: string;
  dayName: string;
  type: "PUBLIC" | "RESTRICTED" | "COMPANY";
  description?: string | null;
}

function getDaysUntil(dateStr: string): { label: string; isPast: boolean; isToday: boolean } {
  const [y, m, d] = dateStr.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return { label: "Today", isPast: false, isToday: true };
  if (diffDays === 1) return { label: "Tomorrow", isPast: false, isToday: false };
  if (diffDays > 1 && diffDays <= 30) return { label: `In ${diffDays} days`, isPast: false, isToday: false };
  if (diffDays > 30) {
    const months = Math.floor(diffDays / 30);
    return { label: `In ~${months} mo`, isPast: false, isToday: false };
  }
  return { label: "Passed", isPast: true, isToday: false };
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
    year: "numeric",
  });
  return { month, day, full };
}

export default function HolidaysManagementPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const role = (session?.user?.role ?? "EMPLOYEE") as Role;
  const allowed = canManageHolidays(role);

  const utils = trpc.useUtils();
    const { data: holidays, isLoading, refetch } = trpc.holiday.list.useQuery(undefined, {
      enabled: allowed,
      staleTime: 0,
    });

    const [name, setName] = useState("");
    const [dates, setDates] = useState<string[]>([]);
    const [type, setType] = useState<"PUBLIC" | "RESTRICTED" | "COMPANY">("PUBLIC");
    const [description, setDescription] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);

    const [search, setSearch] = useState("");
    const [filterTab, setFilterTab] = useState<"ALL" | "UPCOMING" | "PAST">("ALL");
    const [yearFilter, setYearFilter] = useState("");

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [formOpen, setFormOpen] = useState(false);

    useEffect(() => {
    if (status === "authenticated" && !allowed) {
      router.replace("/admin-portal/dashboard");
    }
  }, [status, allowed, router]);

  const announceMutation = trpc.holiday.announceMany.useMutation({
    onSuccess: (items) => {
      setName("");
      setDates([]);
      setType("PUBLIC");
      setDescription("");
      setError("");
      setSuccess(`${items.length} holiday date${items.length > 1 ? "s" : ""} added successfully.`);
      setFormOpen(false);
      utils.holiday.invalidate();
      refetch();
    },
    onError: (err) => {
      setError(userFacingErrorMessage(err));
      setSuccess("");
    },
  });

  const updateMutation = trpc.holiday.update.useMutation({
    onSuccess: () => {
      setEditingId(null);
      setName("");
      setDates([]);
      setType("PUBLIC");
      setDescription("");
      setError("");
      setSuccess("Holiday updated successfully.");
      setFormOpen(false);
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

  function startEdit(holiday: HolidayItem) {
    setEditingId(holiday.id);
    setName(holiday.name);
    setDates([holiday.date]);
    setType(holiday.type);
    setDescription(holiday.description || "");
    setError("");
    setSuccess("");
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setName("");
    setDates([]);
    setType("PUBLIC");
    setDescription("");
    setError("");
    setFormOpen(false);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!name.trim()) {
      setError("Please provide a holiday name.");
      return;
    }
    if (dates.length === 0) {
      setError("Please select at least one date from the calendar.");
      return;
    }

    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        name: name.trim(),
        date: dates[0],
        type,
        description: description.trim() || null,
      });
    } else {
      announceMutation.mutate({
        name: name.trim(),
        dates,
        type,
        description: description.trim() || null,
      });
    }
  }

  function onDelete(id: string, holidayName: string) {
    if (confirm(`Are you sure you want to delete the holiday "${holidayName}"?`)) {
      deleteMutation.mutate({ id });
    }
  }

  // Filtered holidays
  const filteredHolidays = useMemo(() => {
    if (!holidays) return [];
    return holidays.filter((h) => {
      // Year filter
      if (yearFilter && !h.date.startsWith(yearFilter)) {
        return false;
      }
      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const matches =
          h.name.toLowerCase().includes(q) ||
          h.dayName.toLowerCase().includes(q) ||
          (h.description && h.description.toLowerCase().includes(q));
        if (!matches) return false;
      }
      // Tab filter
      const { isPast, isToday } = getDaysUntil(h.date);
      if (filterTab === "UPCOMING" && isPast) return false;
      if (filterTab === "PAST" && !isPast && !isToday) return false;

      return true;
    });
  }, [holidays, search, filterTab, yearFilter]);

  // Metrics
  const stats = useMemo(() => {
    if (!holidays) {
      return { total: 0, upcoming: 0, public: 0, next: null as HolidayItem | null };
    }
    const yearHolidays = holidays.filter((h) => h.date.startsWith(yearFilter));
    const upcoming = yearHolidays.filter((h) => !getDaysUntil(h.date).isPast);
    const publicHolidays = yearHolidays.filter((h) => h.type === "PUBLIC");
    const next = upcoming.length > 0 ? upcoming[0] : null;

    return {
      total: yearHolidays.length,
      upcoming: upcoming.length,
      public: publicHolidays.length,
      next,
    };
  }, [holidays, yearFilter]);

  if (status === "loading" || !allowed) {
    return (
      <div className="py-12 text-center text-sm text-neutral-400">
        Loading holiday settings...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* 1. Header with Breadcrumbs & Action */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-neutral-400 mb-1">
            <span>Settings</span>
            <span>/</span>
            <span className="text-[#6D28D9]">Company Holidays</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
            Holiday Management
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-neutral-500">
            Configure official gazetted holidays, restricted observances, and calendar offs for Realty Smartz.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!formOpen && (
            <Button
              onClick={() => {
                cancelEdit();
                setFormOpen(true);
              }}
              className="gap-2 bg-[#6D28D9] hover:bg-[#5B21B6] text-white rounded-xl shadow-xs text-xs font-bold"
            >
              <Plus className="h-4 w-4" />
              <span>Add Holiday</span>
            </Button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {success && (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-xs font-medium text-emerald-800">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{success}</span>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-xs font-medium text-rose-800">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. Key Metrics Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {/* Total Holidays */}
        <div className="rounded-2xl border border-[#EAEBF0] bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500">Total Holidays</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F5F2FC] text-[#6D28D9]">
              <Calendar className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-neutral-900">{stats.total}</p>
          <p className="text-[11px] text-neutral-400 mt-0.5">In Year {yearFilter}</p>
        </div>

        {/* Upcoming Holidays */}
        <div className="rounded-2xl border border-[#EAEBF0] bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500">Upcoming</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-emerald-600">{stats.upcoming}</p>
          <p className="text-[11px] text-neutral-400 mt-0.5">Remaining this year</p>
        </div>

        {/* Gazetted / Public */}
        <div className="rounded-2xl border border-[#EAEBF0] bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500">Public Holidays</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <CalendarDays className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-neutral-900">{stats.public}</p>
          <p className="text-[11px] text-neutral-400 mt-0.5">Mandatory company offs</p>
        </div>

        {/* Next Holiday */}
        <div className="rounded-2xl border border-[#EAEBF0] bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500">Next Holiday</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-[#7C3AED]">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-sm font-bold text-neutral-900 truncate">
            {stats.next ? stats.next.name : "None scheduled"}
          </p>
          <p className="text-[11px] font-semibold text-[#6D28D9] mt-0.5">
            {stats.next ? getDaysUntil(stats.next.date).label : "All passed"}
          </p>
        </div>
      </div>

      {/* 3. Add / Edit Holiday Form Drawer */}
      {formOpen && (
        <div className="rounded-2xl border border-[#D8C7F8] bg-gradient-to-br from-white to-[#FAF8FE] p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#6D28D9] text-white">
                {editingId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              </div>
              <div>
                <h2 className="text-sm font-bold text-neutral-900">
                  {editingId ? `Edit Holiday: ${name}` : "Add New Company Holiday"}
                </h2>
                <p className="text-[11px] text-neutral-500">
                  {editingId
                    ? "Update holiday date, category, or description."
                    : "Enter details for the upcoming holiday or observance."}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={cancelEdit}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              {/* Holiday Name */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-bold text-neutral-700">
                  Holiday Name <span className="text-rose-500">*</span>
                </Label>
                <Input
                  placeholder="e.g. Diwali, Holi, Republic Day"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="rounded-xl border-[#E2E4E9] text-xs font-medium focus:border-[#6D28D9]"
                />
              </div>

              {/* Holiday Date(s) - Interactive Multi-Date Calendar Picker */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-neutral-700">
                  {editingId ? "Holiday Date" : "Date(s) — Multi-Select from Calendar"}{" "}
                  <span className="text-rose-500">*</span>
                </Label>
                <MultiDatePicker
                  selectedDates={dates}
                  onChange={setDates}
                  isSingle={!!editingId}
                  placeholder="Click to pick single or multiple dates..."
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {/* Holiday Type */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-neutral-700">Holiday Category</Label>
                <Select
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                  className="rounded-xl border-[#E2E4E9] text-xs font-medium focus:border-[#6D28D9]"
                >
                  <option value="PUBLIC">Public / Gazetted Holiday</option>
                  <option value="RESTRICTED">Restricted / Optional Holiday</option>
                  <option value="COMPANY">Company Off / Foundation Day</option>
                </Select>
              </div>

              {/* Description */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-bold text-neutral-700">
                  Description / Note (Optional)
                </Label>
                <Input
                  placeholder="e.g. National holiday celebrating Constitution of India"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="rounded-xl border-[#E2E4E9] text-xs font-medium focus:border-[#6D28D9]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={cancelEdit}
                className="rounded-xl text-xs font-medium"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={announceMutation.isPending || updateMutation.isPending}
                className="rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-xs font-bold px-4"
              >
                {announceMutation.isPending || updateMutation.isPending
                  ? "Saving..."
                  : editingId
                    ? "Update Holiday"
                    : dates.length > 1
                      ? `Save ${dates.length} Holidays`
                      : "Save Holiday"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* 4. Filter Toolbar & Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-[#EAEBF0] bg-white p-4 shadow-xs">
        {/* Left: Tab Switcher (Upcoming / All / Past) */}
        <div className="flex items-center gap-1 rounded-xl bg-neutral-100 p-1">
          <button
            type="button"
            onClick={() => setFilterTab("UPCOMING")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
              filterTab === "UPCOMING"
                ? "bg-white text-[#6D28D9] shadow-xs"
                : "text-neutral-500 hover:text-neutral-900"
            )}
          >
            Upcoming Only
          </button>
          <button
            type="button"
            onClick={() => setFilterTab("ALL")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
              filterTab === "ALL"
                ? "bg-white text-[#6D28D9] shadow-xs"
                : "text-neutral-500 hover:text-neutral-900"
            )}
          >
            All Holidays
          </button>
          <button
            type="button"
            onClick={() => setFilterTab("PAST")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
              filterTab === "PAST"
                ? "bg-white text-[#6D28D9] shadow-xs"
                : "text-neutral-500 hover:text-neutral-900"
            )}
          >
            Past
          </button>
        </div>

        {/* Right: Year selector & Search */}
        <div className="flex items-center gap-2">
          {/* Year selector */}
          <Select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="w-28 rounded-xl border-[#E2E4E9] text-xs font-semibold focus:border-[#6D28D9]"
          >
            <option value="2026">2026</option>
            <option value="2027">2027</option>
            <option value="2025">2025</option>
            <option value="">All Years</option>
          </Select>

          {/* Search box */}
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search holidays..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-xl border border-[#E2E4E9] bg-neutral-50/70 pl-8 pr-3 text-xs font-medium text-neutral-800 placeholder:text-neutral-400 transition-all focus:border-[#6D28D9] focus:bg-white focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* 5. Holidays Table */}
      <div className="rounded-2xl border border-[#EAEBF0] bg-white overflow-hidden shadow-xs">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#FAF9FD] border-b border-neutral-100">
              <TableHead className="text-xs font-bold text-neutral-600">Date & Day</TableHead>
              <TableHead className="text-xs font-bold text-neutral-600">Holiday Name</TableHead>
              <TableHead className="text-xs font-bold text-neutral-600">Category</TableHead>
              <TableHead className="text-xs font-bold text-neutral-600">Description</TableHead>
              <TableHead className="text-xs font-bold text-neutral-600">Timeline</TableHead>
              <TableHead className="text-right text-xs font-bold text-neutral-600">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-xs text-neutral-400">
                  Loading holidays schedule...
                </TableCell>
              </TableRow>
            ) : filteredHolidays.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-xs text-neutral-400">
                  No holidays match your current filter.
                </TableCell>
              </TableRow>
            ) : (
              filteredHolidays.map((h) => {
                const { month, day, full } = formatHolidayDate(h.date);
                const { label: daysUntilLabel, isPast, isToday } = getDaysUntil(h.date);

                return (
                  <TableRow
                    key={h.id}
                    className="hover:bg-neutral-50/60 transition-colors border-b border-neutral-100/70"
                  >
                    {/* Date Block */}
                    <TableCell className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl border border-[#E7DBFA] bg-gradient-to-b from-[#FBF9FE] to-[#F3EEFD] shadow-2xs">
                          <span className="text-[9px] font-extrabold text-[#6D28D9] tracking-wider uppercase leading-none">
                            {month}
                          </span>
                          <span className="text-sm font-black text-neutral-900 leading-tight">
                            {day}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-neutral-900">{full}</p>
                          <p className="text-[11px] font-medium text-neutral-400">{h.dayName}</p>
                        </div>
                      </div>
                    </TableCell>

                    {/* Holiday Name */}
                    <TableCell className="py-3">
                      <p className="text-xs font-bold text-neutral-900">{h.name}</p>
                    </TableCell>

                    {/* Type Badge */}
                    <TableCell className="py-3">
                      <span
                        className={cn(
                          "rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide",
                          h.type === "PUBLIC"
                            ? "bg-purple-100 text-[#6D28D9] border border-purple-200/60"
                            : h.type === "COMPANY"
                              ? "bg-blue-100 text-blue-800 border border-blue-200/60"
                              : "bg-amber-100 text-amber-800 border border-amber-200/60"
                        )}
                      >
                        {h.type === "PUBLIC"
                          ? "Public Holiday"
                          : h.type === "COMPANY"
                            ? "Company Off"
                            : "Restricted"}
                      </span>
                    </TableCell>

                    {/* Description */}
                    <TableCell className="py-3">
                      <p className="text-xs text-neutral-500 max-w-xs truncate">
                        {h.description || "—"}
                      </p>
                    </TableCell>

                    {/* Timeline Pill */}
                    <TableCell className="py-3">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[10px] font-bold shadow-2xs",
                          isToday
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                            : daysUntilLabel === "Tomorrow"
                              ? "bg-amber-100 text-amber-800 border border-amber-300"
                              : isPast
                                ? "bg-neutral-100 text-neutral-500"
                                : "bg-[#F3EAFD] text-[#6D28D9] border border-[#E7DBFA]"
                        )}
                      >
                        {daysUntilLabel}
                      </span>
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEdit(h)}
                          className="h-8 w-8 p-0 rounded-lg text-neutral-500 hover:text-[#6D28D9] hover:bg-neutral-100"
                          title="Edit Holiday"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onDelete(h.id, h.name)}
                          className="h-8 w-8 p-0 rounded-lg text-neutral-400 hover:text-rose-600 hover:bg-rose-50"
                          title="Delete Holiday"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
