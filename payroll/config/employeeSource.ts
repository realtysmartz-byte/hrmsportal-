import type { PrismaClient } from "@realty-smartz/db";

/**
 * Mapping configuration for the host application's existing database tables.
 * All payroll queries referencing employees and attendance MUST use these
 * definitions so table or column names can be modified in one single location.
 */
export const employeeSourceConfig = {
  tableName: "Employee",
  columns: {
    id: "id",
    employeeCode: "employeeCode",
    firstName: "firstName",
    lastName: "lastName",
    email: "email",
    phone: "phone",
    role: "role",
    status: "status",
    departmentId: "departmentId",
    designationId: "designationId",
  },
  filters: {
    // Only active employees with EMPLOYEE role appear in payroll.
    // Admin, HR, or other management accounts must NEVER appear in payroll.
    allowedRoles: ["EMPLOYEE"],
    activeStatuses: ["ACTIVE", "ON_LEAVE"],
  },
} as const;

export const attendanceSourceConfig = {
  tableName: "AttendanceLog",
  columns: {
    id: "id",
    employeeId: "employeeId",
    date: "date",
    checkInTime: "checkInTime",
    checkOutTime: "checkOutTime",
    totalHours: "totalHours",
    status: "status",
  },
} as const;

export interface PayrollEmployeeRecord {
  id: string;
  employeeCode: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: string;
  status: string;
  department: string;
  designation?: string;
  dateOfJoining?: Date | null;
  separationDate?: Date | null;
  separationType?: "RESIGNED" | "TERMINATED" | "EXIT" | null;
}

export interface PayrollAttendanceRecord {
  id: string;
  employeeId: string;
  date: Date;
  checkInTime: Date | null;
  checkOutTime: Date | null;
  totalHours: number | null;
  status: string;
}

export interface PayrollLeaveRecord {
  id: string;
  employeeId: string;
  startDate: Date;
  endDate: Date;
  numberOfDays: number;
  isHalfDay: boolean;
  status: string;
}

/**
 * Reads approved leaves for the given employee ID list and date range using LeaveRequest.
 */
export async function getApprovedLeavesForMonth(
  prisma: PrismaClient,
  employeeIds: string[],
  startDate: Date,
  endDate: Date
): Promise<PayrollLeaveRecord[]> {
  try {
    const leaves = await prisma.leaveRequest.findMany({
      where: {
        employeeId: { in: employeeIds },
        status: "APPROVED",
        startDate: { lt: endDate },
        endDate: { gte: startDate },
      },
      select: {
        id: true,
        employeeId: true,
        startDate: true,
        endDate: true,
        numberOfDays: true,
        isHalfDay: true,
        status: true,
      },
      orderBy: { startDate: "asc" },
    });

    return leaves.map((l: any) => ({
      id: l.id,
      employeeId: l.employeeId,
      startDate: l.startDate,
      endDate: l.endDate,
      numberOfDays: Number(l.numberOfDays || 1),
      isHalfDay: Boolean(l.isHalfDay),
      status: l.status,
    }));
  } catch (error) {
    console.error("[PAYROLL_DB_ERROR] Failed to fetch approved leaves:", error);
    return [];
  }
}

/**
 * Reads all active employees eligible for payroll using the configured mappings.
 * Strictly excludes any Admin or HR accounts.
 *
 * If month and year are provided, includes separated employees (RESIGNED, TERMINATED, EXIT)
 * who were still with the company during the specified month and prorates based on separation date.
 * Excludes separated employees whose separation occurred prior to this payroll month.
 */
