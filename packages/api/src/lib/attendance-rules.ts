import type { PrismaClient } from "@realty-smartz/db";
import {
  getISTDateParts,
  LATE_CHECK_IN_HOUR,
  LATE_CHECK_IN_MINUTE,
  HALF_DAY_CHECK_IN_AFTER,
  SHIFT_END_TIME,
  HALF_DAY_END_TIME,
} from "@realty-smartz/shared";

type DayStatus = "PRESENT" | "LATE" | "HALF_DAY";

function istMinutes(d: Date) {
  const ist = getISTDateParts(d);
  return ist.hour * 60 + ist.minute;
}

function toMinutes(t: { hour: number; minute: number }) {
  return t.hour * 60 + t.minute;
}

export function formatClock(t: { hour: number; minute: number }) {
  const h12 = t.hour % 12 || 12;
  return `${h12}:${String(t.minute).padStart(2, "0")} ${t.hour < 12 ? "AM" : "PM"}`;
}

export function isHalfDayCheckIn(checkIn: Date, threshold?: { hour: number; minute: number } | string) {
  let target: { hour: number; minute: number } = HALF_DAY_CHECK_IN_AFTER;
  if (typeof threshold === "string") {
    const [h, m] = threshold.split(":").map(Number);
    target = { hour: h ?? 11, minute: m ?? 0 };
  } else if (threshold) {
    target = threshold;
  }
  return istMinutes(checkIn) > toMinutes(target);
}

export function statusFromFirstCheckIn(
  checkIn: Date,
  lateTimeStr?: string,
  halfDayTimeStr?: string
): DayStatus {
  if (isHalfDayCheckIn(checkIn, halfDayTimeStr)) return "HALF_DAY";
  let lateMinutes = LATE_CHECK_IN_HOUR * 60 + (LATE_CHECK_IN_MINUTE ?? 30);
  if (lateTimeStr) {
    const [h, m] = lateTimeStr.split(":").map(Number);
    lateMinutes = (h ?? 10) * 60 + (m ?? 30);
  }
  return istMinutes(checkIn) > lateMinutes ? "LATE" : "PRESENT";
}

export type HalfDaySlot = "FIRST_HALF" | "SECOND_HALF";

/** Slot of the employee's approved half-day leave on this date, or null if none. */
export async function getApprovedHalfDaySlot(
  prisma: PrismaClient,
  employeeId: string,
  date: Date
): Promise<HalfDaySlot | null> {
  const leave = await prisma.leaveRequest.findFirst({
    where: { employeeId, isHalfDay: true, status: "APPROVED", startDate: date },
    select: { halfDaySlot: true },
  });
  if (!leave) return null;
  return leave.halfDaySlot === "SECOND_HALF" ? "SECOND_HALF" : "FIRST_HALF";
}

/** Expected end of the working day; punching out before it is an early clock-out. */
export function shiftEndFor(halfDaySlot: HalfDaySlot | null) {
  return halfDaySlot === "FIRST_HALF" ? HALF_DAY_END_TIME : SHIFT_END_TIME;
}

export function isEarlyCheckOut(checkOut: Date, halfDaySlot: HalfDaySlot | null) {
  return istMinutes(checkOut) < toMinutes(shiftEndFor(halfDaySlot));
}

/** Final day status after a punch-out, based on the FIRST punch-in and total hours worked. */
export function statusAfterCheckOut(args: {
  firstCheckIn: Date;
  cumulativeHours: number;
  halfDaySlot: HalfDaySlot | null;
  lateTimeStr?: string;
  halfDayTimeStr?: string;
}): DayStatus {
  if (args.halfDaySlot) return "HALF_DAY";
  if (args.cumulativeHours < 4) return "HALF_DAY";
  return statusFromFirstCheckIn(args.firstCheckIn, args.lateTimeStr, args.halfDayTimeStr);
}
