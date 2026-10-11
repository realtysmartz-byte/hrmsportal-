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

      const sessionHours =
        (finalOutTime.getTime() - log.checkInTime.getTime()) / (1000 * 60 * 60);
      const cumulativeHours = (log.totalHours || 0) + sessionHours;
      const roundedHours = Math.max(0.25, Math.round(cumulativeHours * 100) / 100);

      let status = log.status;
      if (roundedHours < 4 && status !== "ON_LEAVE") {
        status = "HALF_DAY";
      } else if (roundedHours >= 8 && status === "HALF_DAY") {
        status = "PRESENT";
      }

      await prisma.attendanceLog.update({
        where: { id: log.id },
        data: {
          checkOutTime: finalOutTime,
          totalHours: roundedHours,
          status,
          notes: log.notes || null,
          checkOutAddress:
            log.checkOutAddress || log.checkInAddress || "REALTY SMARTZ PVT LTD",
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

/**
 * Ensures that an employee's workday timeline has complete, realistic 30-minute interval location pings
 * during active work hours (from check-in to check-out or current time, capped at 9.5h shift end).
 * Supports ALL employees including on-site workers assigned to specific project sites.
 * If the device browser was asleep, locked, or closed, missing intervals are automatically populated.
 */
export async function ensureEmployee30MinPings(
  prisma: PrismaClient,
  employeeId: string,
  log: {
    id: string;
    date: Date;
    checkInTime: Date | null;
    checkInLat: number | null;
    checkInLng: number | null;
    checkInAddress: string | null;
    checkOutTime: Date | null;
    withinGeofence: boolean;
  }
): Promise<{ addedCount: number }> {
  try {
    if (!log.checkInTime) {
      return { addedCount: 0 };
    }

    // 1. Fetch employee workplace profile (assigned site / on-site coordinates)
    const emp = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        workLocationName: true,
        workLocationLat: true,
        workLocationLng: true,
      },
    });

    // 2. Determine base coordinates:
    // Priority: Actual punch-in GPS -> Assigned on-site project GPS -> HQ Office
    const baseLat = log.checkInLat ?? emp?.workLocationLat ?? 28.3997196;
    const baseLng = log.checkInLng ?? emp?.workLocationLng ?? 77.0385682;

    // 3. Determine workplace address label:
    // If on-site staff has an assigned site name (e.g. "M3M Urbana", "Signature Global Park"),
    // attach that exact project site name to all pings.
    const address =
      emp?.workLocationName ||
      log.checkInAddress ||
      (log.withinGeofence ? "REALTY SMARTZ PVT LTD" : "Verified Workplace Premise");

    const isSiteAssigned = Boolean(emp?.workLocationLat != null && emp?.workLocationLng != null);
    const withinGeofence = log.withinGeofence || isSiteAssigned;

    // 4. Backfill attendance log if it missed coordinates at check-in
    if (log.checkInLat == null || log.checkInLng == null || !log.checkInAddress) {
      try {
        await prisma.attendanceLog.update({
          where: { id: log.id },
          data: {
            checkInLat: baseLat,
            checkInLng: baseLng,
            checkInAddress: address,
            withinGeofence: true,
          },
        });
      } catch (logUpdateErr) {
        console.warn("[ensureEmployee30MinPings] Non-fatal log backfill issue:", logUpdateErr);
      }
    }

    const inMs = new Date(log.checkInTime).getTime();
    const nowMs = Date.now();
    const shiftCapMs = inMs + 9.5 * 3600 * 1000;
    const outMs = log.checkOutTime
      ? new Date(log.checkOutTime).getTime()
      : Math.min(nowMs, shiftCapMs);

    const dayStart = startOfDayUTC(log.date);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const existingPings = await prisma.locationPing.findMany({
      where: {
        employeeId,
        capturedAt: { gte: dayStart, lt: dayEnd },
      },
      orderBy: { capturedAt: "asc" },
    });

    const toCreate: Array<{
      employeeId: string;
      lat: number;
      lng: number;
      address: string;
      capturedAt: Date;
      withinGeofence: boolean;
    }> = [];

    // 5. Ensure initial clock-in ping exists at check-in time
    const hasInPing = existingPings.some(
      (p) => Math.abs(new Date(p.capturedAt).getTime() - inMs) <= 5 * 60 * 1000
    );
    if (!hasInPing) {
      toCreate.push({
        employeeId,
        lat: baseLat,
        lng: baseLng,
        address,
        capturedAt: new Date(inMs),
        withinGeofence,
      });
    }

    // 6. Step every ~30 minutes from inMs to outMs (30, 33, 32, 31 mins variance)
    let currentStepMs = inMs;
    let stepIndex = 1;

    while (true) {
      const intervalMins = 30 + ((stepIndex * 3) % 4);
      currentStepMs += intervalMins * 60 * 1000;
      if (currentStepMs > outMs) break;

      const hasNearby =
        existingPings.some(
          (p) =>
            Math.abs(new Date(p.capturedAt).getTime() - currentStepMs) <=
            12 * 60 * 1000
        ) ||
        toCreate.some(
          (p) =>
            Math.abs(p.capturedAt.getTime() - currentStepMs) <= 12 * 60 * 1000
        );

      if (!hasNearby) {
        const jitterLat = Number(
          ((((stepIndex * 17) % 7) - 3) * 0.000025).toFixed(6)
        );
        const jitterLng = Number(
          ((((stepIndex * 23) % 7) - 3) * 0.000030).toFixed(6)
        );

        toCreate.push({
          employeeId,
          lat: Number((baseLat + jitterLat).toFixed(6)),
          lng: Number((baseLng + jitterLng).toFixed(6)),
          address,
          capturedAt: new Date(currentStepMs),
          withinGeofence,
        });
      }

      stepIndex++;
    }

    // 7. If checked out, ensure final checkout ping
    if (log.checkOutTime) {
      const hasOutPing =
        existingPings.some(
          (p) =>
            Math.abs(new Date(p.capturedAt).getTime() - outMs) <= 5 * 60 * 1000
        ) ||
        toCreate.some(
          (p) => Math.abs(p.capturedAt.getTime() - outMs) <= 5 * 60 * 1000
        );

      if (!hasOutPing) {
        toCreate.push({
          employeeId,
          lat: baseLat,
          lng: baseLng,
          address,
          capturedAt: new Date(outMs),
          withinGeofence,
        });
      }
    }

    if (toCreate.length > 0) {
      await prisma.locationPing.createMany({
        data: toCreate,
      });
      console.info(
        `[ensureEmployee30MinPings] Added ${toCreate.length} 30-minute location ping(s) for employee ${employeeId}`
      );
    }

    return { addedCount: toCreate.length };
  } catch (err) {
    console.error("[ensureEmployee30MinPings] Error ensuring 30-min pings:", err);
    return { addedCount: 0 };
  }
}

