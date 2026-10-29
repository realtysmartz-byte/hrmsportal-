import { TRPCError } from "@trpc/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  employeeListFilterSchema,
  uploadEmployeeDocumentSchema,
  EMPLOYEE_CODE_PREFIX,
  canManageEmployees,
  canViewSensitiveEmployeeData,
  getEmployeeVisibilityLevel,
  isWorkingDay,
  EMPLOYEE_STATUSES,
  startOfDayUTC,
} from "@realty-smartz/shared";
import {
  type Role,
  type OrgChartNode,
  type EmployeeVisibilityLevel,
} from "@realty-smartz/shared";
import { hrAdminProcedure, protectedProcedure, router } from "../trpc";
import {
  assertCanViewSensitive,
  profileCompletionPercent,
  resolveActorId,
} from "../lib/employee-access";
import { parseExcelDate } from "../lib/excel-import";
import {
  invalidatePunchGeofenceCache,
  syncLegacyWorkLocation,
} from "../lib/work-location";

export type UpcomingBirthdayItem = {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  profilePhotoUrl: string | null;
  department: string | null;
  designation: string | null;
  birthdayDate: string;
  isToday: boolean;
  daysUntil: number;
};

let upcomingBirthdaysCache: { at: number; data: UpcomingBirthdayItem[] } | null = null;
const UPCOMING_BIRTHDAYS_TTL_MS = 10 * 60 * 1000;

const employeeInclude = {
  department: { select: { id: true, name: true } },
  designation: { select: { id: true, title: true } },
  manager: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeCode: true,
    },
  },
} as const;

async function nextEmployeeCode(
  prisma: {
    employee: {
      findMany: (args: {
        where: { employeeCode: { startsWith: string } };
        select: { employeeCode: true };
      }) => Promise<{ employeeCode: string }[]>;
    };
  }
) {
  // Only consider pure numeric codes (RS-0001, RS-3327). Codes like RS-CS3024
  // must not drive the sequence — string DESC was returning those and
  // falling back to RS-0001, which already exists.
  const rows = await prisma.employee.findMany({
    where: { employeeCode: { startsWith: EMPLOYEE_CODE_PREFIX } },
    select: { employeeCode: true },
  });

  let max = 0;
  const re = new RegExp(`^${EMPLOYEE_CODE_PREFIX}(\\d+)$`, "i");
  for (const row of rows) {
    const match = re.exec(row.employeeCode);
    if (match) {
      max = Math.max(max, parseInt(match[1], 10));
    }
  }

  const nextNum = max + 1;
  const width = Math.max(4, String(nextNum).length);
  return `${EMPLOYEE_CODE_PREFIX}${String(nextNum).padStart(width, "0")}`;
}

async function labelForJobField(
  prisma: {
    designation: {
      findUnique: (a: {
        where: { id: string };
        select: { title: true };
      }) => Promise<{ title: string } | null>;
    };
    department: {
      findUnique: (a: {
        where: { id: string };
        select: { name: true };
      }) => Promise<{ name: string } | null>;
    };
    employee: {
      findUnique: (a: {
        where: { id: string };
        select: { firstName: true; lastName: true; employeeCode: true };
      }) => Promise<{
        firstName: string;
        lastName: string;
        employeeCode: string;
      } | null>;
    };
  },
  field: string,
  value: string | null | undefined
) {
  if (!value) return null;
  if (field === "designationId") {
    const d = await prisma.designation.findUnique({
      where: { id: value },
      select: { title: true },
    });
    return d?.title ?? value;
  }
  if (field === "departmentId") {
    const d = await prisma.department.findUnique({
      where: { id: value },
      select: { name: true },
    });
    return d?.name ?? value;
  }
  if (field === "managerId") {
    const m = await prisma.employee.findUnique({
      where: { id: value },
      select: { firstName: true, lastName: true, employeeCode: true },
    });
    return m
      ? `${m.firstName} ${m.lastName} (${m.employeeCode})`
      : value;
  }
  return value;
}

function redactEmployeeSensitiveData<T extends Record<string, unknown>>(employee: T): T {
  return {
    ...employee,
    dateOfBirth: null,
    address: null,
    emergencyContactName: null,
    emergencyContactPhone: null,
    bloodGroup: null,
    gender: null,
  };
}

