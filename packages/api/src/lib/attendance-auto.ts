import type { PrismaClient } from "@realty-smartz/db";
import {
  startOfDayUTC,
  getISTDateParts,
  getAutoPunchOutTimeIST,
} from "@realty-smartz/shared";
import { getApprovedHalfDaySlot, statusAfterCheckOut } from "./attendance-rules";

/**
 * Auto punch-out at 7:00 PM IST.
 * Fast path: throttle + empty check so dashboard/API stays snappy.
 */
const AUTO_PUNCH_CHECK_INTERVAL_MS = 60_000;
/** Per-employee checks after 7 PM can run more often so UI updates without refresh */
const AUTO_PUNCH_EMPLOYEE_INTERVAL_MS = 10_000;
const lastAutoPunchCheck = new Map<string, number>();
/** After a successful close for an employee today, skip re-work until next day. */
const closedCleanCache = new Map<string, string>(); // employeeId -> YYYY-MM-DD

export async function ensureAutoPunchOut(
  prisma: PrismaClient,
  employeeId?: string
): Promise<{ updatedCount: number }> {
  const now = new Date();
  const today = startOfDayUTC(now);
  const todayKey = today.toISOString().slice(0, 10);
  const isPastSevenPMToday = getISTDateParts(now).hour >= 19;
  const key = employeeId ?? "*";

  if (employeeId && closedCleanCache.get(employeeId) === todayKey) {
    return { updatedCount: 0 };
  }

  const nowMs = Date.now();
  const last = lastAutoPunchCheck.get(key) ?? 0;
  const gap =
    employeeId && isPastSevenPMToday
      ? AUTO_PUNCH_EMPLOYEE_INTERVAL_MS
      : AUTO_PUNCH_CHECK_INTERVAL_MS;
  if (nowMs - last < gap) {
    return { updatedCount: 0 };
  }
  lastAutoPunchCheck.set(key, nowMs);

  try {
    const dateFilter = isPastSevenPMToday ? { lte: today } : { lt: today };

    const unclosedLogs = await prisma.attendanceLog.findMany({
      where: {
        checkInTime: { not: null },
        checkOutTime: null,
        date: dateFilter,
        ...(employeeId ? { employeeId } : {}),
      },
      // Keep payload small — only fields needed to close
      select: {
        id: true,
        employeeId: true,
        date: true,
        checkInTime: true,
        checkInAddress: true,
        totalHours: true,
        status: true,
        notes: true,
      },
    });

    if (unclosedLogs.length === 0) {
      if (employeeId) closedCleanCache.set(employeeId, todayKey);
      return { updatedCount: 0 };
    }

    let updatedCount = 0;
    for (const log of unclosedLogs) {
      if (!log.checkInTime) continue;

      const targetAutoOut = getAutoPunchOutTimeIST(log.date);
      let finalOutTime = targetAutoOut;
      if (finalOutTime <= log.checkInTime) {
        finalOutTime = new Date(log.checkInTime.getTime() + 30 * 60 * 1000);
      }

      const sessionHours =
        (finalOutTime.getTime() - log.checkInTime.getTime()) / (1000 * 60 * 60);
      const cumulativeHours = (log.totalHours || 0) + sessionHours;
      const roundedHours = Math.max(0.25, Math.round(cumulativeHours * 100) / 100);

      const [firstPunch, halfDaySlot] = await Promise.all([
        prisma.attendancePunch.findFirst({
          where: { attendanceLogId: log.id },
          orderBy: { checkInTime: "asc" },
          select: { checkInTime: true },
        }),
        getApprovedHalfDaySlot(prisma, log.employeeId, log.date),
      ]);
      const status =
        log.status === "ON_LEAVE"
          ? log.status
          : statusAfterCheckOut({
              firstCheckIn: firstPunch?.checkInTime ?? log.checkInTime,
              cumulativeHours: roundedHours,
              halfDaySlot,
            });

      const autoNote = "Auto checked out at 7:00 PM";
      await prisma.attendanceLog.update({
        where: { id: log.id },
        data: {
          checkOutTime: finalOutTime,
          totalHours: roundedHours,
          status,
          notes: log.notes ? `${log.notes} · ${autoNote}` : autoNote,
        },
      });
      const closed = await prisma.attendancePunch.updateMany({
        where: { attendanceLogId: log.id, checkOutTime: null },
        data: { checkOutTime: finalOutTime, checkOutAddress: autoNote },
      });
      if (closed.count === 0) {
        await prisma.attendancePunch.create({
          data: {
            attendanceLogId: log.id,
            checkInTime: log.checkInTime,
            checkInAddress: log.checkInAddress,
            checkOutTime: finalOutTime,
            checkOutAddress: autoNote,
          },
        });
      }

      updatedCount++;
    }

    if (employeeId) closedCleanCache.set(employeeId, todayKey);
    return { updatedCount };
  } catch (err) {
    console.error("[ensureAutoPunchOut] Error running auto punch-out:", err);
    return { updatedCount: 0 };
  }
}
