export const ROLES = ["ADMIN", "HR", "MANAGER", "EMPLOYEE"] as const;
export type Role = (typeof ROLES)[number];

export const EMPLOYEE_STATUSES = [
  "ACTIVE",
  "ON_LEAVE",
  "RESIGNED",
  "TERMINATED",
  "EXIT",
] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

/** Statuses that may still use the portal (login + session). */
export const LOGIN_ALLOWED_STATUSES = ["ACTIVE", "ON_LEAVE"] as const;

export function canEmployeeLogin(status: string): boolean {
  return (LOGIN_ALLOWED_STATUSES as readonly string[]).includes(status);
}

export const ATTENDANCE_STATUSES = [
  "PRESENT",
  "LATE",
  "HALF_DAY",
  "ABSENT",
  "ON_LEAVE",
  "HOLIDAY",
] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const LEAVE_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

export const CYCLE_TYPES = ["APPRAISAL", "OKR"] as const;
export type CycleType = (typeof CYCLE_TYPES)[number];

export const CYCLE_STATUSES = ["DRAFT", "ACTIVE", "CLOSED"] as const;
export type CycleStatus = (typeof CYCLE_STATUSES)[number];

export const GOAL_CATEGORIES = ["INDIVIDUAL", "TEAM", "COMPANY"] as const;
export type GoalCategory = (typeof GOAL_CATEGORIES)[number];

export const GOAL_STATUSES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "COMPLETED",
  "MISSED",
] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export const REVIEW_TYPES = ["SELF", "MANAGER"] as const;
export type ReviewType = (typeof REVIEW_TYPES)[number];

