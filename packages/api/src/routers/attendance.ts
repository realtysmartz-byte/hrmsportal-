import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  checkInOutSchema,
  myAttendanceMonthSchema,
  teamAttendanceSchema,
  employeeAttendanceSchema,
  employeeAttendanceHistorySchema,
  locationPingSchema,
  haversineDistanceM,
  startOfDayUTC,
  getISTDateParts,
  isWeeklyOffDay,
  LATE_CHECK_IN_HOUR,
  canViewTeamAttendance,
  isWorkingDay,
} from "@realty-smartz/shared";
import type { Role } from "@realty-smartz/shared";
import type { Context } from "../context";
import { protectedProcedure, router } from "../trpc";
import { assertCanViewSensitive } from "../lib/employee-access";
import { ensureAutoPunchOut } from "../lib/attendance-auto";

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
              checkInAddress: log.checkInAddress
                ? log.checkInAddress.replace(/sunbreeze/gi, "Realty Smartz Private Limited")
                : log.checkInAddress,
              checkOutAddress: log.checkOutAddress
                ? log.checkOutAddress.replace(/sunbreeze/gi, "Realty Smartz Private Limited")
                : log.checkOutAddress,
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
      const settings = await ctx.prisma.companySettings.findUnique({
        where: { id: "singleton" },
      });
      if (!settings) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Company office location is not configured",
        });
      }

      const today = startOfDayUTC(new Date());
      const existing = await ctx.prisma.attendanceLog.findUnique({
        where: {
          employeeId_date: { employeeId, date: today },
        },
      });

      if (existing?.checkInTime) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Already checked in today",
        });
      }
      if (existing?.status === "ON_LEAVE") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You are marked ON_LEAVE for today",
        });
      }

      const emp = await ctx.prisma.employee.findUnique({
        where: { id: employeeId },
        select: {
          id: true,
          role: true,
          firstName: true,
          lastName: true,
          employeeCode: true,
          email: true,
          workLocationLat: true,
          workLocationLng: true,
          workLocationName: true,
          manager: { select: { email: true } },
        },
      });

      const distanceOfficeM = haversineDistanceM(
        input.lat,
        input.lng,
        settings.officeLat,
        settings.officeLng
      );
      const isAtOffice = distanceOfficeM <= settings.geofenceRadiusM;

      let isAtAllocatedSite = false;
      let distanceSiteM: number | null = null;
      if (emp?.workLocationLat != null && emp?.workLocationLng != null) {
        distanceSiteM = haversineDistanceM(
          input.lat,
          input.lng,
          emp.workLocationLat,
          emp.workLocationLng
        );
        isAtAllocatedSite = distanceSiteM <= settings.geofenceRadiusM;
      }

      const withinGeofence = isAtOffice || isAtAllocatedSite;

      // STRICT 200-METER GEOFENCE ENFORCEMENT:
      // Employee must be within 200m of office or their allocated site, otherwise check-in is blocked.
      if (!withinGeofence && emp?.role !== "ADMIN") {
        if (emp?.workLocationLat != null && emp?.workLocationLng != null) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Punch-in blocked: You are outside the 200-meter geofence perimeter. Office distance: ~${Math.round(distanceOfficeM)}m, Allocated site (${emp.workLocationName || "Site"}) distance: ~${Math.round(distanceSiteM!)}m. You must be within 200m to punch in.`,
          });
        } else {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Punch-in blocked: You are outside the 200-meter geofence of ${settings.officeName || "REALTY SMARTZ PVT LTD"} (~${Math.round(distanceOfficeM)}m away). If you are on field duty, please ask Admin to allocate your site location.`,
          });
        }
      }

      const now = new Date();
      const status = attendanceStatusFromCheckIn(now);

      let finalAddress = input.address;
      let logNotes: string | null = null;

      if (isAtOffice) {
        finalAddress = settings.officeName || "REALTY SMARTZ PVT LTD";
        logNotes = "Office login (within 200m perimeter)";
      } else if (isAtAllocatedSite) {
        finalAddress = emp?.workLocationName || "Allocated Site Location";
        logNotes = `Site login: ${emp?.workLocationName || "Site"} (within 200m perimeter)`;
      } else {
        // Admin override when outside 200m
        finalAddress = input.address
          ? input.address.replace(/sunbreeze/gi, "REALTY SMARTZ PVT LTD")
          : (settings.officeName || "REALTY SMARTZ PVT LTD");
        logNotes = `Admin override (~${Math.round(distanceOfficeM)}m from office)`;
      }

      const locationData = {
        checkInTime: now,
        checkInLat: input.lat,
        checkInLng: input.lng,
        checkInAddress: finalAddress,
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

      // 2. Real-time Google Sheet sync (awaited so serverless execution context does not freeze prematurely)
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
          console.info("[attendance.checkIn] Real-time Google Sheet sync succeeded:", res.sheetTitle);
        }
      } catch (err) {
        console.error("[attendance.checkIn] Real-time Google Sheet sync error:", err);
      }

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
          message: "Already checked out today",
        });
      }

      const now = new Date();
      const totalHours =
        (now.getTime() - existing.checkInTime.getTime()) / (1000 * 60 * 60);

      let status = existing.status;
      if (totalHours < 4 && status !== "ON_LEAVE") {
        status = "HALF_DAY";
      }

      const roundedHours = Math.round(totalHours * 100) / 100;

      const settings = await ctx.prisma.companySettings.findUnique({
        where: { id: "singleton" },
      });

      let finalOutAddress = input.address;
      if (existing.withinGeofence && settings?.officeName) {
        finalOutAddress = settings.officeName;
      } else if (finalOutAddress) {
        finalOutAddress = finalOutAddress.replace(/sunbreeze/gi, "Realty Smartz Private Limited");
      } else {
        finalOutAddress = "Realty Smartz Private Limited";
      }

      const updated = await ctx.prisma.attendanceLog.update({
        where: { id: existing.id },
        data: {
          checkOutTime: now,
          checkOutLat: input.lat,
          checkOutLng: input.lng,
          checkOutAddress: finalOutAddress,
          totalHours: roundedHours,
          status,
        },
      });

      // 1. Check-out email notification
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
          });
        }
      } catch (err) {
        console.error("[attendance.checkOut] email notify failed:", err);
      }

      // 2. Real-time Google Sheet sync on checkout (awaited so serverless execution context does not freeze prematurely)
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
          console.info("[attendance.checkOut] Real-time Google Sheet sync succeeded:", res.sheetTitle);
        }
      } catch (err) {
        console.error("[attendance.checkOut] Real-time Google Sheet sync error:", err);
      }

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
        },
        orderBy: { firstName: "asc" },
      });

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

      return { date: targetDate, rows };
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

      const sanitizedEntries = entries.map((entry) => ({
        ...entry,
        checkInAddress: entry.checkInAddress
          ? entry.checkInAddress.replace(/sunbreeze/gi, "Realty Smartz Private Limited")
          : entry.checkInAddress,
        checkOutAddress: entry.checkOutAddress
          ? entry.checkOutAddress.replace(/sunbreeze/gi, "Realty Smartz Private Limited")
          : entry.checkOutAddress,
      }));

      return {
        entries: sanitizedEntries,
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
      const [settings, emp] = await Promise.all([
        ctx.prisma.companySettings.findUnique({
          where: { id: "singleton" },
        }),
        ctx.prisma.employee.findUnique({
          where: { id: employeeId },
          select: {
            workLocationLat: true,
            workLocationLng: true,
            workLocationName: true,
          },
        }),
      ]);

      let isAtOffice = false;
      let isAtAllocatedSite = false;
      if (settings) {
        const distanceOfficeM = haversineDistanceM(
          input.lat,
          input.lng,
          settings.officeLat,
          settings.officeLng
        );
        isAtOffice = distanceOfficeM <= settings.geofenceRadiusM;
        if (emp?.workLocationLat != null && emp?.workLocationLng != null) {
          const distanceSiteM = haversineDistanceM(
            input.lat,
            input.lng,
            emp.workLocationLat,
            emp.workLocationLng
          );
          isAtAllocatedSite = distanceSiteM <= settings.geofenceRadiusM;
        }
      }

      const withinGeofence = isAtOffice || isAtAllocatedSite;

      let cleanAddress = input.address || null;
      if (isAtOffice && settings?.officeName) {
        cleanAddress = settings.officeName;
      } else if (isAtAllocatedSite && emp?.workLocationName) {
        cleanAddress = emp.workLocationName;
      } else if (cleanAddress) {
        cleanAddress = cleanAddress.replace(/sunbreeze/gi, "REALTY SMARTZ PVT LTD");
      }

      return ctx.prisma.locationPing.create({
        data: {
          employeeId,
          lat: input.lat,
          lng: input.lng,
          address: cleanAddress,
          accuracyM: input.accuracyM ?? null,
          withinGeofence,
        },
      });
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

      const [employees, todayLogs, latestPings] = await Promise.all([
        ctx.prisma.employee.findMany({
          where: { status: "ACTIVE" },
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
        ctx.prisma.locationPing.findMany({
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
        }),
      ]);

      const logMap = new Map(todayLogs.map((l) => [l.employeeId, l]));
      const pingMap = new Map(latestPings.map((p) => [p.employeeId, p]));

      return employees.map((emp) => {
        const log = logMap.get(emp.id) || null;
        const ping = pingMap.get(emp.id) || null;
        return {
          employee: emp,
          todayAttendance: log,
          latestPing: ping,
        };
      });
    }),
});
