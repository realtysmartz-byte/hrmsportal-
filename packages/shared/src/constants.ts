export const ROLES = ["ADMIN", "HR", "MANAGER", "EMPLOYEE"] as const;
export type Role = (typeof ROLES)[number];

export const EMPLOYEE_STATUSES = [
  "ACTIVE",
  "ON_LEAVE",
  "RESIGNED",
  "TERMINATED",
] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

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

export function canManageEmployees(role: Role): boolean {
  return HR_ADMIN_ROLES.includes(role);
}

/** Sensitive profile tabs: Attendance, Leave, Documents */
export function canViewSensitiveEmployeeData(
  viewer: { id: string; role: Role },
  target: { id: string; managerId: string | null }
): boolean {
  if (viewer.id === target.id) return true;
  if (HR_ADMIN_ROLES.includes(viewer.role)) return true;
  if (viewer.role === "MANAGER" && target.managerId === viewer.id) return true;
  return false;
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

export const LOCATION_PING_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

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

export function startOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}
