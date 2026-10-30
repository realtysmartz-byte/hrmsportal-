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

/**
 * Reads all active employees eligible for payroll using the configured mappings.
 * Strictly excludes any Admin or HR accounts.
 */
export async function getEligiblePayrollEmployees(prisma: PrismaClient): Promise<PayrollEmployeeRecord[]> {
  try {
    const rawEmployees = await prisma.employee.findMany({
      where: {
        role: { in: [...employeeSourceConfig.filters.allowedRoles] as any },
        status: { in: [...employeeSourceConfig.filters.activeStatuses] as any },
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
        department: {
          select: { name: true },
        },
      },
      orderBy: { firstName: "asc" },
    });

      return rawEmployees.map((emp: any) => ({
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
      }));
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

