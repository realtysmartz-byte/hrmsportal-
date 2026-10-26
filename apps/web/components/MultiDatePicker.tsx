"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  CalendarDays,
  Calendar,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MultiDatePickerProps {
  selectedDates: string[];
  onChange: (dates: string[]) => void;
  isSingle?: boolean;
  placeholder?: string;
  className?: string;
}

const MONTH_NAMES = [
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

const WEEKDAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function formatReadableDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-IN", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getDaysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function getFirstDayOfWeek(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
}

function formatIsoDate(year: number, monthIndex: number, day: number): string {
  const m = String(monthIndex + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

function getDatesBetween(startStr: string, endStr: string): string[] {
  const dates: string[] = [];
  const start = new Date(startStr + "T00:00:00Z");
  const end = new Date(endStr + "T00:00:00Z");
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return [startStr];
  const actualStart = start <= end ? start : end;
  const actualEnd = start <= end ? end : start;

  const curr = new Date(actualStart);
  while (curr <= actualEnd && dates.length < 60) {
    dates.push(curr.toISOString().split("T")[0]);
    curr.setUTCDate(curr.getUTCDate() + 1);
  }
  return dates;
}

export function MultiDatePicker({
  selectedDates,
  onChange,
  isSingle = false,
  placeholder = "Select date(s)...",
  className,
}: MultiDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize viewing month/year from first selected date or today
  const initialDate = useMemo(() => {
    if (selectedDates.length > 0 && selectedDates[0]) {
      const [y, m] = selectedDates[0].split("-").map(Number);
      return { year: y, month: m - 1 };
    }
    const today = new Date();
    return { year: today.getFullYear(), month: today.getMonth() };
  }, [selectedDates]);

  const [viewYear, setViewYear] = useState<number>(initialDate.year);
  const [viewMonth, setViewMonth] = useState<number>(initialDate.month);

  // Selection mode: "multiple" | "range" | "single"
  const [mode, setMode] = useState<"multiple" | "range" | "single">(
    isSingle ? "single" : "multiple"
  );
  const [rangeStart, setRangeStart] = useState<string | null>(null);

  // Close calendar popover on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  function handleDayClick(dayStr: string) {
    if (mode === "single" || isSingle) {
      onChange([dayStr]);
      setIsOpen(false);
      return;
    }

    if (mode === "multiple") {
      if (selectedDates.includes(dayStr)) {
        onChange(selectedDates.filter((d) => d !== dayStr));
      } else {
        onChange([...selectedDates, dayStr].sort());
      }
      return;
    }

    if (mode === "range") {
      if (!rangeStart) {
        setRangeStart(dayStr);
        onChange([dayStr]);
      } else {
        const fullRange = getDatesBetween(rangeStart, dayStr);
        onChange(fullRange);
        setRangeStart(null);
      }
    }
  }

  function handleRemoveDate(dateStr: string, e?: React.MouseEvent) {
    e?.stopPropagation();
    onChange(selectedDates.filter((d) => d !== dateStr));
  }

  function handleClearAll(e?: React.MouseEvent) {
    e?.stopPropagation();
    onChange([]);
    setRangeStart(null);
  }

  // Generate days for currently viewed month
  const totalDays = getDaysInMonth(viewYear, viewMonth);
  const firstDayOffset = getFirstDayOfWeek(viewYear, viewMonth);
  const todayStr = new Date().toISOString().split("T")[0];

  // Display text in input field
  const displayText = useMemo(() => {
    if (selectedDates.length === 0) return "";
    if (selectedDates.length === 1) {
      return formatReadableDate(selectedDates[0]);
    }
    return `${selectedDates.length} dates selected (${formatReadableDate(selectedDates[0])} + ${selectedDates.length - 1} more)`;
  }, [selectedDates]);

  return (
    <div className={cn("relative w-full", className)} ref={containerRef}>
      {/* 1. Main Trigger Input Box */}
      <div
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "flex min-h-[38px] w-full cursor-pointer items-center justify-between rounded-xl border border-[#E2E4E9] bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 transition-all hover:border-[#6D28D9] focus-within:border-[#6D28D9] focus-within:ring-2 focus-within:ring-[#6D28D9]/20 shadow-2xs",
          isOpen && "border-[#6D28D9] ring-2 ring-[#6D28D9]/20"
        )}
      >
        <div className="flex flex-1 items-center gap-2 overflow-hidden">
          <CalendarDays className="h-4 w-4 shrink-0 text-[#6D28D9]" />
          {selectedDates.length === 0 ? (
            <span className="text-neutral-400 select-none">{placeholder}</span>
          ) : (
            <span className="truncate font-semibold text-neutral-900">{displayText}</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-2">
          {selectedDates.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="rounded-full p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              title="Clear all dates"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <span className="rounded-md bg-[#F3EAFD] px-1.5 py-0.5 text-[10px] font-bold text-[#6D28D9]">
            {selectedDates.length > 0 ? `${selectedDates.length} selected` : "Pick"}
          </span>
        </div>
      </div>

      {/* Selected Dates Tag Pills (Directly visible below the input) */}
      {selectedDates.length > 1 && (
        <div className="mt-1.5 flex flex-wrap gap-1 max-h-24 overflow-y-auto scrollbar-thin">
          {selectedDates.map((d) => (
            <span
              key={d}
              className="inline-flex items-center gap-1 rounded-full bg-[#F3EAFD] border border-[#E9D5FF] px-2 py-0.5 text-[11px] font-bold text-[#6D28D9]"
            >
              <span>{formatReadableDate(d)}</span>
              <button
                type="button"
                onClick={(e) => handleRemoveDate(d, e)}
                className="text-[#7C3AED] hover:text-rose-600 rounded-full"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* 2. Interactive Calendar Popover */}
      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-full min-w-[320px] max-w-sm rounded-2xl border border-[#E0D7F5] bg-white p-3.5 shadow-xl animate-in fade-in zoom-in-95 duration-100">
          {/* Header Mode Switcher (if not locked to single) */}
          {!isSingle && (
            <div className="mb-3 flex items-center justify-between rounded-xl bg-neutral-100/70 p-1 text-xs">
              <button
                type="button"
                onClick={() => {
                  setMode("multiple");
                  setRangeStart(null);
                }}
                className={cn(
                  "flex-1 rounded-lg py-1 text-center font-bold transition-all text-[11px]",
                  mode === "multiple"
                    ? "bg-white text-[#6D28D9] shadow-2xs"
                    : "text-neutral-500 hover:text-neutral-900"
                )}
              >
                Multi-Select
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("range");
                  setRangeStart(null);
                }}
                className={cn(
                  "flex-1 rounded-lg py-1 text-center font-bold transition-all text-[11px]",
                  mode === "range"
                    ? "bg-white text-[#6D28D9] shadow-2xs"
                    : "text-neutral-500 hover:text-neutral-900"
                )}
              >
                Date Range
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("single");
                  setRangeStart(null);
                }}
                className={cn(
                  "flex-1 rounded-lg py-1 text-center font-bold transition-all text-[11px]",
                  mode === "single"
                    ? "bg-white text-[#6D28D9] shadow-2xs"
                    : "text-neutral-500 hover:text-neutral-900"
                )}
              >
                Single Date
              </button>
            </div>
          )}

          {/* Month / Year Navigation */}
          <div className="mb-3 flex items-center justify-between px-1">
            <button
              type="button"
              onClick={prevMonth}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-100 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-1.5">
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(Number(e.target.value))}
                className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs font-bold text-neutral-800 focus:outline-none focus:border-[#6D28D9]"
              >
                {MONTH_NAMES.map((name, i) => (
                  <option key={name} value={i}>
                    {name}
                  </option>
                ))}
              </select>

              <select
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value))}
                className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs font-bold text-neutral-800 focus:outline-none focus:border-[#6D28D9]"
              >
                {[2025, 2026, 2027, 2028, 2029].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={nextMonth}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-100 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Instruction helper */}
          <div className="mb-2 px-1 text-[11px] font-medium text-neutral-500">
            {mode === "multiple" && "Click any dates to toggle selection"}
            {mode === "range" && (rangeStart ? "Click second date to complete range" : "Click start date for the range")}
            {mode === "single" && "Click a date to select"}
          </div>

          {/* Weekday Header */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-neutral-400 mb-1">
            {WEEKDAY_NAMES.map((w) => (
              <div key={w} className="py-1">
                {w}
              </div>
            ))}
          </div>

          {/* Day Cells Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty Offset cells */}
            {Array.from({ length: firstDayOffset }).map((_, i) => (
              <div key={`offset-${i}`} className="h-8 w-8" />
            ))}

            {/* Day Number Buttons */}
            {Array.from({ length: totalDays }).map((_, i) => {
              const day = i + 1;
              const dateIso = formatIsoDate(viewYear, viewMonth, day);
              const isSelected = selectedDates.includes(dateIso);
              const isToday = dateIso === todayStr;
              const isStart = rangeStart === dateIso;

              return (
                <button
                  key={dateIso}
                  type="button"
                  onClick={() => handleDayClick(dateIso)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold transition-all relative",
                    isSelected
                      ? "bg-[#6D28D9] text-white shadow-2xs font-bold hover:bg-[#5B21B6]"
                      : isStart
                      ? "bg-[#8B5CF6] text-white font-bold"
                      : "text-neutral-700 hover:bg-neutral-100",
                    isToday && !isSelected && "border border-[#8B5CF6] font-bold text-[#6D28D9]"
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Footer Actions */}
          <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-2.5">
            <span className="text-[11px] font-bold text-[#6D28D9]">
              {selectedDates.length} date{selectedDates.length === 1 ? "" : "s"} selected
            </span>

            <div className="flex items-center gap-2">
              {selectedDates.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-neutral-500 hover:text-neutral-800"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-1 rounded-lg bg-[#6D28D9] px-3 py-1 text-xs font-bold text-white hover:bg-[#5B21B6] transition-colors"
              >
                <Check className="h-3 w-3" />
                <span>Done</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
