const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Parses "2026-05-14", "14-05-2026", "14/05/2026" or "14 May 2026" into YYYY-MM-DD */
export function parseExcelDate(value?: string | null): string | null {
  const v = (value ?? "").trim();
  if (!v) return null;

  let m = v.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return toIso(+m[1], +m[2], +m[3]);

  m = v.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) return toIso(+m[3], +m[2], +m[1]);

  m = v.match(/^(\d{1,2})[\s-]([A-Za-z]{3})[A-Za-z]*[\s-](\d{4})/);
  if (m) {
    const month = MONTHS.indexOf(m[2].toLowerCase()) + 1;
    if (month > 0) return toIso(+m[3], month, +m[1]);
  }
  return null;
}

function toIso(y: number, mo: number, d: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Parses "09:45", "9:45 AM", "18:30:00" (optionally after a date) into [hour, minute] */
export function parseExcelTime(value?: string | null): [number, number] | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  const m = v.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?\s*$/i);
  if (!m) return null;
  let hour = +m[1];
  const minute = +m[2];
  const ampm = m[3]?.toLowerCase();
  if (ampm === "pm" && hour < 12) hour += 12;
  if (ampm === "am" && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;
  return [hour, minute];
}

/** IST wall-clock time on an IST calendar date, as a UTC Date */
export function istDateTime(isoDate: string, [hour, minute]: [number, number]): Date {
  const [y, mo, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d, hour, minute) - 330 * 60 * 1000);
}
