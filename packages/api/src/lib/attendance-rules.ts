import type { PrismaClient } from "@realty-smartz/db";
import {
  getISTDateParts,
  LATE_CHECK_IN_HOUR,
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

export function isHalfDayCheckIn(checkIn: Date) {
  return istMinutes(checkIn) > toMinutes(HALF_DAY_CHECK_IN_AFTER);
}

export function statusFromFirstCheckIn(checkIn: Date): DayStatus {
  if (isHalfDayCheckIn(checkIn)) return "HALF_DAY";
  return istMinutes(checkIn) > LATE_CHECK_IN_HOUR * 60 ? "LATE" : "PRESENT";
}

export async function hasApprovedHalfDayLeave(
  prisma: PrismaClient,
  employeeId: string,
  date: Date
) {
  const leave = await prisma.leaveRequest.findFirst({
    where: { employeeId, isHalfDay: true, status: "APPROVED", startDate: date },
    select: { id: true },
  });
  return Boolean(leave);
}

/** Expected end of the working day; punching out before it is an early clock-out. */
export function shiftEndFor(halfDayLeave: boolean) {
  return halfDayLeave ? HALF_DAY_END_TIME : SHIFT_END_TIME;
}

export function isEarlyCheckOut(checkOut: Date, halfDayLeave: boolean) {
  return istMinutes(checkOut) < toMinutes(shiftEndFor(halfDayLeave));
}

/** Final day status after a punch-out, based on the FIRST punch-in and total hours worked. */
export function statusAfterCheckOut(args: {
  firstCheckIn: Date;
  cumulativeHours: number;
  halfDayLeave: boolean;
}): DayStatus {
  if (args.halfDayLeave) return "HALF_DAY";
  if (args.cumulativeHours < 4) return "HALF_DAY";
  return statusFromFirstCheckIn(args.firstCheckIn);
}
