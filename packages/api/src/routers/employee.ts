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
} from "@realty-smartz/shared";
import {
  startOfDayUTC,
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
import { ensureEmployee30MinPings } from "../lib/attendance-auto";

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
      findFirst: (args: {
        orderBy: { employeeCode: "desc" };
        select: { employeeCode: true };
      }) => Promise<{ employeeCode: string } | null>;
    };
  }
) {
  const latest = await prisma.employee.findFirst({
    orderBy: { employeeCode: "desc" },
    select: { employeeCode: true },
  });

  let nextNum = 1;
  if (latest?.employeeCode) {
    const match = latest.employeeCode.match(/RS-(\d+)/);
    if (match) {
      nextNum = parseInt(match[1], 10) + 1;
    }
  }

  return `${EMPLOYEE_CODE_PREFIX}${String(nextNum).padStart(4, "0")}`;
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

      const { passwordHash: _, ...safe } = employee;
      const sanitized = canViewSensitive
        ? safe
        : redactEmployeeSensitiveData(safe);

      return {
        ...sanitized,
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

      const [jobHistory, recentAttendance, recentLeave, leaveBalances] =
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
        ]);

      let attendancePct: number | null = null;
      if (canViewSensitive) {
        const monthLogs = await ctx.prisma.attendanceLog.findMany({
          where: {
            employeeId: employee.id,
            date: { gte: monthStart, lte: monthEnd },
          },
        });
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

      const employeeCode = await nextEmployeeCode(ctx.prisma);
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
          role: input.role,
          designationId: input.designationId || null,
          departmentId: input.departmentId || null,
          managerId: input.managerId || null,
          dateOfJoining: input.dateOfJoining || null,
          dateOfBirth: input.dateOfBirth || null,
          address: input.address || null,
          profilePhotoUrl: input.profilePhotoUrl || null,
          status: input.status,
          workLocationLat: input.workLocationLat ?? null,
          workLocationLng: input.workLocationLng ?? null,
          workLocationName: input.workLocationName || null,
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
        } catch (err) {
          console.error("[employee.create] Failed to send welcome email:", err);
        }
      })();

      const { passwordHash: _, ...safe } = employee;
      return safe;
    }),

  update: hrAdminProcedure
    .input(updateEmployeeSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, password, ...data } = input;

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

      const actor = await resolveActorId(ctx);

      const updateData: Record<string, unknown> = {};
      if (data.firstName !== undefined) updateData.firstName = data.firstName;
      if (data.lastName !== undefined) updateData.lastName = data.lastName;
      if (data.email !== undefined) updateData.email = data.email;
      if (data.phone !== undefined) updateData.phone = data.phone || null;
      if (data.gender !== undefined) updateData.gender = data.gender || null;
      if (data.emergencyContactName !== undefined)
        updateData.emergencyContactName = data.emergencyContactName || null;
      if (data.emergencyContactPhone !== undefined)
        updateData.emergencyContactPhone = data.emergencyContactPhone || null;
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
      if (data.workLocationLat !== undefined)
        updateData.workLocationLat = data.workLocationLat ?? null;
      if (data.workLocationLng !== undefined)
        updateData.workLocationLng = data.workLocationLng ?? null;
      if (data.workLocationName !== undefined)
        updateData.workLocationName = data.workLocationName || null;
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

      const employee = await ctx.prisma.$transaction(async (tx) => {
        const updated = await tx.employee.update({
          where: { id },
          data: updateData,
          include: employeeInclude,
        });
        if (historyEntries.length > 0) {
          await tx.employeeJobHistory.createMany({ data: historyEntries });
        }
        return updated;
      });

      if (
        data.workLocationLat !== undefined ||
        data.workLocationLng !== undefined ||
        data.workLocationName !== undefined
      ) {
        try {
          const today = startOfDayUTC(new Date());
          const targetLat = employee.workLocationLat ?? 28.3997196;
          const targetLng = employee.workLocationLng ?? 77.0385682;
          const targetAddr = employee.workLocationName || "Assigned Workplace";

          const todayLog = await ctx.prisma.attendanceLog.findFirst({
            where: { employeeId: id, date: today },
          });

          if (todayLog) {
            const updatedLog = await ctx.prisma.attendanceLog.update({
              where: { id: todayLog.id },
              data: {
                checkInLat: targetLat,
                checkInLng: targetLng,
                checkInAddress: targetAddr,
                withinGeofence: true,
                ...(todayLog.checkOutTime
                  ? {
                      checkOutLat: targetLat,
                      checkOutLng: targetLng,
                      checkOutAddress: targetAddr,
                    }
                  : {}),
              },
            });

            // Immediately update all location pings recorded today for this employee
            // so they anchor to the newly assigned project site rather than old HQ
            await ctx.prisma.locationPing.updateMany({
              where: {
                employeeId: id,
                capturedAt: { gte: today },
              },
              data: {
                lat: targetLat,
                lng: targetLng,
                address: targetAddr,
                withinGeofence: true,
              },
            });

            await ensureEmployee30MinPings(ctx.prisma, id, updatedLog);
          }
        } catch (e) {
          console.warn("[employee.update] Non-fatal attendance sync error:", e);
        }
      }

      const { passwordHash: _, ...safe } = employee;
      return safe;
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
    const [totalEmployees, departmentCount, recentJoiners] = await Promise.all([
      ctx.prisma.employee.count({
        where: { status: { in: ["ACTIVE", "ON_LEAVE"] } },
      }),
      ctx.prisma.department.count(),
      ctx.prisma.employee.findMany({
        where: { dateOfJoining: { not: null } },
        include: employeeInclude,
        orderBy: { dateOfJoining: "desc" },
        take: 5,
      }),
    ]);

    return {
      totalEmployees,
      departmentCount,
      recentJoiners: recentJoiners.map(({ passwordHash: _, ...rest }) => rest),
    };
  }),

  updateMyPhoto: protectedProcedure
    .input(
      z.object({
        profilePhotoUrl: z.string().min(1),
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

  getUpcomingBirthdays: protectedProcedure.query(async ({ ctx }) => {
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
        department: { select: { id: true, name: true } },
        designation: { select: { id: true, title: true } },
      },
    });

    const now = new Date();
    const currentYear = now.getFullYear();
    const today = new Date(currentYear, now.getMonth(), now.getDate());

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
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

      // Check current year birthday
      let nextBirthday = new Date(currentYear, birthMonth, birthDay);
      // If birthday has already passed this year, wrap to next year (handles year wrap-around like Dec 20 to Jan 19)
      if (nextBirthday.getTime() < today.getTime()) {
        nextBirthday = new Date(currentYear + 1, birthMonth, birthDay);
      }

      const diffTime = nextBirthday.getTime() - today.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays >= 0 && diffDays <= 30) {
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
    }

    // Sort by how soon the birthday is
    upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
    return upcoming;
  }),
});

