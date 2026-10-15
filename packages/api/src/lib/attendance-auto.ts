import type { PrismaClient } from "@realty-smartz/db";
import {
  startOfDayUTC,
  getISTDateParts,
  getAutoPunchOutTimeIST,
} from "@realty-smartz/shared";
import { hasApprovedHalfDayLeave, statusAfterCheckOut } from "./attendance-rules";

/**
 * Automatically stamps punch-out at 7:00 PM IST (19:00 IST / 13:30 UTC)
 * for any unclosed check-in records:
 * 1. For any past date (date < today in IST).
 * 2. For today (if current IST time >= 19:00 / 7:00 PM).
 *
 * Computes total hours worked, updates status (HALF_DAY if < 4 hrs, else PRESENT/LATE),
 * records automated checkout timestamp.
 */
const AUTO_PUNCH_CHECK_INTERVAL_MS = 60_000;
const lastAutoPunchCheck = new Map<string, number>();

export async function ensureAutoPunchOut(
  prisma: PrismaClient,
  employeeId?: string
): Promise<{ updatedCount: number }> {
  const key = employeeId ?? "*";
  const nowMs = Date.now();
  const last = Math.max(lastAutoPunchCheck.get(key) ?? 0, lastAutoPunchCheck.get("*") ?? 0);
  if (nowMs - last < AUTO_PUNCH_CHECK_INTERVAL_MS) {
    return { updatedCount: 0 };
  }
  lastAutoPunchCheck.set(key, nowMs);

  try {
    const now = new Date();
    const today = startOfDayUTC(now);
    const istNow = getISTDateParts(now);
    const isPastSevenPMToday = istNow.hour >= 19;

    const condition = isPastSevenPMToday ? { lte: today } : { lt: today };

    const unclosedLogs = await prisma.attendanceLog.findMany({
      where: {
        checkInTime: { not: null },
        checkOutTime: null,
        date: condition,
        ...(employeeId ? { employeeId } : {}),
      },
    });

    if (unclosedLogs.length === 0) {
      return { updatedCount: 0 };
    }

    let updatedCount = 0;
    for (const log of unclosedLogs) {
      if (!log.checkInTime) continue;

      const targetAutoOut = getAutoPunchOutTimeIST(log.date);

      // If user checked in after 7 PM, punch them out after 30 min
      let finalOutTime = targetAutoOut;
      if (finalOutTime <= log.checkInTime) {
        finalOutTime = new Date(log.checkInTime.getTime() + 30 * 60 * 1000);
      }

      const sessionHours =
        (finalOutTime.getTime() - log.checkInTime.getTime()) / (1000 * 60 * 60);
      const cumulativeHours = (log.totalHours || 0) + sessionHours;
      const roundedHours = Math.max(0.25, Math.round(cumulativeHours * 100) / 100);

      const [firstPunch, halfDayLeave] = await Promise.all([
        prisma.attendancePunch.findFirst({
          where: { attendanceLogId: log.id },
          orderBy: { checkInTime: "asc" },
          select: { checkInTime: true },
        }),
        hasApprovedHalfDayLeave(prisma, log.employeeId, log.date),
      ]);
      const status =
        log.status === "ON_LEAVE"
          ? log.status
          : statusAfterCheckOut({
              firstCheckIn: firstPunch?.checkInTime ?? log.checkInTime,
              cumulativeHours: roundedHours,
              halfDayLeave,
            });

      const lastPing = await prisma.locationPing.findFirst({
        where: {
          employeeId: log.employeeId,
          capturedAt: { gte: log.checkInTime, lte: finalOutTime },
        },
        orderBy: { capturedAt: "desc" },
        select: { lat: true, lng: true, address: true },
      });

      const autoNote = "Auto checked out at 7:00 PM";
      await prisma.attendanceLog.update({
        where: { id: log.id },
        data: {
          checkOutTime: finalOutTime,
          checkOutLat: lastPing?.lat ?? null,
          checkOutLng: lastPing?.lng ?? null,
          checkOutAddress: lastPing
            ? `Last known location: ${lastPing.address ?? `${lastPing.lat.toFixed(5)}, ${lastPing.lng.toFixed(5)}`}`
            : null,
          totalHours: roundedHours,
          status,
          notes: log.notes ? `${log.notes} · ${autoNote}` : autoNote,
        },
      });
      await prisma.attendancePunch.updateMany({
        where: { attendanceLogId: log.id, checkOutTime: null },
        data: { checkOutTime: finalOutTime, checkOutAddress: autoNote },
      });

      updatedCount++;
    }

    return { updatedCount };
  } catch (err) {
    console.error("[ensureAutoPunchOut] Error running auto punch-out:", err);
    return { updatedCount: 0 };
  }
}