export async function getEligiblePayrollEmployees(
  prisma: PrismaClient,
  month?: number,
  year?: number,
  organizationId?: string
): Promise<PayrollEmployeeRecord[]> {
  try {
    const rawEmployees = await prisma.employee.findMany({
      where: {
        organizationId: organizationId || "org_default_realty",
        role: { in: [...employeeSourceConfig.filters.allowedRoles] as any },
        status: { in: ["ACTIVE", "ON_LEAVE", "RESIGNED", "TERMINATED", "EXIT"] as any },
      },
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        dateOfJoining: true,
        updatedAt: true,
        department: {
          select: { name: true },
        },
        designation: {
          select: { title: true },
        },
      },
      orderBy: { firstName: "asc" },
    });

    const separatedEmpIds: string[] = rawEmployees
      .filter((e) => ["RESIGNED", "TERMINATED", "EXIT"].includes(e.status))
      .map((e) => e.id);

    const statusHistories =
      separatedEmpIds.length > 0
        ? await prisma.employeeJobHistory.findMany({
            where: {
              employeeId: { in: separatedEmpIds },
              fieldChanged: "status",
            },
            orderBy: { effectiveDate: "desc" },
            select: {
              employeeId: true,
              newValue: true,
              effectiveDate: true,
            },
          })
        : [];

    const latestStatusHistoryMap = new Map<string, { effectiveDate: Date; newValue: string | null }>();
    for (const h of statusHistories) {
      if (!latestStatusHistoryMap.has(h.employeeId)) {
        latestStatusHistoryMap.set(h.employeeId, h);
      }
    }

    const monthStart: Date | null =
      month != null && year != null ? new Date(Date.UTC(year, month - 1, 1, 0, 0, 0)) : null;
    const monthEnd: Date | null =
      month != null && year != null ? new Date(Date.UTC(year, month, 1, 0, 0, 0)) : null;

    const eligibleList: PayrollEmployeeRecord[] = [];

    for (const emp of rawEmployees) {
      const isSeparated = ["RESIGNED", "TERMINATED", "EXIT"].includes(emp.status);
      let separationDate: Date | null = null;
      let separationType: "RESIGNED" | "TERMINATED" | "EXIT" | null = null;

      if (isSeparated) {
        const hist = latestStatusHistoryMap.get(emp.id);
        separationDate = hist?.effectiveDate ?? emp.updatedAt;
        separationType = emp.status as "RESIGNED" | "TERMINATED" | "EXIT";
      }

      // If month and year are specified, filter out employees who joined in future or separated in past
      if (monthStart != null && monthEnd != null) {
        // Employee joined strictly after the end of this month
        if (emp.dateOfJoining != null && emp.dateOfJoining >= monthEnd) {
          continue;
        }

        // Separated employee whose separation happened before the start of this month
        if (isSeparated && separationDate != null && separationDate < monthStart) {
          continue;
        }
      }

      eligibleList.push({
        id: emp.id,
        employeeCode: emp.employeeCode || "",
        name: `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || "Unknown",
        firstName: emp.firstName || "",
        lastName: emp.lastName || "",
        email: emp.email || "",
        phone: emp.phone || null,
        role: emp.role,
        status: emp.status,
        department: emp.department?.name || "General",
        designation: emp.designation?.title || "-",
        dateOfJoining: emp.dateOfJoining || null,
        separationDate,
        separationType,
      });
    }

    return eligibleList;
  } catch (error) {
    console.error("[PAYROLL_DB_ERROR] Failed to fetch eligible employees from table:", employeeSourceConfig.tableName, error);
    throw new Error(`Failed to load payroll employees from ${employeeSourceConfig.tableName}`);
  }
}

/**
 * Reads attendance records for the given employee ID list and date range using mapped columns.
 */
export async function getAttendanceLogsForMonth(
  prisma: PrismaClient,
  employeeIds: string[],
  startDate: Date,
  endDate: Date
): Promise<PayrollAttendanceRecord[]> {
  try {
    const logs = await prisma.attendanceLog.findMany({
      where: {
        employeeId: { in: employeeIds },
        date: {
          gte: startDate,
          lt: endDate,
        },
      },
      select: {
        id: true,
        employeeId: true,
        date: true,
        checkInTime: true,
        checkOutTime: true,
        totalHours: true,
        status: true,
      },
      orderBy: { date: "asc" },
    });

    return logs.map((log: any) => ({
      id: log.id,
      employeeId: log.employeeId,
      date: log.date,
      checkInTime: log.checkInTime,
      checkOutTime: log.checkOutTime,
      totalHours: log.totalHours,
      status: log.status,
    }));
  } catch (error) {
    console.error("[PAYROLL_DB_ERROR] Failed to fetch attendance logs from table:", attendanceSourceConfig.tableName, error);
    throw new Error(`Failed to load attendance logs from ${attendanceSourceConfig.tableName}`);
  }
}
