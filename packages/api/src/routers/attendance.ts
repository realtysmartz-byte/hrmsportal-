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
  LATE_CHECK_IN_HOUR,
  canViewTeamAttendance,
  isWorkingDay,
} from "@realty-smartz/shared";
import type { Role } from "@realty-smartz/shared";
import type { Context } from "../context";
import { protectedProcedure, router } from "../trpc";
import { assertCanViewSensitive } from "../lib/employee-access";

function attendanceStatusFromCheckIn(
  checkInTime: Date
): "LATE" | "PRESENT" {
  return checkInTime.getHours() >= LATE_CHECK_IN_HOUR ? "LATE" : "PRESENT";
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
        return (
          sum +
          (t.getHours() * 3600 + t.getMinutes() * 60 + t.getSeconds()) * 1000
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
    const today = startOfDayUTC(new Date());
    return ctx.prisma.attendanceLog.findUnique({
      where: {
        employeeId_date: { employeeId, date: today },
      },
    });
  }),

  myMonth: protectedProcedure
    .input(myAttendanceMonthSchema)
    .query(async ({ ctx, input }) => {
      const employeeId = await resolveEmployeeId(ctx);
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

      const distanceM = haversineDistanceM(
        input.lat,
        input.lng,
        settings.officeLat,
        settings.officeLng
      );
      const withinGeofence = distanceM <= settings.geofenceRadiusM;
      const now = new Date();
      const status = attendanceStatusFromCheckIn(now);

      const locationData = {
        checkInTime: now,
        checkInLat: input.lat,
        checkInLng: input.lng,
        checkInAddress: input.address,
        withinGeofence,
        status,
        notes: withinGeofence
          ? null
          : `Outside geofence (~${Math.round(distanceM)}m from office)`,
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

      // Fire-and-forget policy emails
      void (async () => {
        try {
          const { notifyLatePunch, notifyOutsideGeofence } = await import(
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
          if (!emp) return;
          const name = `${emp.firstName} ${emp.lastName}`;
          if (status === "LATE") {
            await notifyLatePunch({
              employeeName: name,
              employeeEmail: emp.email,
              employeeCode: emp.employeeCode,
              checkInTime: now,
              address: input.address,
              withinGeofence,
              managerEmail: emp.manager?.email,
            });
          } else if (!withinGeofence) {
            await notifyOutsideGeofence({
              employeeName: name,
              employeeEmail: emp.email,
              employeeCode: emp.employeeCode,
              checkInTime: now,
              address: input.address,
              managerEmail: emp.manager?.email,
            });
          }
        } catch (err) {
          console.error("[attendance] email notify failed:", err);
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

      return ctx.prisma.attendanceLog.update({
        where: { id: existing.id },
        data: {
          checkOutTime: now,
          checkOutLat: input.lat,
          checkOutLng: input.lng,
          checkOutAddress: input.address,
          totalHours: Math.round(totalHours * 100) / 100,
          status,
        },
      });
    }),

  team: protectedProcedure
    .input(teamAttendanceSchema)
    .query(async ({ ctx, input }) => {
      const role = ctx.session.user.role as Role;
      if (!canViewTeamAttendance(role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

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

  locationPing: protectedProcedure
    .input(locationPingSchema)
    .mutation(async ({ ctx, input }) => {
      const employeeId = await resolveEmployeeId(ctx);
      const settings = await ctx.prisma.companySettings.findUnique({
        where: { id: "singleton" },
      });

      let withinGeofence = true;
      if (settings) {
        const distanceM = haversineDistanceM(
          input.lat,
          input.lng,
          settings.officeLat,
          settings.officeLng
        );
        withinGeofence = distanceM <= settings.geofenceRadiusM;
      }

      return ctx.prisma.locationPing.create({
        data: {
          employeeId,
          lat: input.lat,
          lng: input.lng,
          address: input.address || null,
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
});
