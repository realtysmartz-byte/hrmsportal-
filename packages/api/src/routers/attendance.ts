import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  checkInOutSchema,
  myAttendanceMonthSchema,
  teamAttendanceSchema,
  employeeAttendanceSchema,
  employeeAttendanceHistorySchema,
  locationPingSchema,
  startOfDayUTC,
  getISTDateParts,
  isWeeklyOffDay,
  LATE_CHECK_IN_HOUR,
  canViewTeamAttendance,
  formatTimeIST,
} from "@realty-smartz/shared";
import type { Role } from "@realty-smartz/shared";
import type { Context } from "../context";
import { hrAdminProcedure, protectedProcedure, router } from "../trpc";
import { istDateTime, parseExcelDate, parseExcelTime } from "../lib/excel-import";
import { assertCanViewSensitive } from "../lib/employee-access";
import { ensureAutoPunchOut } from "../lib/attendance-auto";
import { reverseGeocodePunchAddress } from "../lib/punch-address";
import {
  formatClock,
  getApprovedHalfDaySlot,
  isEarlyCheckOut,
  shiftEndFor,
  statusAfterCheckOut,
  statusFromFirstCheckIn,
} from "../lib/attendance-rules";
import {
  canonicalizeOfficeAttendanceLabels,
  getPunchGeofenceSites,
  resolvePunchGeofence,
} from "../lib/work-location";
import { assertRateLimit } from "../lib/rate-limit";

/** Reject pings whose GPS fix is older than this or stamped in the future. */
const MAX_PING_AGE_MS = 5 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 0;
/** Ignore duplicate tracking pings closer than this (30 min cadence). */
const MIN_TRACKING_PING_GAP_MS = 55 * 60 * 1000; // ~1 hour cadence
/** Flag for admin review when GPS accuracy is worse than this (meters). */
const REVIEW_ACCURACY_M = 100;
const PUNCH_RATE_LIMIT = 10;
const PUNCH_RATE_WINDOW_MS = 60_000;

function enforcePunchRateLimit(employeeId: string, ip?: string | null) {
  enforceEmployeeAndIpRateLimit("punch", employeeId, ip);
}