export const REVIEW_STATUSES = ["PENDING", "SUBMITTED"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const DEFAULT_DEPARTMENTS = [
  "Engineering",
  "Sales",
  "Human Resources",
  "Finance",
  "Marketing",
  "Operations",
] as const;

export const DEFAULT_DESIGNATIONS = [
  "Chief Executive Officer",
  "HR Manager",
  "Engineering Manager",
  "Sales Manager",
  "Software Engineer",
  "Sales Executive",
  "HR Executive",
  "Finance Executive",
] as const;

export const EMPLOYEE_CODE_PREFIX = "RS-";

export const HR_ADMIN_ROLES: Role[] = ["ADMIN", "HR"];

/** Check-in after this local hour is marked LATE */
export const LATE_CHECK_IN_HOUR = 10;

/** First punch-in after this IST time (hour, minute) marks the day HALF_DAY */
export const HALF_DAY_CHECK_IN_AFTER = { hour: 11, minute: 30 } as const;

/** Punch-out before this IST time sends an early clock-out mail */
export const SHIFT_END_TIME = { hour: 17, minute: 0 } as const;

/** Half days split at this IST time: first half works till it, second half works from it */
export const HALF_DAY_END_TIME = { hour: 14, minute: 30 } as const;

export const HALF_DAY_SLOT_LABELS = {
  FIRST_HALF: "First Half (work till 2:30 PM)",
  SECOND_HALF: "Second Half (work from 2:30 PM)",
} as const;

export function canManageEmployees(role: Role): boolean {
  return HR_ADMIN_ROLES.includes(role);
}

export type EmployeeVisibilityLevel = "FULL" | "LIMITED" | "NONE";

/**
 * Shared visibility logic for employee directory & profile hub access control:
 * - FULL: Self, ADMIN, HR, or Direct Manager of the target employee
 * - LIMITED: Regular colleagues (view-only directory info: name, photo, designation, department, work email, phone, manager)
 * - NONE: Invalid or missing target
 */
export function getEmployeeVisibilityLevel(
  viewer: { id: string; role: Role },
  target: { id: string; managerId?: string | null } | null | undefined
): EmployeeVisibilityLevel {
  if (!target || !target.id) return "NONE";
  if (viewer.id === target.id) return "FULL";
  if (HR_ADMIN_ROLES.includes(viewer.role)) return "FULL";
  if (viewer.role === "MANAGER" && target.managerId === viewer.id) return "FULL";
  return "LIMITED";
}

/** Sensitive profile tabs: Attendance, Leave, Documents, Performance */
export function canViewSensitiveEmployeeData(
  viewer: { id: string; role: Role },
  target: { id: string; managerId: string | null }
): boolean {
  return getEmployeeVisibilityLevel(viewer, target) === "FULL";
}

export function canManageOrg(role: Role): boolean {
  return HR_ADMIN_ROLES.includes(role);
}

export function canViewTeamAttendance(role: Role): boolean {
  return role === "ADMIN" || role === "HR" || role === "MANAGER";
}

export function canApproveLeave(role: Role): boolean {
  return role === "ADMIN" || role === "HR" || role === "MANAGER";
}

export function canManageLeaveTypes(role: Role): boolean {
  return HR_ADMIN_ROLES.includes(role);
}

export function canManageHolidays(role: Role): boolean {
  return HR_ADMIN_ROLES.includes(role);
}

export function canManageCompanySettings(role: Role): boolean {
  return role === "ADMIN";
}

export function canManagePerformance(role: Role): boolean {
  return HR_ADMIN_ROLES.includes(role);
}

export function canAccessAdminPortal(role: Role): boolean {
  return role === "ADMIN" || role === "HR";
}

export function homePathForRole(role: Role): string {
  return canAccessAdminPortal(role)
    ? "/admin-portal/dashboard"
    : "/employee-portal/dashboard";
}

export function isManager(role: Role): boolean {
  return role === "MANAGER";
}

/**
 * Realty Smartz weekly off: Tuesday (JS getDay() === 2).
 * Saturday and Sunday are working days.
 */
export const WEEKLY_OFF_DAY = 2; // Tuesday

export const LOCATION_PING_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export function isWeeklyOffDay(dayOfWeek: number): boolean {
  return dayOfWeek === WEEKLY_OFF_DAY;
}

export function isWorkingDay(dayOfWeek: number): boolean {
  return !isWeeklyOffDay(dayOfWeek);
}

/** Haversine distance in meters between two WGS84 coordinates */
export function haversineDistanceM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Count working days (skips Tuesday weekly off) inclusive between two dates */
export function countWeekdays(start: Date, end: Date): number {
  const s = new Date(start);
  const e = new Date(end);
  s.setHours(0, 0, 0, 0);
  e.setHours(0, 0, 0, 0);
  if (e < s) return 0;

  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    if (isWorkingDay(cur.getDay())) count += 1;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

/** List each working date (UTC date-only) between start and end inclusive */
export function listWeekdayDates(start: Date, end: Date): Date[] {
  const s = new Date(start);
  const e = new Date(end);
  s.setUTCHours(0, 0, 0, 0);
  e.setUTCHours(0, 0, 0, 0);
  const dates: Date[] = [];
  const cur = new Date(s);
  while (cur <= e) {
    if (isWorkingDay(cur.getUTCDay())) {
      dates.push(new Date(cur));
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

/** Timezone for all Realty Smartz operations (Indian Standard Time) */
export const TIMEZONE_IST = "Asia/Kolkata";

/** Daily automatic checkout hour (19:00 / 7:00 PM IST) */
export const AUTO_PUNCH_OUT_HOUR_IST = 19;
export const AUTO_PUNCH_OUT_MINUTE_IST = 0;

/** Extract date and time parts in IST (Asia/Kolkata) */
export function getISTDateParts(d: Date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE_IST,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });
  const parts = formatter.formatToParts(d);
  const find = (type: string) => {
    const val = parts.find((p) => p.type === type)?.value;
    return val ? parseInt(val, 10) : 0;
  };
  return {
    year: find("year"),
    month: find("month"), // 1-12
    day: find("day"),
    hour: find("hour") === 24 ? 0 : find("hour"), // 0-23
    minute: find("minute"),
    second: find("second"),
  };
}

/**
 * Returns UTC midnight Date corresponding to the IST calendar day.
 * Ensures consistent day-boundaries whether running on Vercel (UTC) or local.
 */
export function startOfDayUTC(d?: Date | string | null): Date {
  if (!d) d = new Date();
  if (typeof d === "string") {
    const match = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return new Date(
        Date.UTC(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10))
      );
    }
    d = new Date(d);
  }
  const ist = getISTDateParts(d);
  return new Date(Date.UTC(ist.year, ist.month - 1, ist.day));
}

/** Returns YYYY-MM-DD date string representing the IST day */
export function getISTDateString(d: Date = new Date()): string {
  const ist = getISTDateParts(d);
  const y = ist.year;
  const m = String(ist.month).padStart(2, "0");
  const day = String(ist.day).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Returns the exact 7:00 PM IST (19:00:00 IST = 13:30:00 UTC) Date for a given date.
 */
export function getAutoPunchOutTimeIST(forDate: Date): Date {
  const ist = getISTDateParts(forDate);
  // 19:00:00 IST is 13:30:00.000 UTC
  return new Date(Date.UTC(ist.year, ist.month - 1, ist.day, 13, 30, 0, 0));
}

/** Format a time in 12-hour IST format (e.g. "09:45 AM") */
export function formatTimeIST(date?: Date | string | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-IN", {
    timeZone: TIMEZONE_IST,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/** Format a date in IST format (e.g. "08 Oct 2026") */
export function formatDateIST(date?: Date | string | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    timeZone: TIMEZONE_IST,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Format both date and time in readable IST format (e.g. "08 Oct 2026, 09:32 AM") */
export function formatDateTimeIST(date?: Date | string | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  const dateStr = d.toLocaleDateString("en-IN", {
    timeZone: TIMEZONE_IST,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const timeStr = d.toLocaleTimeString("en-IN", {
    timeZone: TIMEZONE_IST,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  return `${dateStr}, ${timeStr}`;
}

