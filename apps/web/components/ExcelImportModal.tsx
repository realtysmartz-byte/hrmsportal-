"use client";

import { userFacingErrorMessage } from "@/lib/user-facing-error";
import { useRef, useState } from "react";
import { Download, FileSpreadsheet, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

type Kind = "employees" | "attendance";

const COLUMNS: Record<Kind, { header: string; key: string; sample: string }[]> = {
  employees: [
    { header: "Employee Code", key: "employeeCode", sample: "RS-0101" },
    { header: "First Name", key: "firstName", sample: "Rahul" },
    { header: "Last Name", key: "lastName", sample: "Sharma" },
    { header: "Email", key: "email", sample: "rahul.sharma@realtysmartz.in" },
    { header: "Phone", key: "phone", sample: "9876543210" },
    { header: "Gender", key: "gender", sample: "Male" },
    { header: "Role", key: "role", sample: "EMPLOYEE" },
    { header: "Department", key: "department", sample: "Sales" },
    { header: "Designation", key: "designation", sample: "Sales Executive" },
    { header: "Date of Joining", key: "dateOfJoining", sample: "2026-04-01" },
    { header: "Date of Birth", key: "dateOfBirth", sample: "1998-08-15" },
    { header: "Status", key: "status", sample: "ACTIVE" },
    { header: "Password", key: "password", sample: "Realty@123" },
  ],
  attendance: [
    { header: "Employee Code", key: "employeeCode", sample: "RS-0101" },
    { header: "Email", key: "email", sample: "" },
    { header: "Date", key: "date", sample: "2026-09-15" },
    { header: "Check In", key: "checkIn", sample: "09:45" },
    { header: "Check Out", key: "checkOut", sample: "19:00" },
    { header: "Status", key: "status", sample: "PRESENT" },
  ],
};

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const pad = (n: number) => String(n).padStart(2, "0");

function cellToString(value: unknown): string {
  if (value instanceof Date) {
    const time = `${pad(value.getHours())}:${pad(value.getMinutes())}`;
    if (value.getFullYear() < 1901) return time;
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${time}`;
  }
  return value == null ? "" : String(value).trim();
}

export function ExcelImportModal({
  open,
  onClose,
  defaultKind = "employees",
}: {
  open: boolean;
  onClose: () => void;
  defaultKind?: Kind;
}) {
  const [kind, setKind] = useState<Kind>(defaultKind);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [parseError, setParseError] = useState("");
  const [result, setResult] = useState<{
    summary: string;
    errors: { row: number; message: string }[];
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const importEmployees = trpc.employee.importExcel.useMutation();
  const importAttendance = trpc.attendance.importExcel.useMutation();
  const busy = importEmployees.isLoading || importAttendance.isLoading;

  if (!open) return null;

  function reset(next: Kind = kind) {
    setKind(next);
    setFileName("");
    setRows([]);
    setParseError("");
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function downloadTemplate() {
    const XLSX = await import("xlsx");
    const cols = COLUMNS[kind];
    const ws = XLSX.utils.aoa_to_sheet([cols.map((c) => c.header), cols.map((c) => c.sample)]);
    ws["!cols"] = cols.map((c) => ({ wch: Math.max(c.header.length, c.sample.length) + 4 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, kind === "employees" ? "Employees" : "Attendance");
    XLSX.writeFile(wb, `realty-smartz-${kind}-template.xlsx`);
  }

  async function onFile(file?: File) {
    setResult(null);
    setParseError("");
    setRows([]);
    if (!file) return;
    setFileName(file.name);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      const keyByHeader = new Map(COLUMNS[kind].map((c) => [normalize(c.header), c.key]));

      const parsed = raw
        .map((r) => {
          const out: Record<string, string> = {};
          for (const [header, value] of Object.entries(r)) {
            const key = keyByHeader.get(normalize(header));
            const text = cellToString(value);
            if (key && text) out[key] = text;
          }
          return out;
        })
        .filter((r) => Object.keys(r).length > 0);

      if (parsed.length === 0) {
        setParseError("No data rows found. Use the template headers in the first row.");
        return;
      }
      setRows(parsed);
    } catch {
      setParseError("Could not read this file. Upload a valid .xlsx, .xls or .csv file.");
    }
  }

  async function onImport() {
    try {
      if (kind === "employees") {
        const res = await importEmployees.mutateAsync({ rows });
        setResult({ summary: `${res.created} added, ${res.updated} updated`, errors: res.errors });
        void utils.employee.list.invalidate();
      } else {
        const res = await importAttendance.mutateAsync({ rows });
        setResult({ summary: `${res.imported} attendance records imported`, errors: res.errors });
        void utils.attendance.invalidate();
      }
    } catch {
      return;
    }
    setRows([]);
    setFileName("");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-xl sm:rounded-xl bg-white">
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
          <h2 className="text-base font-semibold text-neutral-900">Import from Excel</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid grid-cols-2 rounded-lg bg-neutral-100 p-1 text-sm font-medium">
            {(["employees", "attendance"] as Kind[]).map((k) => (
              <button
                key={k}
                type="button"
                disabled={busy}
                onClick={() => reset(k)}
                className={`rounded-md py-2 transition-colors ${
                  kind === k ? "bg-white text-[#5D3EBC]" : "text-neutral-500"
                }`}
              >
                {k === "employees" ? "Employees" : "Attendance (6 months)"}
              </button>
            ))}
          </div>

          <p className="text-xs text-neutral-500 leading-relaxed">
            {kind === "employees"
              ? "Existing employees are matched by Email and updated. New employees are created with the given Password (default Realty@123). Missing departments and designations are created automatically."
              : "Each row is one day for one employee, matched by Employee Code or Email. Only dates within the last 6 months are imported; an existing record for the same day is replaced. Times are in IST."}
          </p>

          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#5D3EBC] hover:underline"
          >
            <Download className="h-4 w-4" />
            Download template
          </button>

          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-neutral-200 px-4 py-8 text-center hover:border-[#5D3EBC]/50 hover:bg-[#F3F0FC]/50">
            <FileSpreadsheet className="h-8 w-8 text-[#5D3EBC]" />
            <span className="text-sm font-medium text-neutral-800">
              {fileName || "Choose Excel file"}
            </span>
            <span className="text-xs text-neutral-400">.xlsx, .xls or .csv</span>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
          </label>

          {parseError && <p className="text-sm text-rose-600">{parseError}</p>}
          {rows.length > 0 && (
            <p className="text-sm text-neutral-700">
              <span className="font-semibold">{rows.length}</span> rows ready to import
            </p>
          )}

          {result && (
            <div className="rounded-lg border border-neutral-200 p-3 text-sm">
              <p className="font-semibold text-emerald-700">{result.summary}</p>
              {result.errors.length > 0 && (
                <>
                  <p className="mt-2 font-semibold text-rose-600">
                    {result.errors.length} rows skipped
                  </p>
                  <ul className="mt-1 max-h-40 overflow-y-auto space-y-0.5 text-xs text-neutral-600">
                    {result.errors.map((e, i) => (
                      <li key={i}>
                        Row {e.row}: {userFacingErrorMessage(e.message)}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-neutral-100 px-5 py-4">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Close
          </Button>
          <Button onClick={() => void onImport()} disabled={busy || rows.length === 0}>
            <Upload className="mr-2 h-4 w-4" />
            {busy ? "Importing…" : "Import"}
          </Button>
        </div>
      </div>
    </div>
  );
}