export const employeeRouter = router({
  list: protectedProcedure
    .input(employeeListFilterSchema)
    .query(async ({ ctx, input }) => {
      const { search, departmentId, status, page, pageSize } = input;
      const role = ctx.session.user.role as Role;
      const canManage = canManageEmployees(role);

      const where = {
        AND: [
          search
            ? {
                OR: [
                  { firstName: { contains: search, mode: "insensitive" as const } },
                  { lastName: { contains: search, mode: "insensitive" as const } },
                  { email: { contains: search, mode: "insensitive" as const } },
                  { employeeCode: { contains: search, mode: "insensitive" as const } },
                ],
              }
            : {},
          departmentId ? { departmentId } : {},
          status ? { status } : {},
        ],
      };

      const [items, total] = await Promise.all([
        ctx.prisma.employee.findMany({
          where,
          include: employeeInclude,
          orderBy: { employeeCode: "asc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        ctx.prisma.employee.count({ where }),
      ]);

      const safeItems = items.map(({ passwordHash: _, ...rest }) =>
        canManage ? rest : redactEmployeeSensitiveData(rest)
      );

      return {
        items: safeItems,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const actor = await resolveActorId(ctx);
      const employee = await ctx.prisma.employee.findUnique({
        where: { id: input.id },
        include: {
          ...employeeInclude,
          directReports: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeCode: true,
              profilePhotoUrl: true,
              designation: { select: { id: true, title: true } },
            },
          },
        },
      });

      if (!employee) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Employee not found" });
      }

      const visibility = getEmployeeVisibilityLevel(
        { id: actor.id, role: actor.role as Role },
        employee
      );
      const canViewSensitive = visibility === "FULL";
      const statusHistory = canManageEmployees(actor.role as Role)
        ? await ctx.prisma.employeeJobHistory.findFirst({
            where: {
              employeeId: employee.id,
              fieldChanged: "status",
              newValue: employee.status,
            },
            orderBy: { effectiveDate: "desc" },
            select: { effectiveDate: true },
          })
        : null;

      const { passwordHash: _, ...safe } = employee;
      const sanitized = canViewSensitive
        ? safe
        : redactEmployeeSensitiveData(safe);

      return {
        ...sanitized,
        statusEffectiveDate: statusHistory?.effectiveDate ?? null,
        profileCompletion: canViewSensitive ? profileCompletionPercent(employee) : 0,
        access: {
          canViewSensitive,
          visibilityLevel: visibility,
          canEdit:
            canManageEmployees(actor.role as Role) || actor.id === employee.id,
          canManage: canManageEmployees(actor.role as Role),
          isSelf: actor.id === employee.id,
          isManager: employee.managerId === actor.id,
        },
      };
    }),

  profileHub: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const actor = await resolveActorId(ctx);
      const employee = await ctx.prisma.employee.findUnique({
        where: { id: input.id },
        include: {
          ...employeeInclude,
          directReports: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeCode: true,
              profilePhotoUrl: true,
              designation: { select: { id: true, title: true } },
            },
          },
        },
      });

      if (!employee) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Employee not found" });
      }

      const visibility = getEmployeeVisibilityLevel(
        { id: actor.id, role: actor.role as Role },
        employee
      );
      const canViewSensitive = visibility === "FULL";

      const year = new Date().getFullYear();
      const now = new Date();
      const monthStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
      );
      const monthEnd = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)
      );

      const [
        jobHistory,
        recentAttendance,
        recentLeave,
        leaveBalances,
        monthLogs,
        statusHistory,
      ] =
        await Promise.all([
          canViewSensitive
            ? ctx.prisma.employeeJobHistory.findMany({
                where: { employeeId: employee.id },
                include: {
                  changedBy: {
                    select: { id: true, firstName: true, lastName: true },
                  },
                },
                orderBy: { effectiveDate: "desc" },
                take: 20,
              })
            : Promise.resolve([]),
          canViewSensitive
            ? ctx.prisma.attendanceLog.findMany({
                where: { employeeId: employee.id },
                orderBy: { date: "desc" },
                take: 5,
              })
            : Promise.resolve([]),
          canViewSensitive
            ? ctx.prisma.leaveRequest.findMany({
                where: { employeeId: employee.id },
                include: { leaveType: true },
                orderBy: { appliedAt: "desc" },
                take: 3,
              })
            : Promise.resolve([]),
          canViewSensitive
            ? ctx.prisma.leaveBalance.findMany({
                where: { employeeId: employee.id, year },
                include: { leaveType: true },
              })
            : Promise.resolve([]),
          canViewSensitive
            ? ctx.prisma.attendanceLog.findMany({
                where: {
                  employeeId: employee.id,
                  date: { gte: monthStart, lte: monthEnd },
                },
                select: { status: true },
              })
            : Promise.resolve([]),
          canViewSensitive
            ? ctx.prisma.employeeJobHistory.findFirst({
                where: {
                  employeeId: employee.id,
                  fieldChanged: "status",
                  newValue: employee.status,
                },
                orderBy: { effectiveDate: "desc" },
                select: { effectiveDate: true },
              })
            : Promise.resolve(null),
        ]);

      let attendancePct: number | null = null;
      if (canViewSensitive) {
        const present = monthLogs.filter((l) =>
          ["PRESENT", "LATE", "HALF_DAY"].includes(l.status)
        ).length;
        const weekdays = Array.from({ length: now.getUTCDate() }, (_, i) => {
          const d = new Date(
            Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), i + 1)
          );
          return d.getUTCDay();
        }).filter((d) => isWorkingDay(d)).length;
        attendancePct =
          weekdays > 0 ? Math.round((present / weekdays) * 100) : null;
      }

      const leaveDaysRemaining = leaveBalances.reduce(
        (sum, b) => sum + b.remaining,
        0
      );

      let daysSinceJoining: number | null = null;
      if (employee.dateOfJoining && canViewSensitive) {
        daysSinceJoining = Math.max(
          0,
          Math.floor(
            (Date.now() - employee.dateOfJoining.getTime()) /
              (1000 * 60 * 60 * 24)
          )
        );
      }

      const { passwordHash: _, ...safe } = employee;
      const sanitizedEmployee = canViewSensitive
        ? safe
        : redactEmployeeSensitiveData(safe);

      return {
        employee: {
          ...sanitizedEmployee,
          statusEffectiveDate: statusHistory?.effectiveDate ?? null,
          profileCompletion: canViewSensitive ? profileCompletionPercent(employee) : 0,
        },
        access: {
          canViewSensitive,
          visibilityLevel: visibility,
          canEdit:
            canManageEmployees(actor.role as Role) || actor.id === employee.id,
          canManage: canManageEmployees(actor.role as Role),
          isSelf: actor.id === employee.id,
          isManager: employee.managerId === actor.id,
        },
        overview: {
          attendancePct,
          leaveDaysRemaining: canViewSensitive ? leaveDaysRemaining : null,
          daysSinceJoining,
          recentAttendance,
          recentLeave,
          jobHistoryPreview: canViewSensitive ? jobHistory.slice(0, 3) : [],
        },
        jobHistory: canViewSensitive ? jobHistory : [],
      };
    }),

  jobHistory: protectedProcedure
    .input(z.object({ employeeId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertCanViewSensitive(ctx, input.employeeId);
      return ctx.prisma.employeeJobHistory.findMany({
        where: { employeeId: input.employeeId },
        include: {
          changedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { effectiveDate: "desc" },
      });
    }),

  documents: protectedProcedure
    .input(z.object({ employeeId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertCanViewSensitive(ctx, input.employeeId);
      return ctx.prisma.employeeDocument.findMany({
        where: { employeeId: input.employeeId },
        include: {
          uploadedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { uploadedAt: "desc" },
      });
    }),

  uploadDocument: protectedProcedure
    .input(uploadEmployeeDocumentSchema)
    .mutation(async ({ ctx, input }) => {
      const { actor } = await assertCanViewSensitive(ctx, input.employeeId);
      const canUpload =
        canManageEmployees(actor.role as Role) || actor.id === input.employeeId;
      if (!canUpload) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Server-side validation of file type & size limits
      const allowedMimes = [
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/webp",
        "application/pdf",
      ];
      if (input.fileUrl.startsWith("data:")) {
        const match = input.fileUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!match) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid file format",
          });
        }
        const mime = match[1].toLowerCase();
        if (!allowedMimes.includes(mime)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Only PDF, PNG, JPG, and WEBP files are allowed",
          });
        }
        // Limit: ~5MB (7MB base64 string length)
        if (input.fileUrl.length > 7 * 1024 * 1024) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "File exceeds 5MB size limit",
          });
        }
      } else if (!input.fileUrl.startsWith("https://")) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "File URL must be an HTTPS URL or valid data URL",
        });
      }

      return ctx.prisma.employeeDocument.create({
        data: {
          employeeId: input.employeeId,
          documentType: input.documentType,
          title: input.title || null,
          fileUrl: input.fileUrl,
          uploadedById: actor.id,
        },
        include: {
          uploadedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });
    }),

  deleteDocument: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const doc = await ctx.prisma.employeeDocument.findUnique({
        where: { id: input.id },
      });
      if (!doc) throw new TRPCError({ code: "NOT_FOUND" });
      const { actor } = await assertCanViewSensitive(ctx, doc.employeeId);
      const canDelete =
        canManageEmployees(actor.role as Role) || actor.id === doc.employeeId;
      if (!canDelete) throw new TRPCError({ code: "FORBIDDEN" });
      await ctx.prisma.employeeDocument.delete({ where: { id: input.id } });
      return { success: true };
    }),

  create: hrAdminProcedure
    .input(createEmployeeSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.employee.findUnique({
        where: { email: input.email.toLowerCase() },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An employee with this email already exists",
        });
      }

      if (input.employeeCode) {
        const codeTaken = await ctx.prisma.employee.findUnique({
          where: { employeeCode: input.employeeCode },
        });
        if (codeTaken) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Employee ID ${input.employeeCode} is already in use`,
          });
        }
      }

      const employeeCode = input.employeeCode || (await nextEmployeeCode(ctx.prisma));
      const passwordHash = await bcrypt.hash(input.password, 12);

      const employee = await ctx.prisma.employee.create({
        data: {
          employeeCode,
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email.toLowerCase(),
          passwordHash,
          phone: input.phone || null,
          gender: input.gender || null,
          emergencyContactName: input.emergencyContactName || null,
          emergencyContactPhone: input.emergencyContactPhone || null,
          bloodGroup: input.bloodGroup || null,
          role: input.role,
          designationId: input.designationId || null,
          departmentId: input.departmentId || null,
          managerId: input.managerId || null,
          dateOfJoining: input.dateOfJoining || null,
          dateOfBirth: input.dateOfBirth || null,
          address: input.address || null,
          profilePhotoUrl: input.profilePhotoUrl || null,
          status: input.status,
          ...(() => {
            if (input.assignedLocations !== undefined) {
              return syncLegacyWorkLocation(input.assignedLocations ?? []);
            }
            const single =
              input.workLocationLat != null && input.workLocationLng != null
                ? [
                    {
                      name: input.workLocationName || "Assigned site",
                      lat: input.workLocationLat,
                      lng: input.workLocationLng,
                    },
                  ]
                : [];
            return syncLegacyWorkLocation(single);
          })(),
        },
        include: employeeInclude,
      });

      const year = new Date().getFullYear();
      const leaveTypes = await ctx.prisma.leaveType.findMany();
      if (leaveTypes.length > 0) {
        await ctx.prisma.leaveBalance.createMany({
          data: leaveTypes.map((lt) => ({
            employeeId: employee.id,
            leaveTypeId: lt.id,
            year,
            allotted: lt.annualQuota,
            used: 0,
            remaining: lt.annualQuota,
          })),
          skipDuplicates: true,
        });
      }

      // Fire-and-forget welcome email with credentials to the newly created employee
      void (async () => {
        try {
          const { notifyWelcomeEmployee } = await import("../lib/email");
          const name = [employee.firstName, employee.lastName].filter(Boolean).join(" ");
          await notifyWelcomeEmployee({
            employeeName: name,
            employeeEmail: employee.email,
            employeeCode: employee.employeeCode,
            rawPassword: input.password,
            role: employee.role,
            departmentName: employee.department?.name,
            designationTitle: employee.designation?.title,
            dateOfJoining: employee.dateOfJoining,
          });

          // Telegram Alert for HR & Lifecycle Bot
          const { formatNewJoinTelegramMessage, sendTelegramNotification } = await import(
            "../lib/telegram"
          );
          const telegramMsg = formatNewJoinTelegramMessage({
            employeeName: name,
            employeeCode: employee.employeeCode,
            designation: employee.designation?.title,
            department: employee.department?.name,
            dateOfJoining: employee.dateOfJoining
              ? employee.dateOfJoining.toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  timeZone: "Asia/Kolkata",
                })
              : null,
            email: employee.email,
            phone: employee.phone,
          });
          await sendTelegramNotification(
            ctx.prisma,
            "HR_LIFECYCLE",
            "notifyNewJoin",
            telegramMsg
          );
        } catch (err) {
          console.error("[employee.create] Failed to send welcome notifications:", err);
        }
      })();

      const { passwordHash: _, ...safe } = employee;
      return safe;
    }),

  importExcel: hrAdminProcedure
    .input(
      z.object({
        rows: z
          .array(
            z.object({
              employeeCode: z.string().optional(),
              firstName: z.string().optional(),
              lastName: z.string().optional(),
              email: z.string().optional(),
              phone: z.string().optional(),
              gender: z.string().optional(),
              role: z.string().optional(),
              department: z.string().optional(),
              designation: z.string().optional(),
              dateOfJoining: z.string().optional(),
              dateOfBirth: z.string().optional(),
              status: z.string().optional(),
              password: z.string().optional(),
            })
          )
          .max(2000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const ROLES = ["ADMIN", "HR", "MANAGER", "EMPLOYEE"] as const;
      const STATUSES = EMPLOYEE_STATUSES;
      const departmentIds = new Map<string, string>();
      const designationIds = new Map<string, string>();
      const leaveTypes = await ctx.prisma.leaveType.findMany();
      const year = new Date().getFullYear();
      let created = 0;
      let updated = 0;
      const errors: { row: number; message: string }[] = [];

      const departmentId = async (name?: string) => {
        const key = name?.trim();
        if (!key) return undefined;
        if (!departmentIds.has(key.toLowerCase())) {
          const dept =
            (await ctx.prisma.department.findFirst({
              where: { name: { equals: key, mode: "insensitive" } },
            })) ?? (await ctx.prisma.department.create({ data: { name: key } }));
          departmentIds.set(key.toLowerCase(), dept.id);
        }
        return departmentIds.get(key.toLowerCase());
      };

      const designationId = async (title?: string) => {
        const key = title?.trim();
        if (!key) return undefined;
        if (!designationIds.has(key.toLowerCase())) {
          const des =
            (await ctx.prisma.designation.findFirst({
              where: { title: { equals: key, mode: "insensitive" } },
            })) ?? (await ctx.prisma.designation.create({ data: { title: key } }));
          designationIds.set(key.toLowerCase(), des.id);
        }
        return designationIds.get(key.toLowerCase());
      };

      for (const [i, row] of input.rows.entries()) {
        const rowNo = i + 2;
        try {
          const email = row.email?.trim().toLowerCase();
          if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
            errors.push({ row: rowNo, message: "Valid Email is required" });
            continue;
          }

          const role = row.role?.trim().toUpperCase();
          if (role && !ROLES.includes(role as (typeof ROLES)[number])) {
            errors.push({ row: rowNo, message: `Invalid Role "${row.role}"` });
            continue;
          }
          const status = row.status?.trim().toUpperCase().replace(/\s+/g, "_");
          if (status && !STATUSES.includes(status as (typeof STATUSES)[number])) {
            errors.push({ row: rowNo, message: `Invalid Status "${row.status}"` });
            continue;
          }

          const doj = parseExcelDate(row.dateOfJoining);
          const dob = parseExcelDate(row.dateOfBirth);
          const data = {
            ...(row.firstName?.trim() && { firstName: row.firstName.trim() }),
            ...(row.lastName?.trim() && { lastName: row.lastName.trim() }),
            ...(row.phone?.trim() && { phone: row.phone.trim() }),
            ...(row.gender?.trim() && { gender: row.gender.trim() }),
            ...(role && { role: role as (typeof ROLES)[number] }),
            ...(status && { status: status as (typeof STATUSES)[number] }),
            ...(doj && { dateOfJoining: new Date(doj) }),
            ...(dob && { dateOfBirth: new Date(dob) }),
            departmentId: await departmentId(row.department),
            designationId: await designationId(row.designation),
          };

          const existing = await ctx.prisma.employee.findUnique({
            where: { email },
            select: { id: true },
          });

          if (existing) {
            await ctx.prisma.employee.update({ where: { id: existing.id }, data });
            updated++;
            continue;
          }

          if (!row.firstName?.trim()) {
            errors.push({ row: rowNo, message: "First Name is required for new employee" });
            continue;
          }

          const code = row.employeeCode?.trim().toUpperCase();
          if (code) {
            const taken = await ctx.prisma.employee.findUnique({
              where: { employeeCode: code },
              select: { id: true },
            });
            if (taken) {
              errors.push({ row: rowNo, message: `Employee Code ${code} already exists` });
              continue;
            }
          }

          const employee = await ctx.prisma.employee.create({
            data: {
              ...data,
              firstName: row.firstName.trim(),
              lastName: row.lastName?.trim() ?? "",
              email,
              employeeCode: code || (await nextEmployeeCode(ctx.prisma)),
              passwordHash: await bcrypt.hash(row.password?.trim() || "Realty@123", 10),
            },
          });

          if (leaveTypes.length > 0) {
            await ctx.prisma.leaveBalance.createMany({
              data: leaveTypes.map((lt) => ({
                employeeId: employee.id,
                leaveTypeId: lt.id,
                year,
                allotted: lt.annualQuota,
                used: 0,
                remaining: lt.annualQuota,
              })),
              skipDuplicates: true,
            });
          }
          created++;
        } catch (err) {
          errors.push({
            row: rowNo,
            message: err instanceof Error ? err.message.split("\n").pop() ?? "Failed" : "Failed",
          });
        }
      }

      return { created, updated, errors };
    }),

  update: hrAdminProcedure
    .input(updateEmployeeSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, password, statusEffectiveDate, ...data } = input;

      const existing = await ctx.prisma.employee.findUnique({ where: { id } });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Employee not found" });
      }

      if (data.email && data.email !== existing.email) {
        const emailTaken = await ctx.prisma.employee.findUnique({
          where: { email: data.email },
        });
        if (emailTaken) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "An employee with this email already exists",
          });
        }
      }

      if (data.managerId === id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Employee cannot be their own manager",
        });
      }

      if (data.employeeCode && data.employeeCode !== existing.employeeCode) {
        const codeTaken = await ctx.prisma.employee.findUnique({
          where: { employeeCode: data.employeeCode },
        });
        if (codeTaken) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Employee ID ${data.employeeCode} is already in use`,
          });
        }
      }

      const actor = await resolveActorId(ctx);

      const updateData: Record<string, unknown> = {};
      if (data.employeeCode) updateData.employeeCode = data.employeeCode;
      if (data.firstName !== undefined) updateData.firstName = data.firstName;
      if (data.lastName !== undefined) updateData.lastName = data.lastName;
      if (data.email !== undefined) updateData.email = data.email;
      if (data.phone !== undefined) updateData.phone = data.phone || null;
      if (data.gender !== undefined) updateData.gender = data.gender || null;
      if (data.emergencyContactName !== undefined)
        updateData.emergencyContactName = data.emergencyContactName || null;
      if (data.emergencyContactPhone !== undefined)
        updateData.emergencyContactPhone = data.emergencyContactPhone || null;
      if (data.bloodGroup !== undefined) updateData.bloodGroup = data.bloodGroup || null;
      if (data.role !== undefined) updateData.role = data.role;
      if (data.designationId !== undefined)
        updateData.designationId = data.designationId || null;
      if (data.departmentId !== undefined)
        updateData.departmentId = data.departmentId || null;
      if (data.managerId !== undefined)
        updateData.managerId = data.managerId || null;
      if (data.dateOfJoining !== undefined)
        updateData.dateOfJoining = data.dateOfJoining || null;
      if (data.dateOfBirth !== undefined)
        updateData.dateOfBirth = data.dateOfBirth || null;
      if (data.address !== undefined) updateData.address = data.address || null;
      if (data.profilePhotoUrl !== undefined)
        updateData.profilePhotoUrl = data.profilePhotoUrl || null;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.assignedLocations !== undefined) {
        Object.assign(
          updateData,
          syncLegacyWorkLocation(data.assignedLocations ?? [])
        );
      } else if (
        data.workLocationLat !== undefined ||
        data.workLocationLng !== undefined ||
        data.workLocationName !== undefined
      ) {
        const lat =
          data.workLocationLat !== undefined
            ? data.workLocationLat
            : existing.workLocationLat;
        const lng =
          data.workLocationLng !== undefined
            ? data.workLocationLng
            : existing.workLocationLng;
        const name =
          data.workLocationName !== undefined
            ? data.workLocationName
            : existing.workLocationName;
        Object.assign(
          updateData,
          syncLegacyWorkLocation(
            lat != null && lng != null
              ? [{ name: name || "Assigned site", lat, lng }]
              : []
          )
        );
      }
      if (password) {
        updateData.passwordHash = await bcrypt.hash(password, 12);
      }

      const jobFields = [
        "designationId",
        "departmentId",
        "managerId",
      ] as const;
      const historyEntries: {
        employeeId: string;
        fieldChanged: string;
        oldValue: string | null;
        newValue: string | null;
        changedById: string;
      }[] = [];

      for (const field of jobFields) {
        if (data[field] === undefined) continue;
        const nextVal = (data[field] as string | null) || null;
        const prevVal = existing[field];
        if (prevVal !== nextVal) {
          historyEntries.push({
            employeeId: id,
            fieldChanged: field.replace("Id", ""),
            oldValue: await labelForJobField(ctx.prisma, field, prevVal),
            newValue: await labelForJobField(ctx.prisma, field, nextVal),
            changedById: actor.id,
          });
        }
      }

      const previousStatus = existing.status;
      const nextStatus = data.status ?? previousStatus;
      const statusChanged = nextStatus !== previousStatus;
      const effectiveDate = statusEffectiveDate ?? new Date();
      const latestStatusHistory =
        data.status !== undefined &&
        (statusChanged || statusEffectiveDate != null)
          ? await ctx.prisma.employeeJobHistory.findFirst({
              where: {
                employeeId: id,
                fieldChanged: "status",
                newValue: nextStatus,
              },
              orderBy: { effectiveDate: "desc" },
              select: { effectiveDate: true },
            })
          : null;
      const shouldWriteStatusHistory =
        statusChanged ||
        (statusEffectiveDate != null &&
          (!latestStatusHistory ||
            latestStatusHistory.effectiveDate.toISOString().slice(0, 10) !==
              effectiveDate.toISOString().slice(0, 10)));
      const employee = await ctx.prisma.$transaction(async (tx) => {
        const updated = await tx.employee.update({
          where: { id },
          data: updateData,
          include: employeeInclude,
        });
        if (historyEntries.length > 0) {
          await tx.employeeJobHistory.createMany({ data: historyEntries });
        }
        if (shouldWriteStatusHistory) {
          await tx.employeeJobHistory.create({
            data: {
              employeeId: id,
              fieldChanged: "status",
              oldValue: previousStatus,
              newValue: nextStatus,
              effectiveDate,
              changedById: actor.id,
            },
          });
        }
        return updated;
      });
      await invalidatePunchGeofenceCache(id);

      let statusEmailSent: boolean | null = null;
      if (statusChanged) {
        try {
          const { notifyEmployeeStatusChange } = await import("../lib/email");
          const name = [employee.firstName, employee.lastName]
            .filter(Boolean)
            .join(" ");
          const result = await notifyEmployeeStatusChange({
            employeeName: name,
            employeeEmail: employee.email,
            employeeCode: employee.employeeCode,
            previousStatus,
            newStatus: employee.status as
              | "ACTIVE"
              | "ON_LEAVE"
              | "RESIGNED"
              | "TERMINATED"
              | "EXIT",
            departmentName: employee.department?.name,
            designationTitle: employee.designation?.title,
            dateOfJoining: employee.dateOfJoining,
            effectiveDate,
          });
          statusEmailSent = result.success;
          if (!result.success) {
            console.error(
              "[employee.update] Status email was not sent. Check SMTP configuration and server mail logs."
            );
          }

          // Telegram Alert for HR & Lifecycle Bot
          const isResigned = employee.status === "RESIGNED";
          const isTerminated = employee.status === "TERMINATED";
          const featureKey = isResigned
            ? "notifyResigned"
            : isTerminated
              ? "notifyTerminated"
              : null;

          if (featureKey) {
            const { formatStatusChangeTelegramMessage, sendTelegramNotification } = await import(
              "../lib/telegram"
            );
            const msg = formatStatusChangeTelegramMessage({
              employeeName: name,
              employeeCode: employee.employeeCode,
              previousStatus,
              newStatus: employee.status,
              effectiveDate: effectiveDate.toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                timeZone: "Asia/Kolkata",
              }),
            });
            await sendTelegramNotification(ctx.prisma, "HR_LIFECYCLE", featureKey, msg);
          }
        } catch (err) {
          statusEmailSent = false;
          const errorCode =
            err && typeof err === "object" && "code" in err
              ? String(err.code)
              : "UNKNOWN";
          console.error(
            `[employee.update] Status email failed before delivery (code: ${errorCode}).`
          );
        }
      }

      const { passwordHash: _, ...safe } = employee;
      return { ...safe, statusEmailSent };
    }),

  /** Flat roster rows for Excel export (Active / Terminated / Exit / Resigned / All) */
  exportRoster: hrAdminProcedure
    .input(
      z.object({
        status: z
          .enum(["ACTIVE", "ON_LEAVE", "RESIGNED", "TERMINATED", "EXIT", "ALL"])
          .default("ACTIVE"),
      })
    )
    .query(async ({ ctx, input }) => {
      const where =
        input.status === "ALL" ? {} : { status: input.status as (typeof EMPLOYEE_STATUSES)[number] };

      const rows = await ctx.prisma.employee.findMany({
        where,
        include: {
          department: { select: { name: true } },
          designation: { select: { title: true } },
          manager: {
            select: { firstName: true, lastName: true, employeeCode: true },
          },
        },
        orderBy: [{ status: "asc" }, { employeeCode: "asc" }],
      });

      return rows.map((e) => ({
        employeeCode: e.employeeCode,
        firstName: e.firstName,
        lastName: e.lastName,
        email: e.email,
        phone: e.phone ?? "",
        role: e.role,
        status: e.status,
        department: e.department?.name ?? "",
        designation: e.designation?.title ?? "",
        manager: e.manager
          ? `${e.manager.firstName} ${e.manager.lastName} (${e.manager.employeeCode})`
          : "",
        dateOfJoining: e.dateOfJoining
          ? e.dateOfJoining.toISOString().slice(0, 10)
          : "",
        dateOfBirth: e.dateOfBirth
          ? e.dateOfBirth.toISOString().slice(0, 10)
          : "",
        gender: e.gender ?? "",
        address: e.address ?? "",
        updatedAt: e.updatedAt.toISOString().slice(0, 10),
      }));
    }),

  delete: hrAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (input.id === ctx.session.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot delete your own account",
        });
      }

      const existing = await ctx.prisma.employee.findUnique({
        where: { id: input.id },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Employee not found" });
      }

      await ctx.prisma.employee.updateMany({
        where: { managerId: input.id },
        data: { managerId: null },
      });

      await ctx.prisma.employeeDocument.deleteMany({
        where: { employeeId: input.id },
      });
      await ctx.prisma.employeeJobHistory.deleteMany({
        where: { OR: [{ employeeId: input.id }, { changedById: input.id }] },
      });
      await ctx.prisma.locationPing.deleteMany({
        where: { employeeId: input.id },
      });

      await ctx.prisma.employee.delete({ where: { id: input.id } });
      return { success: true };
    }),

  managerOptions: protectedProcedure.query(async ({ ctx }) => {
    const employees = await ctx.prisma.employee.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeCode: true,
        designation: { select: { title: true } },
      },
      orderBy: { firstName: "asc" },
    });
    return employees;
  }),

  orgChart: protectedProcedure.query(async ({ ctx }): Promise<OrgChartNode[]> => {
    const employees = await ctx.prisma.employee.findMany({
      where: {
        status: { in: ["ACTIVE", "ON_LEAVE"] },
      },
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        profilePhotoUrl: true,
        managerId: true,
        designation: { select: { id: true, title: true } },
        department: { select: { id: true, name: true } },
      },
      orderBy: { employeeCode: "asc" },
    });

    const map = new Map<string, OrgChartNode>();
    for (const emp of employees) {
      map.set(emp.id, {
        id: emp.id,
        employeeCode: emp.employeeCode,
        firstName: emp.firstName,
        lastName: emp.lastName,
        profilePhotoUrl: emp.profilePhotoUrl,
        designation: emp.designation,
        department: emp.department,
        children: [],
      });
    }

    const roots: OrgChartNode[] = [];
    for (const emp of employees) {
      const node = map.get(emp.id)!;
      if (emp.managerId && map.has(emp.managerId)) {
        map.get(emp.managerId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }),

  dashboardStats: protectedProcedure.query(async ({ ctx }) => {
    const today = startOfDayUTC(new Date());
    const [totalEmployees, departmentCount, recentJoiners, todayLogs] =
      await Promise.all([
        ctx.prisma.employee.count({
          where: { status: { in: ["ACTIVE", "ON_LEAVE"] } },
        }),
        ctx.prisma.department.count(),
        ctx.prisma.employee.findMany({
          where: { dateOfJoining: { not: null } },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            profilePhotoUrl: true,
            dateOfJoining: true,
            department: { select: { name: true } },
            designation: { select: { title: true } },
          },
          orderBy: { dateOfJoining: "desc" },
          take: 5,
        }),
        ctx.prisma.attendanceLog.findMany({
          where: { date: today },
          select: {
            status: true,
            checkInTime: true,
            employee: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        }),
      ]);

    const onLeave = todayLogs
      .filter((l) => l.status === "ON_LEAVE")
      .map((l) => l.employee);
    const checkedIn = todayLogs.filter((l) => Boolean(l.checkInTime));
    const late = checkedIn
      .filter((l) => l.status === "LATE")
      .map((l) => l.employee);
    const onTime = checkedIn
      .filter((l) => l.status !== "LATE")
      .map((l) => l.employee);
    const checkedIds = new Set(todayLogs.map((l) => l.employee.id));
    const notInSample = await ctx.prisma.employee.findMany({
      where: {
        status: { in: ["ACTIVE", "ON_LEAVE"] },
        id: { notIn: [...checkedIds] },
      },
      select: { id: true, firstName: true, lastName: true },
      take: 4,
      orderBy: { firstName: "asc" },
    });
    const notInCount = Math.max(0, totalEmployees - checkedIds.size);

    return {
      totalEmployees,
      departmentCount,
      recentJoiners,
      presence: {
        onTime: { count: onTime.length, sample: onTime.slice(0, 4) },
        late: { count: late.length, sample: late.slice(0, 4) },
        onLeave: { count: onLeave.length, sample: onLeave.slice(0, 4) },
        notIn: { count: notInCount, sample: notInSample },
      },
    };
  }),

  updateMyPhoto: protectedProcedure
    .input(
      z.object({
        profilePhotoUrl: z.union([
          z.string().url().max(2048),
          z
            .string()
            .max(200_000)
            .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/),
        ]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const actor = await resolveActorId(ctx);
      const updated = await ctx.prisma.employee.update({
        where: { id: actor.id },
        data: { profilePhotoUrl: input.profilePhotoUrl },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          profilePhotoUrl: true,
        },
      });
      return updated;
    }),

  myIdCard: protectedProcedure.query(async ({ ctx }) => {
    const actor = await resolveActorId(ctx);
    const employee = await ctx.prisma.employee.findUnique({
      where: { id: actor.id },
      select: {
        employeeCode: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        profilePhotoUrl: true,
        dateOfJoining: true,
        dateOfBirth: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
        bloodGroup: true,
        address: true,
        department: { select: { name: true } },
        designation: { select: { title: true } },
      },
    });
    if (!employee) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Employee not found" });
    }
    return employee;
  }),

  getUpcomingBirthdays: protectedProcedure.query(
    async ({ ctx }): Promise<UpcomingBirthdayItem[]> => {
    if (
      upcomingBirthdaysCache &&
      Date.now() - upcomingBirthdaysCache.at < UPCOMING_BIRTHDAYS_TTL_MS
    ) {
      return upcomingBirthdaysCache.data;
    }

    const employees = await ctx.prisma.employee.findMany({
      where: {
        status: { in: ["ACTIVE", "ON_LEAVE"] },
        dateOfBirth: { not: null },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        profilePhotoUrl: true,
        dateOfBirth: true,
        department: { select: { name: true } },
        designation: { select: { title: true } },
      },
      take: 200,
    });

    const now = new Date();
    const currentYear = now.getFullYear();
    const today = new Date(currentYear, now.getMonth(), now.getDate());
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];

    const upcoming: {
      id: string;
      name: string;
      firstName: string;
      lastName: string;
      profilePhotoUrl: string | null;
      department: string | null;
      designation: string | null;
      birthdayDate: string;
      isToday: boolean;
      daysUntil: number;
    }[] = [];

    for (const emp of employees) {
      if (!emp.dateOfBirth) continue;
      const dob = new Date(emp.dateOfBirth);
      const birthMonth = dob.getMonth();
      const birthDay = dob.getDate();
      let nextBirthday = new Date(currentYear, birthMonth, birthDay);
      if (nextBirthday.getTime() < today.getTime()) {
        nextBirthday = new Date(currentYear + 1, birthMonth, birthDay);
      }
      const diffDays = Math.round(
        (nextBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (diffDays < 0 || diffDays > 30) continue;
      upcoming.push({
        id: emp.id,
        name: `${emp.firstName} ${emp.lastName}`.trim(),
        firstName: emp.firstName,
        lastName: emp.lastName,
        profilePhotoUrl: emp.profilePhotoUrl,
        department: emp.department?.name ?? null,
        designation: emp.designation?.title ?? null,
        birthdayDate: `${monthNames[birthMonth]} ${birthDay}`,
        isToday: diffDays === 0,
        daysUntil: diffDays,
      });
    }

    upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
    const result = upcoming.slice(0, 12);
    upcomingBirthdaysCache = { at: Date.now(), data: result };
    return result;
  }),

  notifications: protectedProcedure.query(async ({ ctx }) => {
    const role = ctx.session.user.role as Role;
    const isStaff = role === "ADMIN" || role === "HR" || role === "MANAGER";
    const today = startOfDayUTC(new Date());

    if (isStaff) {
      const leaveWhere: Record<string, unknown> = { status: "PENDING" };
      if (role === "MANAGER") {
        leaveWhere.employee = { managerId: ctx.session.user.id };
      }

      const [pendingLeaves, outsideGeofenceLogs, lateLogs, newCandidates] =
        await Promise.all([
          ctx.prisma.leaveRequest.findMany({
            where: leaveWhere,
            include: {
              employee: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  profilePhotoUrl: true,
                  department: { select: { name: true } },
                },
              },
              leaveType: { select: { name: true } },
            },
            orderBy: { appliedAt: "desc" },
            take: 10,
          }),
          ctx.prisma.attendanceLog.findMany({
            where: {
              date: today,
              withinGeofence: false,
              checkInTime: { not: null },
            },
            include: {
              employee: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  profilePhotoUrl: true,
                },
              },
            },
            take: 5,
          }),
          ctx.prisma.attendanceLog.findMany({
            where: {
              date: today,
              status: "LATE",
              checkInTime: { not: null },
            },
            include: {
              employee: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  profilePhotoUrl: true,
                },
              },
            },
            take: 5,
          }),
          role === "ADMIN" || role === "HR"
            ? ctx.prisma.candidate.findMany({
                where: { currentStage: "APPLIED" },
                include: { jobPosting: { select: { title: true } } },
                orderBy: { appliedAt: "desc" },
                take: 5,
              })
            : Promise.resolve([]),
        ]);

      type NotificationItem = {
        id: string;
        type: "LEAVE" | "GEOFENCE" | "LATE" | "CANDIDATE";
        title: string;
        subtitle: string;
        time: Date | null;
        href: string;
        avatar?: string | null;
        badgeColor: string;
        badgeText: string;
      };

      const items: NotificationItem[] = [];

      for (const l of pendingLeaves) {
        items.push({
          id: `leave-${l.id}`,
          type: "LEAVE",
          title: `${l.employee.firstName} ${l.employee.lastName}`,
          subtitle: `Applied for ${l.numberOfDays}d ${l.leaveType.name} (${l.reason.slice(0, 35)}${l.reason.length > 35 ? "…" : ""})`,
          time: l.appliedAt,
          href: "/admin-portal/leave/approvals",
          avatar: l.employee.profilePhotoUrl,
          badgeColor: "bg-purple-100 text-purple-700 border-purple-200",
          badgeText: "Leave Request",
        });
      }

      for (const g of outsideGeofenceLogs) {
        items.push({
          id: `geofence-${g.id}`,
          type: "GEOFENCE",
          title: `${g.employee.firstName} ${g.employee.lastName}`,
          subtitle: "Punched in outside allowed geofence area",
          time: g.checkInTime,
          href: "/admin-portal/attendance",
          avatar: g.employee.profilePhotoUrl,
          badgeColor: "bg-amber-100 text-amber-700 border-amber-200",
          badgeText: "Geofence Breach",
        });
      }

      for (const lp of lateLogs) {
        if (!items.some((i) => i.id === `geofence-${lp.id}`)) {
          items.push({
            id: `late-${lp.id}`,
            type: "LATE",
            title: `${lp.employee.firstName} ${lp.employee.lastName}`,
            subtitle: "Arrived after scheduled shift start time",
            time: lp.checkInTime,
            href: "/admin-portal/attendance",
            avatar: lp.employee.profilePhotoUrl,
            badgeColor: "bg-rose-100 text-rose-700 border-rose-200",
            badgeText: "Late Punch",
          });
        }
      }

      for (const c of newCandidates) {
        items.push({
          id: `candidate-${c.id}`,
          type: "CANDIDATE",
          title: c.fullName,
          subtitle: `New application for ${c.jobPosting.title}`,
          time: c.appliedAt,
          href: "/admin-portal/recruitment/candidates",
          badgeColor: "bg-blue-100 text-blue-700 border-blue-200",
          badgeText: "New Candidate",
        });
      }

      items.sort((a, b) => {
        const tA = a.time ? new Date(a.time).getTime() : 0;
        const tB = b.time ? new Date(b.time).getTime() : 0;
        return tB - tA;
      });

      return {
        unreadCount: items.length,
        pendingLeavesCount: pendingLeaves.length,
        anomaliesCount: outsideGeofenceLogs.length + lateLogs.length,
        candidatesCount: newCandidates.length,
        items,
      };
    } else {
      const recentLeaves = await ctx.prisma.leaveRequest.findMany({
        where: {
          employeeId: ctx.session.user.id,
          respondedAt: { not: null },
        },
        include: { leaveType: true },
        orderBy: { respondedAt: "desc" },
        take: 5,
      });

      const items = recentLeaves.map((l) => ({
        id: `leave-res-${l.id}`,
        type: "LEAVE" as const,
        title: `Leave ${l.status === "APPROVED" ? "Approved" : "Rejected"}`,
        subtitle: `Your ${l.leaveType.name} (${l.numberOfDays}d) was ${l.status.toLowerCase()}`,
        time: l.respondedAt,
        href: "/employee-portal/leaves",
        avatar: null,
        badgeColor:
          l.status === "APPROVED"
            ? "bg-emerald-100 text-emerald-700 border-emerald-200"
            : "bg-rose-100 text-rose-700 border-rose-200",
        badgeText: l.status,
      }));

      return {
        unreadCount: items.length,
        pendingLeavesCount: 0,
        anomaliesCount: 0,
        candidatesCount: 0,
        items,
      };
    }
  }),
});
