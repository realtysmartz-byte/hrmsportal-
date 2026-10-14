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
import {
  getEffectiveWorkLocation,
  distanceToWorkLocationM,
} from "../lib/work-location";

/** Reject pings whose GPS fix is older than this or stamped in the future. */
const MAX_PING_AGE_MS = 10 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 2 * 60 * 1000;

function attendanceStatusFromCheckIn(
  checkInTime: Date
): "LATE" | "PRESENT" {
  const ist = getISTDateParts(checkInTime);
  return ist.hour > LATE_CHECK_IN_HOUR || (ist.hour === LATE_CHECK_IN_HOUR && ist.minute > 0)
    ? "LATE"
    : "PRESENT";
}

async function resolveEmployeeId(ctx: Context) {
  const byId = await ctx.prisma.employee.findUnique({
    where: { id: ctx.session!.user.id },
    select: { id: true },
  });
  if (byId) return byId.id;

  const email = ctx.session!.user.email?.toLowerCase();
  if (email) {
    const byEmail = await ctx.prisma.employee.findUnique({
      where: { email },
      select: { id: true },
    });
    if (byEmail) return byEmail.id;
  }

  throw new TRPCError({
    code: "UNAUTHORIZED",
    message:
      "Your session is out of date (database was reseeded). Sign out and sign in again, then retry.",
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
    const employeeId = await resolveEmployeeId(ctx);
    await ensureAutoPunchOut(ctx.prisma, employeeId);
    const today = startOfDayUTC(new Date());
    return ctx.prisma.attendanceLog.findUnique({
      where: {
        employeeId_date: { employeeId, date: today },
      },
    });
  }),

  /** The location the current employee must punch in from (assigned site, else office). */
  myWorkLocation: protectedProcedure.query(async ({ ctx }) => {
    const employeeId = await resolveEmployeeId(ctx);
    return getEffectiveWorkLocation(ctx.prisma, employeeId);
  }),

  /**
   * Returns past 7 days (1 week) attendance history for current logged-in employee.
   * Auto-punches out past 7:00 PM and gives complete punch-in/out and shift breakdown.
   */
  myRecentWeek: protectedProcedure.query(async ({ ctx }) => {
    const employeeId = await resolveEmployeeId(ctx);
    await ensureAutoPunchOut(ctx.prisma, employeeId);

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

    const logMap = new Map(
      logs.map((l) => [l.date.toISOString().slice(0, 10), l])
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
      const employeeId = await resolveEmployeeId(ctx);
      await ensureAutoPunchOut(ctx.prisma, employeeId);
      const start = new Date(Date.UTC(input.year, input.month - 1, 1));
      const end = new Date(Date.UTC(input.year, input.month, 0));

      const logs = await ctx.prisma.attendanceLog.findMany({
        where: {
          employeeId,
          date: { gte: start, lte: end },
        },
        orderBy: { date: "asc" },
      });

      return { logs, summary: summarizeLogs(logs) };
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

      return { logs, summary: summarizeLogs(logs) };
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

      return {
        logs,
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
      const employeeId = await resolveEmployeeId(ctx);
      const workLocation = await getEffectiveWorkLocation(ctx.prisma, employeeId);

      const today = startOfDayUTC(new Date());
      const existing = await ctx.prisma.attendanceLog.findUnique({
        where: {
          employeeId_date: { employeeId, date: today },
        },
      });

      // Block only if employee is CURRENTLY punched in (active on duty without checkout)
      if (existing?.checkInTime && !existing.checkOutTime) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You are already punched in. Please punch out first before punching in again.",
        });
      }
      if (existing?.status === "ON_LEAVE") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You are marked ON_LEAVE for today",
        });
      }

      const distanceM = distanceToWorkLocationM(workLocation, input.lat, input.lng);
      const withinGeofence = distanceM <= workLocation.radiusM;

      if (!withinGeofence) {
        const where =
          workLocation.source === "ASSIGNED"
            ? `your assigned site (${workLocation.name})`
            : `the office (${workLocation.name})`;
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Punch-in blocked: you are ~${Math.round(distanceM)}m from ${where}. You must be within ${workLocation.radiusM}m to punch in.`,
        });
      }

      const now = new Date();
      // On initial punch of the day calculate late status; on re-punch keep existing status
      const status = existing?.status || attendanceStatusFromCheckIn(now);

      const finalAddress = workLocation.name;
      let logNotes: string | null =
        workLocation.source === "ASSIGNED"
          ? `Site punch-in: ${workLocation.name}`
          : "Office punch-in";

      if (existing?.checkOutTime) {
        const reNote = `Re-punch in at ${formatTimeIST(now)}`;
        logNotes = existing.notes ? `${existing.notes} · ${reNote}` : reNote;
      }

      const locationData = {
        checkInTime: now,
        checkInLat: input.lat,
        checkInLng: input.lng,
        checkInAddress: finalAddress,
        checkOutTime: null,
        checkOutLat: null,
        checkOutLng: null,
        checkOutAddress: null,
        withinGeofence,
        status,
        notes: logNotes,
      };

      const log = existing
        ? await ctx.prisma.attendanceLog.update({
            where: { id: existing.id },
            data: locationData,
          })
        : await ctx.prisma.attendanceLog.create({
            data: {
              employeeId,
              date: today,
              ...locationData,
            },
          });

      try {
        await ctx.prisma.locationPing.create({
          data: {
            employeeId,
            lat: input.lat,
            lng: input.lng,
            address: finalAddress,
            accuracyM: null,
            withinGeofence,
            capturedAt: now,
          },
        });
      } catch (pingErr) {
        console.error("[attendance.checkIn] failed to record initial location ping:", pingErr);
      }

      // Non-blocking background tasks: Send emails & sync Google Sheets without slowing down punch-in
      void (async () => {
        // 1. Send punching details & policy emails
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

            // Always send punching details email to employee (and manager/HR if late)
            await notifyPunchDetails({
              employeeName: name,
              employeeEmail: emp.email,
              employeeCode: emp.employeeCode,
              checkInTime: now,
              status,
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
          console.error("[attendance.checkIn] email notify failed:", err);
        }

        // 2. Real-time Google Sheet sync
        try {
          const { getActiveGoogleSheetConfig, setLastSyncMetadata } = await import(
            "./googleSheets"
          );
          const { generateDailyAttendanceData, syncReportToGoogleSheet } = await import(
            "../lib/google-sheets"
          );
          const sheetConfig = getActiveGoogleSheetConfig();
          if (sheetConfig.webhookUrl || sheetConfig.spreadsheetId) {
            const reportData = await generateDailyAttendanceData(ctx.prisma, today);
            const res = await syncReportToGoogleSheet(sheetConfig, reportData);
            setLastSyncMetadata({
              date: reportData.dateStr,
              sheetTitle: res.sheetTitle,
              rowCount: res.rowCount,
              syncedAt: new Date().toISOString(),
            });
            console.info("[attendance.checkIn] Background Google Sheet sync succeeded:", res.sheetTitle);
          }
        } catch (err) {
          console.error("[attendance.checkIn] Background Google Sheet sync error:", err);
        }
      })();

      return log;
    }),

  checkOut: protectedProcedure
    .input(checkInOutSchema)
    .mutation(async ({ ctx, input }) => {
      const employeeId = await resolveEmployeeId(ctx);
      const today = startOfDayUTC(new Date());
      const existing = await ctx.prisma.attendanceLog.findUnique({
        where: {
          employeeId_date: { employeeId, date: today },
        },
      });

      if (!existing?.checkInTime) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Check in first before checking out",
        });
      }
      if (existing.checkOutTime) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You are currently punched out. Please punch in first before checking out again.",
        });
      }

      const now = new Date();
      const sessionHours =
        (now.getTime() - existing.checkInTime.getTime()) / (1000 * 60 * 60);
      const cumulativeHours = (existing.totalHours || 0) + sessionHours;

      let status = existing.status;
      if (cumulativeHours < 4 && status !== "ON_LEAVE") {
        status = "HALF_DAY";
      } else if (cumulativeHours >= 8 && status === "HALF_DAY") {
        status = "PRESENT";
      }

      const roundedHours = Math.round(cumulativeHours * 100) / 100;

      const [workLocation, emp] = await Promise.all([
        getEffectiveWorkLocation(ctx.prisma, employeeId),
        ctx.prisma.employee.findUnique({
          where: { id: employeeId },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            manager: { select: { email: true } },
          },
        }),
      ]);

      const outWithinGeofence =
        distanceToWorkLocationM(workLocation, input.lat, input.lng) <= workLocation.radiusM;
      const finalOutAddress = outWithinGeofence ? workLocation.name : input.address;

      const outNote = `Punch out at ${formatTimeIST(now)}`;
      const logNotes = existing.notes
        ? `${existing.notes} · ${outNote}`
        : outNote;

      const updated = await ctx.prisma.attendanceLog.update({
        where: { id: existing.id },
        data: {
          checkOutTime: now,
          checkOutLat: input.lat,
          checkOutLng: input.lng,
          checkOutAddress: finalOutAddress,
          totalHours: roundedHours,
          status,
          notes: logNotes,
        },
      });

      try {
        await ctx.prisma.locationPing.create({
          data: {
            employeeId,
            lat: input.lat,
            lng: input.lng,
            address: finalOutAddress,
            accuracyM: null,
            withinGeofence: outWithinGeofence,
            capturedAt: now,
          },
        });
      } catch (pingErr) {
        console.error("[attendance.checkOut] failed to record checkout location ping:", pingErr);
      }

      // Non-blocking background tasks: Send emails & sync Google Sheets without slowing down punch-out
      void (async () => {
        // 1. Check-out email notification
        try {
          const { notifyCheckOutDetails } = await import("../lib/email");
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
            });
          }
        } catch (err) {
          console.error("[attendance.checkOut] email notify failed:", err);
        }

        // 2. Real-time Google Sheet sync on checkout
        try {
          const { getActiveGoogleSheetConfig, setLastSyncMetadata } = await import(
            "./googleSheets"
          );
          const { generateDailyAttendanceData, syncReportToGoogleSheet } = await import(
            "../lib/google-sheets"
          );
          const sheetConfig = getActiveGoogleSheetConfig();
          if (sheetConfig.webhookUrl || sheetConfig.spreadsheetId) {
            const reportData = await generateDailyAttendanceData(ctx.prisma, today);
            const res = await syncReportToGoogleSheet(sheetConfig, reportData);
            setLastSyncMetadata({
              date: reportData.dateStr,
              sheetTitle: res.sheetTitle,
              rowCount: res.rowCount,
              syncedAt: new Date().toISOString(),
            });
            console.info("[attendance.checkOut] Background Google Sheet sync succeeded:", res.sheetTitle);
          }
        } catch (err) {
          console.error("[attendance.checkOut] Background Google Sheet sync error:", err);
        }
      })();

      return updated;
    }),

  team: protectedProcedure
    .input(teamAttendanceSchema)
    .query(async ({ ctx, input }) => {
      const role = ctx.session.user.role as Role;
      if (!canViewTeamAttendance(role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await ensureAutoPunchOut(ctx.prisma);

      const isRange = Boolean(input.startDate && input.endDate);
      const targetDate = startOfDayUTC(input.date ?? new Date());
      const employeeWhere: Record<string, unknown> = {
        status: { in: ["ACTIVE", "ON_LEAVE"] },
      };

      if (role === "MANAGER") {
        employeeWhere.managerId = await resolveEmployeeId(ctx);
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

        const empMap = new Map(employees.map((e) => [e.id, e]));
        const rows = logs
          .map((log) => {
            const employee = empMap.get(log.employeeId);
            if (!employee) return null;
            return {
              employee,
              log,
            };
          })
          .filter((r): r is { employee: (typeof employees)[number]; log: (typeof logs)[number] } => Boolean(r));

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

      const logByEmployee = new Map(logs.map((l) => [l.employeeId, l]));

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

      await ensureAutoPunchOut(ctx.prisma);

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
        employeeWhere.managerId = await resolveEmployeeId(ctx);
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
        entries,
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
      const employeeId = await resolveEmployeeId(ctx);

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
      if (duplicate) return duplicate;

      const workLocation = await getEffectiveWorkLocation(ctx.prisma, employeeId);
      const withinGeofence =
        distanceToWorkLocationM(workLocation, input.lat, input.lng) <= workLocation.radiusM;

      return ctx.prisma.locationPing.create({
        data: {
          employeeId,
          lat: input.lat,
          lng: input.lng,
          address: withinGeofence ? workLocation.name : input.address || null,
          accuracyM: input.accuracyM ?? null,
          withinGeofence,
          capturedAt: input.capturedAt,
        },
      });
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
      const employeeId = await resolveEmployeeId(ctx);
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
      const employeeId = await resolveEmployeeId(ctx);
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
            ? { employee: { managerId: await resolveEmployeeId(ctx) } }
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

      const [employees, todayLogs] = await Promise.all([
        ctx.prisma.employee.findMany({
          where: {
            status: "ACTIVE",
            ...(role === "MANAGER" ? { managerId: await resolveEmployeeId(ctx) } : {}),
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
            department: { select: { name: true } },
            designation: { select: { title: true } },
          },
          orderBy: { firstName: "asc" },
        }),
        ctx.prisma.attendanceLog.findMany({
          where: { date: day },
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
      ]);

      const latestPings = await ctx.prisma.locationPing.findMany({
        where: { capturedAt: { gte: day, lt: next } },
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
      });

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
      const employeeId = await resolveEmployeeId(ctx);
      const emp = await ctx.prisma.employee.findUnique({
        where: { id: employeeId },
        select: {
          id: true,
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
        console.error("[attendance.reportLocationDisabled] email send error:", err);
      }

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