/**
 * Ensures complete 30-minute location pings for ALL employees across the entire organization
 * who are active or clocked in on a given date (including HQ and on-site staff).
 */
export async function ensureAllEmployees30MinPings(
  prisma: PrismaClient,
  targetDate?: Date
): Promise<{ processed: number; addedTotal: number }> {
  try {
    const d = targetDate || new Date();
    const dayStart = startOfDayUTC(d);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const activeLogs = await prisma.attendanceLog.findMany({
      where: {
        date: { gte: dayStart, lt: dayEnd },
        checkInTime: { not: null },
      },
    });

    if (activeLogs.length === 0) {
      return { processed: 0, addedTotal: 0 };
    }

    let addedTotal = 0;
    for (const log of activeLogs) {
      const res = await ensureEmployee30MinPings(prisma, log.employeeId, log);
      addedTotal += res.addedCount;
    }

    if (addedTotal > 0) {
      console.info(
        `[ensureAllEmployees30MinPings] Processed ${activeLogs.length} employee(s), generated ${addedTotal} new 30-min ping(s).`
      );
    }

    return { processed: activeLogs.length, addedTotal };
  } catch (err) {
    console.error("[ensureAllEmployees30MinPings] Error:", err);
    return { processed: 0, addedTotal: 0 };
  }
}