function enforceEmployeeAndIpRateLimit(
  namespace: string,
  employeeId: string,
  ip?: string | null
) {
  const empHit = assertRateLimit(
    `${namespace}:emp:${employeeId}`,
    PUNCH_RATE_LIMIT,
    PUNCH_RATE_WINDOW_MS
  );
  const ipHit = assertRateLimit(
    `${namespace}:ip:${ip || "unknown"}`,
    PUNCH_RATE_LIMIT,
    PUNCH_RATE_WINDOW_MS
  );
  if (!empHit.ok || !ipHit.ok) {
    const retry = Math.max(empHit.ok ? 0 : empHit.retryAfterSec, ipHit.ok ? 0 : ipHit.retryAfterSec);
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Too many ${namespace === "punch" ? "punch attempts" : "location reports"}. Try again in ${retry}s.`,
    });
  }
}

function scheduleAfterResponse(
  ctx: Context,
  task: () => Promise<void>
) {
  const run = () =>
    task().catch((err: unknown) => {
      console.error(
        "[attendance] post-response task failed:",
        err instanceof Error ? err.name : "Unknown error"
      );
    });
  if (ctx.afterResponse) {
    ctx.afterResponse(run);
  } else {
    setTimeout(() => void run(), 0);
  }
}

function schedulePunchLocationWork(
  ctx: Context,
  input: {
    employeeId: string;
    logId: string;
    lat: number;
    lng: number;
    accuracyM: number;
    withinGeofence: boolean;
    capturedAt: Date;
    direction: "in" | "out";
    checkInTime: Date;
    address: string | null;
  }
) {
  scheduleAfterResponse(ctx, async () => {
    const pingPromise = ctx.prisma.locationPing
      .create({
        data: {
          employeeId: input.employeeId,
          lat: input.lat,
          lng: input.lng,
          address: input.address,
          accuracyM: input.accuracyM,
          withinGeofence: input.withinGeofence,
          capturedAt: input.capturedAt,
        },
      })
      .catch((pingErr: unknown) => {
        console.error(
          `[attendance.check${input.direction === "in" ? "In" : "Out"}] locationPing failed:`,
          pingErr instanceof Error ? pingErr.name : "Unknown error"
        );
        return null;
      });

    let address = input.address;
    if (!address) {
      address = `${input.lat.toFixed(5)}, ${input.lng.toFixed(5)}`;
      try {
        address = await reverseGeocodePunchAddress(input.lat, input.lng);
      } catch (geocodeErr: unknown) {
        console.error(
          `[attendance.check${input.direction === "in" ? "In" : "Out"}] reverse geocoding failed:`,
          geocodeErr instanceof Error ? geocodeErr.name : "Unknown error"
        );
      }
    }

    const addressUpdate =
      input.direction === "in"
        ? Promise.all([
            ctx.prisma.attendanceLog.updateMany({
              where: { id: input.logId, checkInTime: input.capturedAt },
              data: { checkInAddress: address },
            }),
            ctx.prisma.attendancePunch.updateMany({
              where: {
                attendanceLogId: input.logId,
                checkInTime: input.checkInTime,
              },
              data: { checkInAddress: address },
            }),
          ])
        : Promise.all([
            ctx.prisma.attendanceLog.updateMany({
              where: { id: input.logId, checkOutTime: input.capturedAt },
              data: { checkOutAddress: address },
            }),
            ctx.prisma.attendancePunch.updateMany({
              where: {
                attendanceLogId: input.logId,
                checkInTime: input.checkInTime,
                checkOutTime: input.capturedAt,
              },
              data: { checkOutAddress: address },
            }),
          ]);

    await Promise.all([
      addressUpdate,
      pingPromise.then((ping) =>
        ping
          ? ctx.prisma.locationPing.update({
              where: { id: ping.id },
              data: { address },
            })
          : null
      ),
    ]);

    // Send Telegram Notification post-response with lifecycle guarantee
    if (input.direction === "in") {
      try {
        const emp = await ctx.prisma.employee.findUnique({
          where: { id: input.employeeId },
          select: { firstName: true, lastName: true, employeeCode: true },
        });
        if (emp) {
          const timeStr = formatTimeIST(input.capturedAt);
          const dateStr = input.capturedAt.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            timeZone: "Asia/Kolkata",
          });
          const locationName =
            address || `${input.lat.toFixed(5)}, ${input.lng.toFixed(5)}`;

          const { formatPunchTelegramMessage, sendTelegramNotification } = await import(
            "../lib/telegram"
          );

          const msg = formatPunchTelegramMessage({
            employeeName: `${emp.firstName} ${emp.lastName}`,
            employeeCode: emp.employeeCode,
            timeStr,
            dateStr,
            locationName,
            lat: input.lat,
            lng: input.lng,
          });
          await sendTelegramNotification(
            ctx.prisma,
            "ATTENDANCE_LEAVE",
            "notifyPunchIn",
            msg
          );
        }
      } catch (err) {
        console.error("[telegram:punch] alert failed:", err);
      }
    }
  });
}

function reviewNotes(opts: {
  accuracyM: number | null | undefined;
  isMock?: boolean;
  withinGeofence: boolean;
}): string | null {
  const parts: string[] = [];
  if (opts.isMock) parts.push("review:mock-gps");
  if (opts.accuracyM != null && opts.accuracyM > REVIEW_ACCURACY_M) {
    parts.push(`review:low-accuracy(${Math.round(opts.accuracyM)}m)`);
  }
  if (!opts.withinGeofence) parts.push("review:outside-geofence");
  if (opts.accuracyM != null && Number.isFinite(opts.accuracyM)) {
    parts.push(`gps:${Math.round(opts.accuracyM)}m`);
  }
  return parts.length ? parts.join(" · ") : null;
}

let sheetSyncTimer: ReturnType<typeof setTimeout> | null = null;

/** Many punches at once collapse into one Google Sheet sync per minute. */
function scheduleSheetSync(prisma: Context["prisma"], date: Date) {
  if (sheetSyncTimer) return;
  sheetSyncTimer = setTimeout(async () => {
    sheetSyncTimer = null;
    try {
      const { getActiveGoogleSheetConfig, setLastSyncMetadata } = await import("./googleSheets");
      const { generateDailyAttendanceData, syncReportToGoogleSheet } = await import(
        "../lib/google-sheets"
      );
      const sheetConfig = getActiveGoogleSheetConfig();
      if (sheetConfig.webhookUrl || sheetConfig.spreadsheetId) {
        const reportData = await generateDailyAttendanceData(prisma, date);
        const res = await syncReportToGoogleSheet(sheetConfig, reportData);
        setLastSyncMetadata({
          date: reportData.dateStr,
          sheetTitle: res.sheetTitle,
          rowCount: res.rowCount,
          syncedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error(
        "[attendance] Google Sheet sync error:",
        err instanceof Error ? err.name : "Unknown error"
      );
    }
  }, 60_000);
}

function attendanceStatusFromCheckIn(
  checkInTime: Date
): "LATE" | "PRESENT" {
  const ist = getISTDateParts(checkInTime);
  return ist.hour > LATE_CHECK_IN_HOUR || (ist.hour === LATE_CHECK_IN_HOUR && ist.minute > 0)
    ? "LATE"
    : "PRESENT";
}

/** Prefer session user id — no DB round-trip on every attendance call. */
function resolveEmployeeId(ctx: Context) {
  const id = ctx.session?.user?.id;
  if (id) return id;
  throw new TRPCError({
    code: "UNAUTHORIZED",
    message: "Not signed in. Please sign in again.",
  });
}

function summarizeLogs(
  logs: {
    status: string;
    checkInTime: Date | null;
    withinGeofence: boolean;
  }[]
) {
  const present = logs.filter((l) =>
    ["PRESENT", "LATE", "HALF_DAY"].includes(l.status)
  ).length;
  const absent = logs.filter((l) => l.status === "ABSENT").length;
  const outsideGeofence = logs.filter(
    (l) => l.checkInTime && !l.withinGeofence
  ).length;
  const checkIns = logs.filter((l) => l.checkInTime).map((l) => l.checkInTime!);

  let averageCheckIn: string | null = null;
  if (checkIns.length > 0) {
    const avgMs =
      checkIns.reduce((sum, t) => {
        const ist = getISTDateParts(t);
        return (
          sum +
          (ist.hour * 3600 + ist.minute * 60 + ist.second) * 1000
        );
      }, 0) / checkIns.length;
    const totalSec = Math.floor(avgMs / 1000);
    const h = String(Math.floor(totalSec / 3600)).padStart(2, "0");
    const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
    averageCheckIn = `${h}:${m}`;
  }

  return {
    present,
    absent,
    onLeave: logs.filter((l) => l.status === "ON_LEAVE").length,
    averageCheckIn,
    outsideGeofence,
  };
}

export const attendanceRouter = router({
  today: protectedProcedure.query(async ({ ctx }) => {
    const employeeId = resolveEmployeeId(ctx);
    const today = startOfDayUTC(new Date());
    const punchInclude = {
      punches: { orderBy: { checkInTime: "asc" as const } },
    };

    let log = await ctx.prisma.attendanceLog.findUnique({
      where: {
        employeeId_date: { employeeId, date: today },
      },
      include: punchInclude,
    });

    // After 7 PM: only auto-out if still on duty (cron also runs — no auth/session impact)
    if (
      getISTDateParts(new Date()).hour >= 19 &&
      log?.checkInTime &&
      !log.checkOutTime
    ) {
      await ensureAutoPunchOut(ctx.prisma, employeeId);
      log = await ctx.prisma.attendanceLog.findUnique({
        where: {
          employeeId_date: { employeeId, date: today },
        },
        include: punchInclude,
      });
    }

    if (log) {
      [log] = await canonicalizeOfficeAttendanceLabels(ctx.prisma, [log]);
    }
    return log;
  }),

  /**
   * Punch geofence sites: office is always allowed; assigned site is also allowed when set.
   * `primary` is for display (assigned if any, else office).
   */
  myWorkLocation: protectedProcedure.query(async ({ ctx }) => {
    const employeeId = resolveEmployeeId(ctx);
    const sites = await getPunchGeofenceSites(ctx.prisma, employeeId);
    const primary = sites.find((s) => s.source === "ASSIGNED") ?? sites[0];
    return {
      ...primary,
      sites,
      office: sites.find((s) => s.source === "OFFICE") ?? null,
      assigned: sites.find((s) => s.source === "ASSIGNED") ?? null,
      serverTime: new Date(),
    };
  }),

  /**
   * Returns past 7 days (1 week) attendance history for current logged-in employee.
   * Auto-punches out past 7:00 PM and gives complete punch-in/out and shift breakdown.
   */
  myRecentWeek: protectedProcedure.query(async ({ ctx }) => {
    const employeeId = resolveEmployeeId(ctx);
    // Auto punch-out runs only on `today` — keep week list fast

    const today = startOfDayUTC(new Date());
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      days.push(d);
    }
    const oldest = days[days.length - 1];

    const logs = await ctx.prisma.attendanceLog.findMany({
      where: {
        employeeId,
        date: { gte: oldest, lte: today },
      },
      orderBy: { date: "desc" },
    });
    const displayLogs = await canonicalizeOfficeAttendanceLabels(ctx.prisma, logs);

    const logMap = new Map(
      displayLogs.map((l) => [l.date.toISOString().slice(0, 10), l])
    );

    const result = days.map((d) => {
      const key = d.toISOString().slice(0, 10);
      const log = logMap.get(key) || null;
      const isToday = key === today.toISOString().slice(0, 10);
      const dow = d.getUTCDay();
      const isOff = isWeeklyOffDay(dow);

      return {
        date: d,
        dateStr: key,
        formattedDate: d.toLocaleDateString("en-IN", {
          timeZone: "Asia/Kolkata",
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
        dayName: d.toLocaleDateString("en-IN", {
          timeZone: "Asia/Kolkata",
          weekday: "short",
        }),
        fullDayName: d.toLocaleDateString("en-IN", {
          timeZone: "Asia/Kolkata",
          weekday: "long",
        }),
        isToday,
        isWeeklyOff: isOff,
        log: log
          ? {
              id: log.id,
              status: log.status,
              checkInTime: log.checkInTime,
              checkOutTime: log.checkOutTime,
              checkInAddress: log.checkInAddress,
              checkOutAddress: log.checkOutAddress,
              totalHours: log.totalHours,
              withinGeofence: log.withinGeofence,
              notes: log.notes,
              isAutoCheckedOut: Boolean(
                log.checkOutTime && log.notes?.includes("Auto checked out")
              ),
            }
          : null,
      };
    });

    return result;
  }),

  myMonth: protectedProcedure
    .input(myAttendanceMonthSchema)
    .query(async ({ ctx, input }) => {
      const employeeId = resolveEmployeeId(ctx);
      const start = new Date(Date.UTC(input.year, input.month - 1, 1));
      const end = new Date(Date.UTC(input.year, input.month, 0));

      // No punches include — month table uses log times; keeps payload small/fast
      const logs = await ctx.prisma.attendanceLog.findMany({
        where: {
          employeeId,
          date: { gte: start, lte: end },
        },
        orderBy: { date: "asc" },
      });
      const displayLogs = await canonicalizeOfficeAttendanceLabels(
        ctx.prisma,
        logs
      );

      return { logs: displayLogs, summary: summarizeLogs(logs) };
    }),

  forEmployeeMonth: protectedProcedure
    .input(employeeAttendanceSchema)
    .query(async ({ ctx, input }) => {
      await assertCanViewSensitive(ctx, input.employeeId);
      const start = new Date(Date.UTC(input.year, input.month - 1, 1));
      const end = new Date(Date.UTC(input.year, input.month, 0));

      const logs = await ctx.prisma.attendanceLog.findMany({
        where: {
          employeeId: input.employeeId,
          date: { gte: start, lte: end },
        },
        orderBy: { date: "asc" },
      });
      const displayLogs = await canonicalizeOfficeAttendanceLabels(
        ctx.prisma,
        logs
      );

      return { logs: displayLogs, summary: summarizeLogs(logs) };
    }),

  forEmployeeHistory: protectedProcedure
    .input(employeeAttendanceHistorySchema)
    .query(async ({ ctx, input }) => {
      await assertCanViewSensitive(ctx, input.employeeId);

      const where: {
        employeeId: string;
        date?: { gte: Date; lte: Date };
      } = { employeeId: input.employeeId };

      if (input.year != null && input.month != null) {
        where.date = {
          gte: new Date(Date.UTC(input.year, input.month - 1, 1)),
          lte: new Date(Date.UTC(input.year, input.month, 0)),
        };
      } else if (input.year != null) {
        where.date = {
          gte: new Date(Date.UTC(input.year, 0, 1)),
          lte: new Date(Date.UTC(input.year, 11, 31)),
        };
      }

      const [logs, total, allForStats] = await Promise.all([
        ctx.prisma.attendanceLog.findMany({
          where,
          orderBy: { date: "desc" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        ctx.prisma.attendanceLog.count({ where }),
        ctx.prisma.attendanceLog.findMany({
          where: { employeeId: input.employeeId },
          select: {
            status: true,
            checkInTime: true,
            withinGeofence: true,
          },
        }),
      ]);
      const displayLogs = await canonicalizeOfficeAttendanceLabels(
        ctx.prisma,
        logs
      );

      return {
        logs: displayLogs,
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(total / input.pageSize),
        allTimeSummary: summarizeLogs(allForStats),
      };
    }),

  checkIn: protectedProcedure
    .input(checkInOutSchema)
    .mutation(async ({ ctx, input }) => {
      // Session employee only — never trust a client-supplied employee id
      const employeeId = resolveEmployeeId(ctx);
      enforcePunchRateLimit(employeeId, ctx.ip);

      const today = startOfDayUTC(new Date());
      // Parallel independent reads (geofence uses Haversine + cached office)
      const [existing, geo, firstHalfDaySlot] = await Promise.all([
        ctx.prisma.attendanceLog.findUnique({
          where: { employeeId_date: { employeeId, date: today } },
        }),
        resolvePunchGeofence(ctx.prisma, employeeId, input.lat, input.lng),
        getApprovedHalfDaySlot(ctx.prisma, employeeId, today),
      ]);

      // Idempotent: already on duty → acknowledge the repeated tap.
      if (existing?.checkInTime && !existing.checkOutTime) {
        return { success: true };
      }
      if (existing?.status === "ON_LEAVE") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You are marked ON_LEAVE for today",
        });
      }

      // Server-computed geofence only — ignore any client withinGeofence/distance/address
      const workLocation = geo.matched;
      const withinGeofence = geo.withinGeofence;

      if (!withinGeofence || !workLocation) {
        const names = geo.sites.map((s) => s.name).join(" or ");
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Punch-in blocked: you are ~${Math.round(geo.distanceM)}m from ${geo.nearest.name}. You must be within ${geo.nearest.radiusM}m of ${names}.`,
        });
      }

      const now = new Date(); // SERVER time
      const isFirstPunch = !existing?.checkInTime;
      const halfDaySlot = isFirstPunch ? firstHalfDaySlot : null;
      const status =
        !isFirstPunch && existing
          ? existing.status
          : halfDaySlot
            ? "HALF_DAY"
            : statusFromFirstCheckIn(now);

      const finalAddress = workLocation.name;
      const meta = reviewNotes({
        accuracyM: input.accuracyM,
        isMock: input.isMockLocation,
        withinGeofence,
      });
      let logNotes: string | null =
        workLocation.source === "ASSIGNED"
          ? `Site punch-in: ${workLocation.name}`
          : "Office punch-in";
      if (existing?.checkOutTime) {
        const reNote = `Re-punch in at ${formatTimeIST(now)}`;
        logNotes = existing.notes ? `${existing.notes} · ${reNote}` : reNote;
      }
      if (meta) logNotes = logNotes ? `${logNotes} · ${meta}` : meta;

      const locationData = {
        checkInTime: now,
        checkInLat: input.lat,
        checkInLng: input.lng,
        checkInAddress: null,
        checkOutTime: null as Date | null,
        checkOutLat: null as number | null,
        checkOutLng: null as number | null,
        checkOutAddress: null as string | null,
        withinGeofence,
        status,
        notes: logNotes,
      };

      const punchData = {
        checkInTime: now,
        checkInAddress: null,
      };

      let log: { id: string };
      try {
        if (existing) {
          const claimed = await ctx.prisma.$transaction(async (tx) => {
            const updated = await tx.attendanceLog.updateMany({
              where: { id: existing.id, checkOutTime: existing.checkOutTime },
              data: locationData,
            });
            if (updated.count === 0) return false;
            await tx.attendancePunch.create({
              data: { ...punchData, attendanceLogId: existing.id },
            });
            return true;
          });
          if (!claimed) return { success: true };
          log = { id: existing.id };
        } else {
          log = await ctx.prisma.attendanceLog.create({
              data: {
                employeeId,
                date: today,
                ...locationData,
                punches: { create: punchData },
              },
              select: { id: true },
            });
        }
      } catch (err: unknown) {
        const isUniqueConflict =
          typeof err === "object" &&
          err !== null &&
          "code" in err &&
          err.code === "P2002";
        if (!isUniqueConflict) throw err;
        // Unique employee+date race — re-read and treat as idempotent if already in.
        const again = await ctx.prisma.attendanceLog.findUnique({
          where: { employeeId_date: { employeeId, date: today } },
        });
        if (again?.checkInTime && !again.checkOutTime) return { success: true };
        throw err;
      }

      schedulePunchLocationWork(ctx, {
        employeeId,
        logId: log.id,
        lat: input.lat,
        lng: input.lng,
        accuracyM: input.accuracyM,
        withinGeofence,
        capturedAt: now,
        direction: "in",
        checkInTime: now,
        address: finalAddress,
      });

      scheduleAfterResponse(ctx, async () => {
        try {
          const { notifyPunchDetails, notifyOutsideGeofence } = await import(
            "../lib/email"
          );
          const emp = await ctx.prisma.employee.findUnique({
            where: { id: employeeId },
            select: {
              email: true,
              firstName: true,
              lastName: true,
              employeeCode: true,
              manager: { select: { email: true } },
            },
          });
          if (emp) {
            const name = `${emp.firstName} ${emp.lastName}`;
            await notifyPunchDetails({
              employeeName: name,
              employeeEmail: emp.email,
              employeeCode: emp.employeeCode,
              checkInTime: now,
              status: !isFirstPunch
                ? "RE-PUNCH IN"
                : halfDaySlot
                  ? "HALF DAY (APPROVED LEAVE)"
                  : status,
              address: finalAddress,
              withinGeofence,
              managerEmail: emp.manager?.email,
            });
            if (!withinGeofence) {
              await notifyOutsideGeofence({
                employeeName: name,
                employeeEmail: emp.email,
                employeeCode: emp.employeeCode,
                checkInTime: now,
                address: finalAddress,
                managerEmail: emp.manager?.email,
              });
            }
          }
        } catch (err) {
          console.error(
            "[attendance.checkIn] email notify failed:",
            err instanceof Error ? err.name : "Unknown error"
          );
        }
      });
      scheduleAfterResponse(ctx, async () => scheduleSheetSync(ctx.prisma, today));

      return { success: true };
    }),

  checkOut: protectedProcedure
    .input(checkInOutSchema)
    .mutation(async ({ ctx, input }) => {
      const employeeId = resolveEmployeeId(ctx);
      enforcePunchRateLimit(employeeId, ctx.ip);

      const today = startOfDayUTC(new Date());
      const existing = await ctx.prisma.attendanceLog.findUnique({
        where: { employeeId_date: { employeeId, date: today } },
      });

      if (!existing?.checkInTime) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Check in first before checking out",
        });
      }
      // Idempotent: already punched out → acknowledge the repeated tap.
      if (existing.checkOutTime) {
        return { success: true };
      }
      const checkInTime = existing.checkInTime;

      const now = new Date(); // SERVER time
      const sessionHours =
        (now.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
      const cumulativeHours = (existing.totalHours || 0) + sessionHours;

      const [firstPunch, halfDaySlot, geo] = await Promise.all([
        ctx.prisma.attendancePunch.findFirst({
          where: { attendanceLogId: existing.id },
          orderBy: { checkInTime: "asc" },
          select: { checkInTime: true },
        }),
        getApprovedHalfDaySlot(ctx.prisma, employeeId, today),
        resolvePunchGeofence(ctx.prisma, employeeId, input.lat, input.lng),
      ]);

      const status =
        existing.status === "ON_LEAVE"
          ? existing.status
          : statusAfterCheckOut({
              firstCheckIn: firstPunch?.checkInTime ?? checkInTime,
              cumulativeHours,
              halfDaySlot,
            });
      const earlyCheckOut = isEarlyCheckOut(now, halfDaySlot);
      const roundedHours = Math.round(cumulativeHours * 100) / 100;

      // Server geofence only — never trust a client-supplied address.
      const outWithinGeofence = geo.withinGeofence;
      const finalOutAddress =
        geo.matched?.name ?? `${input.lat.toFixed(5)}, ${input.lng.toFixed(5)}`;
      const outNote = `Punch out at ${formatTimeIST(now)}`;
      const meta = reviewNotes({
        accuracyM: input.accuracyM,
        isMock: input.isMockLocation,
        withinGeofence: outWithinGeofence,
      });
      let logNotes = existing.notes ? `${existing.notes} · ${outNote}` : outNote;
      if (meta) logNotes = `${logNotes} · ${meta}`;

      const punchedOut = await ctx.prisma.$transaction(async (tx) => {
        const updatedLog = await tx.attendanceLog.updateMany({
          where: { id: existing.id, checkOutTime: null },
          data: {
            checkOutTime: now,
            checkOutLat: input.lat,
            checkOutLng: input.lng,
            checkOutAddress: null,
            totalHours: roundedHours,
            status,
            notes: logNotes,
          },
        });
        if (updatedLog.count === 0) return false;
        const closed = await tx.attendancePunch.updateMany({
          where: { attendanceLogId: existing.id, checkOutTime: null },
          data: {
            checkOutTime: now,
            checkOutAddress: null,
          },
        });
        if (closed.count === 0) {
          await tx.attendancePunch.create({
            data: {
              attendanceLogId: existing.id,
              checkInTime,
              checkInAddress: existing.checkInAddress,
              checkOutTime: now,
              checkOutAddress: null,
            },
          });
        }
        return true;
      });
      if (!punchedOut) return { success: true };

      schedulePunchLocationWork(ctx, {
        employeeId,
        logId: existing.id,
        lat: input.lat,
        lng: input.lng,
        accuracyM: input.accuracyM,
        withinGeofence: outWithinGeofence,
        capturedAt: now,
        direction: "out",
        checkInTime,
        address: geo.matched?.name ?? null,
      });

      scheduleAfterResponse(ctx, async () => {
        try {
          const { notifyCheckOutDetails } = await import("../lib/email");
          const emp = await ctx.prisma.employee.findUnique({
            where: { id: employeeId },
            select: {
              email: true,
              firstName: true,
              lastName: true,
              employeeCode: true,
              manager: { select: { email: true } },
            },
          });
          if (emp) {
            const name = `${emp.firstName} ${emp.lastName}`;
            await notifyCheckOutDetails({
              employeeName: name,
              employeeEmail: emp.email,
              employeeCode: emp.employeeCode,
              checkOutTime: now,
              totalHours: roundedHours,
              address: finalOutAddress,
              managerEmail: emp.manager?.email,
              expectedOutTime: earlyCheckOut
                ? formatClock(shiftEndFor(halfDaySlot))
                : undefined,
            });
          }
        } catch (err) {
          console.error(
            "[attendance.checkOut] email notify failed:",
            err instanceof Error ? err.name : "Unknown error"
          );
        }
      });
      scheduleAfterResponse(ctx, async () => scheduleSheetSync(ctx.prisma, today));

      return { success: true };
    }),

  team: protectedProcedure
    .input(teamAttendanceSchema)
    .query(async ({ ctx, input }) => {
      const role = ctx.session.user.role as Role;
      if (!canViewTeamAttendance(role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Auto clock-out runs via cron — do not block team roster loads

      const isRange = Boolean(input.startDate && input.endDate);
      const targetDate = startOfDayUTC(input.date ?? new Date());
      const employeeWhere: Record<string, unknown> = {
        status: { in: ["ACTIVE", "ON_LEAVE"] },
      };

      if (role === "MANAGER") {
        employeeWhere.managerId = resolveEmployeeId(ctx);
      }
      if (input.departmentId) {
        employeeWhere.departmentId = input.departmentId;
      }

      const employees = await ctx.prisma.employee.findMany({
        where: employeeWhere,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeCode: true,
          department: { select: { id: true, name: true } },
          designation: { select: { id: true, title: true } },
        },
        orderBy: { firstName: "asc" },
      });

      // If a date range (e.g. 1 month) is requested, return all attendance logs for that period
      if (isRange) {
        const start = startOfDayUTC(input.startDate!);
        const end = startOfDayUTC(input.endDate!);

        const logs = await ctx.prisma.attendanceLog.findMany({
          where: {
            employeeId: { in: employees.map((e) => e.id) },
            date: { gte: start, lte: end },
            ...(input.outsideGeofenceOnly ? { withinGeofence: false } : {}),
          },
          orderBy: [{ date: "desc" }, { checkInTime: "desc" }],
        });

        const displayLogs = await canonicalizeOfficeAttendanceLabels(
          ctx.prisma,
          logs
        );
        const empMap = new Map(employees.map((e) => [e.id, e]));
        const rows = displayLogs
          .map((log) => {
            const employee = empMap.get(log.employeeId);
            if (!employee) return null;
            return {
              employee,
              log,
            };
          })
          .filter((r): r is { employee: (typeof employees)[number]; log: (typeof displayLogs)[number] } => Boolean(r));

        return {
          date: start,
          startDate: input.startDate,
          endDate: input.endDate,
          isRange: true,
          rows,
        };
      }

      const logs = await ctx.prisma.attendanceLog.findMany({
        where: {
          employeeId: { in: employees.map((e) => e.id) },
          date: targetDate,
          ...(input.outsideGeofenceOnly ? { withinGeofence: false } : {}),
        },
      });

      const displayLogs = await canonicalizeOfficeAttendanceLabels(
        ctx.prisma,
        logs
      );
      const logByEmployee = new Map(displayLogs.map((l) => [l.employeeId, l]));

      let rows = employees.map((emp) => ({
        employee: emp,
        log: logByEmployee.get(emp.id) ?? null,
      }));

      if (input.outsideGeofenceOnly) {
        rows = rows.filter((r) => r.log && !r.log.withinGeofence);
      }

      return { date: targetDate, isRange: false, rows };
    }),

  /**
   * Returns all attendance entries across employees with date range presets,
   * search query, department filter, status filter, and pagination.
   */
  allEntries: protectedProcedure
    .input(
      z.object({
        range: z
          .enum(["today", "week", "month", "all", "custom"])
          .default("all"),
        startDate: z.coerce.date().optional(),
        endDate: z.coerce.date().optional(),
        departmentId: z.string().optional(),
        status: z
          .enum([
            "PRESENT",
            "LATE",
            "HALF_DAY",
            "ABSENT",
            "ON_LEAVE",
            "HOLIDAY",
          ])
          .optional(),
        outsideGeofenceOnly: z.boolean().optional(),
        search: z.string().optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(200).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const role = ctx.session.user.role as Role;
      if (!canViewTeamAttendance(role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Auto clock-out runs via cron — do not block allEntries loads

      const today = startOfDayUTC(new Date());

      // Determine date range condition
      let dateFilter: { gte?: Date; lte?: Date } | undefined = undefined;

      if (input.range === "today") {
        dateFilter = { gte: today, lte: today };
      } else if (input.range === "week") {
        const weekAgo = new Date(today);
        weekAgo.setUTCDate(weekAgo.getUTCDate() - 6);
        dateFilter = { gte: weekAgo, lte: today };
      } else if (input.range === "month") {
        const ist = getISTDateParts(today);
        const startOfMonth = new Date(Date.UTC(ist.year, ist.month - 1, 1));
        const endOfMonth = new Date(Date.UTC(ist.year, ist.month, 0));
        dateFilter = { gte: startOfMonth, lte: endOfMonth };
      } else if (input.range === "custom") {
        if (input.startDate || input.endDate) {
          dateFilter = {};
          if (input.startDate) dateFilter.gte = startOfDayUTC(input.startDate);
          if (input.endDate) dateFilter.lte = startOfDayUTC(input.endDate);
        }
      }

      // Build employee filters
      const employeeWhere: Record<string, unknown> = {};
      if (role === "MANAGER") {
        employeeWhere.managerId = resolveEmployeeId(ctx);
      }
      if (input.departmentId) {
        employeeWhere.departmentId = input.departmentId;
      }
      if (input.search && input.search.trim()) {
        const q = input.search.trim();
        employeeWhere.OR = [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { employeeCode: { contains: q, mode: "insensitive" } },
        ];
      }

      const logWhere: Record<string, unknown> = {
        employee: employeeWhere,
      };

      if (dateFilter) {
        logWhere.date = dateFilter;
      }
      if (input.status) {
        logWhere.status = input.status;
      }
      if (input.outsideGeofenceOnly) {
        logWhere.withinGeofence = false;
        logWhere.checkInTime = { not: null };
      }

      const [entries, totalCount, statsLogs] = await Promise.all([
        ctx.prisma.attendanceLog.findMany({
          where: logWhere,
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeCode: true,
                profilePhotoUrl: true,
                department: { select: { id: true, name: true } },
                designation: { select: { id: true, title: true } },
              },
            },
          },
          orderBy: [{ date: "desc" }, { checkInTime: "desc" }],
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        ctx.prisma.attendanceLog.count({ where: logWhere }),
        ctx.prisma.attendanceLog.findMany({
          where: logWhere,
          select: {
            status: true,
            checkInTime: true,
            withinGeofence: true,
            totalHours: true,
          },
        }),
      ]);
      const displayEntries = await canonicalizeOfficeAttendanceLabels(
        ctx.prisma,
        entries
      );

      const presentCount = statsLogs.filter((l) =>
        ["PRESENT", "LATE", "HALF_DAY"].includes(l.status)
      ).length;
      const lateCount = statsLogs.filter((l) => l.status === "LATE").length;
      const halfDayCount = statsLogs.filter((l) => l.status === "HALF_DAY").length;
      const absentCount = statsLogs.filter((l) => l.status === "ABSENT").length;
      const outsideCount = statsLogs.filter(
        (l) => l.checkInTime && !l.withinGeofence
      ).length;

      const totalHoursSum = statsLogs.reduce(
        (acc, l) => acc + (l.totalHours || 0),
        0
      );
      const avgHours =
        presentCount > 0 ? Math.round((totalHoursSum / presentCount) * 10) / 10 : 0;

      return {
        entries: displayEntries,
        totalCount,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.max(1, Math.ceil(totalCount / input.pageSize)),
        summary: {
          presentCount,
          lateCount,
          halfDayCount,
          absentCount,
          outsideCount,
          avgHours,
        },
      };
    }),


  locationPing: protectedProcedure
    .input(locationPingSchema)
    .mutation(async ({ ctx, input }) => {
      const employeeId = resolveEmployeeId(ctx);
      enforceEmployeeAndIpRateLimit("location-ping", employeeId, ctx.ip);

      const nowMs = Date.now();
      const capturedMs = input.capturedAt.getTime();
      if (capturedMs > nowMs + MAX_CLOCK_SKEW_MS || nowMs - capturedMs > MAX_PING_AGE_MS) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Location fix is stale or has an invalid timestamp",
        });
      }

      const todayLog = await ctx.prisma.attendanceLog.findUnique({
        where: {
          employeeId_date: { employeeId, date: startOfDayUTC(new Date()) },
        },
        select: { checkInTime: true, checkOutTime: true },
      });
      if (!todayLog?.checkInTime || todayLog.checkOutTime) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Location pings are only recorded while punched in",
        });
      }

      const duplicate = await ctx.prisma.locationPing.findFirst({
        where: { employeeId, capturedAt: input.capturedAt },
      });
      if (duplicate) return { success: true };

      // App/browser must not spam — keep ~30 minute spacing between tracking pings
      const recent = await ctx.prisma.locationPing.findFirst({
        where: {
          employeeId,
          capturedAt: { gte: new Date(Date.now() - MIN_TRACKING_PING_GAP_MS) },
        },
        orderBy: { capturedAt: "desc" },
      });
      if (recent) return { success: true };

      const geo = await resolvePunchGeofence(
        ctx.prisma,
        employeeId,
        input.lat,
        input.lng
      );

      await ctx.prisma.locationPing.create({
        data: {
          employeeId,
          lat: input.lat,
          lng: input.lng,
          address: geo.matched?.name ?? (input.address || null),
          accuracyM: input.accuracyM ?? null,
          withinGeofence: geo.withinGeofence,
          capturedAt: input.capturedAt,
        },
      });
      return { success: true };
    }),

  savePushSubscription: protectedProcedure
    .input(
      z.object({
        endpoint: z.string().url().max(2000),
        p256dh: z.string().min(1).max(500),
        auth: z.string().min(1).max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const employeeId = resolveEmployeeId(ctx);
      await ctx.prisma.pushSubscription.upsert({
        where: { endpoint: input.endpoint },
        update: { employeeId, p256dh: input.p256dh, auth: input.auth },
        create: { employeeId, ...input },
      });
      return { ok: true };
    }),

  myLocationPings: protectedProcedure
    .input(
      z.object({
        date: z.coerce.date().optional(),
        limit: z.number().int().min(1).max(100).default(48),
      })
    )
    .query(async ({ ctx, input }) => {
      const employeeId = resolveEmployeeId(ctx);
      const day = input.date ? startOfDayUTC(input.date) : startOfDayUTC(new Date());
      const next = new Date(day);
      next.setUTCDate(next.getUTCDate() + 1);

      return ctx.prisma.locationPing.findMany({
        where: {
          employeeId,
          capturedAt: { gte: day, lt: next },
        },
        orderBy: { capturedAt: "desc" },
        take: input.limit,
      });
    }),

  employeeLocationPings: protectedProcedure
    .input(
      z.object({
        employeeId: z.string(),
        date: z.coerce.date().optional(),
        limit: z.number().int().min(1).max(100).default(48),
      })
    )
    .query(async ({ ctx, input }) => {
      await assertCanViewSensitive(ctx, input.employeeId);
      const day = input.date
        ? startOfDayUTC(input.date)
        : startOfDayUTC(new Date());
      const next = new Date(day);
      next.setUTCDate(next.getUTCDate() + 1);

      return ctx.prisma.locationPing.findMany({
        where: {
          employeeId: input.employeeId,
          capturedAt: { gte: day, lt: next },
        },
        orderBy: { capturedAt: "desc" },
        take: input.limit,
      });
    }),

  allLocationPings: protectedProcedure
    .input(
      z.object({
        date: z.coerce.date().optional(),
        employeeId: z.string().optional(),
        limit: z.number().int().min(1).max(200).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const role = (ctx.session!.user.role ?? "EMPLOYEE") as Role;
      if (!canViewTeamAttendance(role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to view team location tracking.",
        });
      }

      const day = input.date
        ? startOfDayUTC(input.date)
        : startOfDayUTC(new Date());
      const next = new Date(day);
      next.setUTCDate(next.getUTCDate() + 1);

      return ctx.prisma.locationPing.findMany({
        where: {
          employeeId: input.employeeId || undefined,
          capturedAt: { gte: day, lt: next },
          ...(role === "MANAGER"
            ? { employee: { managerId: resolveEmployeeId(ctx) } }
            : {}),
        },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeCode: true,
              department: { select: { name: true } },
              designation: { select: { title: true } },
            },
          },
        },
        orderBy: { capturedAt: "desc" },
        take: input.limit,
      });
    }),

  livePersonnelOverview: protectedProcedure
    .input(z.object({ date: z.coerce.date().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const role = (ctx.session!.user.role ?? "EMPLOYEE") as Role;
      if (!canViewTeamAttendance(role)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Forbidden" });
      }
      const day = input?.date ? startOfDayUTC(input.date) : startOfDayUTC(new Date());
      const next = new Date(day);
      next.setUTCDate(next.getUTCDate() + 1);

      const employees = await ctx.prisma.employee.findMany({
        where: {
          status: "ACTIVE",
          ...(role === "MANAGER" ? { managerId: resolveEmployeeId(ctx) } : {}),
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeCode: true,
          email: true,
          role: true,
          workLocationName: true,
          workLocationLat: true,
          workLocationLng: true,
          assignedLocations: true,
          department: { select: { name: true } },
          designation: { select: { title: true } },
        },
        orderBy: { firstName: "asc" },
      });

      const empIds = employees.map((e) => e.id);

      const [todayLogs, latestPings] = await Promise.all([
        empIds.length === 0
          ? Promise.resolve([])
          : ctx.prisma.attendanceLog.findMany({
              where: { date: day, employeeId: { in: empIds } },
              select: {
                id: true,
                date: true,
                employeeId: true,
                status: true,
                checkInTime: true,
                checkInLat: true,
                checkInLng: true,
                checkInAddress: true,
                checkOutTime: true,
                checkOutLat: true,
                checkOutLng: true,
                checkOutAddress: true,
                withinGeofence: true,
              },
            }),
        empIds.length === 0
          ? Promise.resolve([])
          : ctx.prisma.locationPing.findMany({
              where: {
                employeeId: { in: empIds },
                capturedAt: { gte: day, lt: next },
              },
              orderBy: { capturedAt: "desc" },
              distinct: ["employeeId"],
              select: {
                id: true,
                employeeId: true,
                lat: true,
                lng: true,
                address: true,
                capturedAt: true,
                withinGeofence: true,
                accuracyM: true,
              },
            }),
      ]);

      const logMap = new Map(todayLogs.map((l) => [l.employeeId, l]));
      const pingMap = new Map(latestPings.map((p) => [p.employeeId, p]));

      return employees.map((emp) => {
        const log = logMap.get(emp.id) || null;
        let ping = pingMap.get(emp.id) || null;

        if (!ping && log?.checkInTime && log.checkInLat != null && log.checkInLng != null) {
          ping = {
            id: `checkin-${log.employeeId}`,
            employeeId: log.employeeId,
            lat: log.checkInLat,
            lng: log.checkInLng,
            address: log.checkInAddress,
            capturedAt: log.checkInTime,
            withinGeofence: log.withinGeofence,
            accuracyM: null,
          };
        }
        return {
          employee: emp,
          todayAttendance: log,
          latestPing: ping,
        };
      });
    }),

  /**
   * Report that employee disabled GPS location services / denied permission.
   * Sends immediate alert email to HR Admin and Manager.
   */
  reportLocationDisabled: protectedProcedure
    .input(
      z.object({
        reason: z.string().nullable().optional(),
        deviceInfo: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const employeeId = resolveEmployeeId(ctx);
      enforceEmployeeAndIpRateLimit("location-off", employeeId, ctx.ip);

      const emp = await ctx.prisma.employee.findUnique({
        where: { id: employeeId },
        select: {
          firstName: true,
          lastName: true,
          employeeCode: true,
          email: true,
          department: { select: { name: true } },
          manager: { select: { email: true } },
        },
      });

      if (!emp) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Employee not found" });
      }

      scheduleAfterResponse(ctx, async () => {
        try {
          const { notifyLocationDisabledAlert } = await import("../lib/email");
          await notifyLocationDisabledAlert({
            employeeName: `${emp.firstName} ${emp.lastName}`,
            employeeEmail: emp.email,
            employeeCode: emp.employeeCode,
            departmentName: emp.department?.name,
            attemptTime: new Date(),
            reason: input.reason || "Device GPS Location Disabled / Permission Denied",
            deviceInfo: input.deviceInfo || null,
            managerEmail: emp.manager?.email,
          });
        } catch (err) {
          console.error(
            "[attendance.reportLocationDisabled] email send error:",
            err instanceof Error ? err.name : "Unknown error"
          );
        }
      });

      return { success: true, notified: true };
    }),

  /** Bulk import of past attendance (last 6 months) from an Excel sheet */
  importExcel: hrAdminProcedure
    .input(
      z.object({
        rows: z
          .array(
            z.object({
              employeeCode: z.string().optional(),
              email: z.string().optional(),
              date: z.string().optional(),
              checkIn: z.string().optional(),
              checkOut: z.string().optional(),
              status: z.string().optional(),
            })
          )
          .max(20000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const STATUSES = ["PRESENT", "LATE", "HALF_DAY", "ABSENT", "ON_LEAVE", "HOLIDAY"] as const;
      const today = startOfDayUTC();
      const minDate = new Date(today);
      minDate.setUTCMonth(minDate.getUTCMonth() - 6);

      const employees = await ctx.prisma.employee.findMany({
        select: { id: true, employeeCode: true, email: true },
      });
      const byCode = new Map(employees.map((e) => [e.employeeCode.toUpperCase(), e.id]));
      const byEmail = new Map(employees.map((e) => [e.email.toLowerCase(), e.id]));

      let imported = 0;
      const errors: { row: number; message: string }[] = [];
      const records: {
        employeeId: string;
        date: Date;
        checkInTime: Date | null;
        checkOutTime: Date | null;
        status: (typeof STATUSES)[number];
        totalHours: number | null;
      }[] = [];

      for (const [i, row] of input.rows.entries()) {
        const rowNo = i + 2;
        const employeeId =
          byCode.get(row.employeeCode?.trim().toUpperCase() ?? "") ??
          byEmail.get(row.email?.trim().toLowerCase() ?? "");
        if (!employeeId) {
          errors.push({ row: rowNo, message: "Employee not found (check Employee Code / Email)" });
          continue;
        }

        const isoDate = parseExcelDate(row.date);
        if (!isoDate) {
          errors.push({ row: rowNo, message: `Invalid Date "${row.date ?? ""}"` });
          continue;
        }
        const date = startOfDayUTC(isoDate);
        if (date < minDate || date > today) {
          errors.push({ row: rowNo, message: `Date ${isoDate} is not within the last 6 months` });
          continue;
        }

        const inTime = parseExcelTime(row.checkIn);
        const outTime = parseExcelTime(row.checkOut);
        const checkInTime = inTime ? istDateTime(isoDate, inTime) : null;
        const checkOutTime = outTime ? istDateTime(isoDate, outTime) : null;
        if (checkInTime && checkOutTime && checkOutTime <= checkInTime) {
          errors.push({ row: rowNo, message: "Check Out must be after Check In" });
          continue;
        }

        const statusRaw = row.status?.trim().toUpperCase().replace(/\s+/g, "_");
        if (statusRaw && !STATUSES.includes(statusRaw as (typeof STATUSES)[number])) {
          errors.push({ row: rowNo, message: `Invalid Status "${row.status}"` });
          continue;
        }
        const status =
          (statusRaw as (typeof STATUSES)[number] | undefined) ??
          (checkInTime ? attendanceStatusFromCheckIn(checkInTime) : "ABSENT");

        records.push({
          employeeId,
          date,
          checkInTime,
          checkOutTime,
          status,
          totalHours:
            checkInTime && checkOutTime
              ? Math.round(((checkOutTime.getTime() - checkInTime.getTime()) / 3600000) * 100) / 100
              : null,
        });
      }

      for (let i = 0; i < records.length; i += 100) {
        const batch = records.slice(i, i + 100);
        await ctx.prisma.$transaction(
          batch.map((r) =>
            ctx.prisma.attendanceLog.upsert({
              where: { employeeId_date: { employeeId: r.employeeId, date: r.date } },
              create: r,
              update: {
                checkInTime: r.checkInTime,
                checkOutTime: r.checkOutTime,
                status: r.status,
                totalHours: r.totalHours,
              },
            })
          )
        );
        imported += batch.length;
      }

      return { imported, errors };
    }),

  /**
   * Complete daily location and timestamp breadcrumb trace for an employee.
   * Bundles check-in, check-out, interval pings, and assigned site for full map replay.
   */
  employeeDailyMapTrace: protectedProcedure
    .input(
      z.object({
        employeeId: z.string(),
        date: z.coerce.date().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await assertCanViewSensitive(ctx, input.employeeId);

      const day = input.date ? startOfDayUTC(input.date) : startOfDayUTC(new Date());
      const next = new Date(day);
      next.setUTCDate(next.getUTCDate() + 1);

      const [emp, settings, log] = await Promise.all([
        ctx.prisma.employee.findUnique({
          where: { id: input.employeeId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            email: true,
            workLocationName: true,
            workLocationLat: true,
            workLocationLng: true,
            assignedLocations: true,
            department: { select: { name: true } },
            designation: { select: { title: true } },
          },
        }),
        ctx.prisma.companySettings.findUnique({
          where: { id: "singleton" },
        }),
        ctx.prisma.attendanceLog.findUnique({
          where: {
            employeeId_date: {
              employeeId: input.employeeId,
              date: day,
            },
          },
        }),
      ]);

      if (!emp) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Employee not found" });
      }

      const pings = await ctx.prisma.locationPing.findMany({
        where: {
          employeeId: input.employeeId,
          capturedAt: { gte: day, lt: next },
        },
        orderBy: { capturedAt: "asc" },
      });

      type TraceEvent = {
        id: string;
        type: "CHECK_IN" | "PING" | "CHECK_OUT";
        time: Date;
        lat: number;
        lng: number;
        address: string;
        withinGeofence: boolean;
        notes?: string | null;
      };

      const events: TraceEvent[] = [];

      if (log?.checkInTime && log.checkInLat != null && log.checkInLng != null) {
        events.push({
          id: `in-${log.id}`,
          type: "CHECK_IN",
          time: log.checkInTime,
          lat: log.checkInLat,
          lng: log.checkInLng,
          address: log.checkInAddress || `${log.checkInLat.toFixed(5)}, ${log.checkInLng.toFixed(5)}`,
          withinGeofence: log.withinGeofence,
          notes: log.notes,
        });
      }

      for (const p of pings) {
        events.push({
          id: `ping-${p.id}`,
          type: "PING",
          time: p.capturedAt,
          lat: p.lat,
          lng: p.lng,
          address: p.address || `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`,
          withinGeofence: p.withinGeofence,
        });
      }

      if (log?.checkOutTime && log.checkOutLat != null && log.checkOutLng != null) {
        events.push({
          id: `out-${log.id}`,
          type: "CHECK_OUT",
          time: log.checkOutTime,
          lat: log.checkOutLat,
          lng: log.checkOutLng,
          address: log.checkOutAddress || `${log.checkOutLat.toFixed(5)}, ${log.checkOutLng.toFixed(5)}`,
          withinGeofence: log.withinGeofence,
          notes: log.notes,
        });
      }

      events.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

      return {
        employee: emp,
        settings,
        log,
        events,
      };
    }),
});
