import type { PrismaClient } from "@realty-smartz/db";
import {
  startOfDayUTC,
  getISTDateParts,
  getAutoPunchOutTimeIST,
} from "@realty-smartz/shared";

/**
 * Automatically stamps punch-out at 7:00 PM IST (19:00 IST / 13:30 UTC)
 * for any unclosed check-in records:
 * 1. For any past date (date < today in IST).
 * 2. For today (if current IST time >= 19:00 / 7:00 PM).
 *
 * Computes total hours worked, updates status (HALF_DAY if < 4 hrs, else PRESENT/LATE),
 * records automated checkout notes and timestamp.
 */
export async function ensureAutoPunchOut(
  prisma: PrismaClient,
  employeeId?: string
): Promise<{ updatedCount: number }> {
  try {
    const now = new Date();
    const today = startOfDayUTC(now);
    const istNow = getISTDateParts(now);
    const isPastSevenPMToday = istNow.hour >= 19;

    // Past dates are always eligible for auto-checkout.
    // Today is eligible if current IST time is >= 7:00 PM.
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

      // Handle safety edge-case: If user checked in after 7 PM, punch them out after 30 min
      let finalOutTime = targetAutoOut;
      if (finalOutTime <= log.checkInTime) {
        finalOutTime = new Date(log.checkInTime.getTime() + 30 * 60 * 1000);
      }

      const totalHours =
        (finalOutTime.getTime() - log.checkInTime.getTime()) / (1000 * 60 * 60);
      const roundedHours = Math.max(0.25, Math.round(totalHours * 100) / 100);

      let status = log.status;
      if (roundedHours < 4 && status !== "ON_LEAVE") {
        status = "HALF_DAY";
      }

      const autoNote = "Auto checked out at 07:00 PM IST (Shift End)";
      const combinedNotes = log.notes
        ? log.notes.includes("Auto checked out")
          ? log.notes
          : `${log.notes} · ${autoNote}`
        : autoNote;

      await prisma.attendanceLog.update({
        where: { id: log.id },
        data: {
          checkOutTime: finalOutTime,
          totalHours: roundedHours,
          status,
          notes: combinedNotes,
          checkOutAddress:
            log.checkOutAddress || "Auto checkout (07:00 PM IST Shift End)",
        },
      });

      updatedCount++;
    }

    if (updatedCount > 0) {
      console.info(
        `[ensureAutoPunchOut] Successfully auto-punched out ${updatedCount} attendance log(s) at 7:00 PM IST.`
      );
    }

    return { updatedCount };
  } catch (err) {
    console.error("[ensureAutoPunchOut] Error running auto punch-out:", err);
    return { updatedCount: 0 };
  }
}
