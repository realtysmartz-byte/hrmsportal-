import { z } from "zod";
import { EMPLOYEE_STATUSES, ROLES } from "../constants";

export const loginSchema = z.object({
  email: z.string().trim().email("Invalid email address").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(128),
});

export const DOCUMENT_TYPES = [
  "PAN_CARD",
  "AADHAR_CARD",
  "OFFER_LETTER",
  "EDUCATIONAL_CERTIFICATE",
  "OTHER",
] as const;

export const createEmployeeSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  email: z.string().trim().email("Invalid email address").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(128),
  phone: z.string().trim().max(30).optional().nullable(),
  gender: z.string().trim().max(30).optional().nullable(),
  emergencyContactName: z.string().trim().max(100).optional().nullable(),
  emergencyContactPhone: z.string().trim().max(30).optional().nullable(),
  role: z.enum(ROLES).default("EMPLOYEE"),
  designationId: z.string().max(100).optional().nullable(),
  departmentId: z.string().max(100).optional().nullable(),
  managerId: z.string().max(100).optional().nullable(),
  dateOfJoining: z.coerce.date().optional().nullable(),
  dateOfBirth: z.coerce.date().optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  profilePhotoUrl: z
    .union([z.string().url().max(2048), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  status: z.enum(EMPLOYEE_STATUSES).default("ACTIVE"),
  workLocationLat: z.number().min(-90).max(90).optional().nullable(),
  workLocationLng: z.number().min(-180).max(180).optional().nullable(),
  workLocationName: z.string().trim().max(200).optional().nullable(),
});

export const updateEmployeeSchema = createEmployeeSchema
  .omit({ password: true })
  .extend({
    password: z
      .string()
      .min(6, "Password must be at least 6 characters")
      .max(128)
      .optional()
      .or(z.literal("")),
  })
  .partial()
  .extend({
    id: z.string().min(1).max(100),
  });

export const employeeListFilterSchema = z.object({
  search: z.string().trim().max(100).optional(),
  departmentId: z.string().max(100).optional(),
  status: z.enum(EMPLOYEE_STATUSES).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

export const createDepartmentSchema = z.object({
  name: z.string().trim().min(1, "Department name is required").max(100),
});

export const updateDepartmentSchema = createDepartmentSchema.extend({
  id: z.string().min(1).max(100),
});

export const createDesignationSchema = z.object({
  title: z.string().trim().min(1, "Designation title is required").max(100),
});

export const updateDesignationSchema = createDesignationSchema.extend({
  id: z.string().min(1).max(100),
});

export const checkInOutSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: z.string().trim().min(1).max(500),
});

export const myAttendanceMonthSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
});

export const teamAttendanceSchema = z.object({
  date: z.coerce.date().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  departmentId: z.string().max(100).optional(),
  outsideGeofenceOnly: z.boolean().optional(),
});

export const updateCompanySettingsSchema = z.object({
  officeName: z.string().trim().min(1, "Office name required").max(200),
  officeLat: z.number().min(-90).max(90),
  officeLng: z.number().min(-180).max(180),
  geofenceRadiusM: z.number().int().min(50).max(5000),
  weeklyOffDay: z.number().int().min(0).max(6).optional(),
});

export const locationPingSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: z.string().trim().max(500).optional().nullable(),
  accuracyM: z.number().min(0).max(50000).optional().nullable(),
});

export const createLeaveTypeSchema = z.object({
  name: z.string().trim().min(1).max(100),
  annualQuota: z.number().int().min(0).max(365),
  carryForwardAllowed: z.boolean().default(false),
  requiresApproval: z.boolean().default(true),
});

export const updateLeaveTypeSchema = createLeaveTypeSchema.extend({
  id: z.string().min(1).max(100),
});

export const applyLeaveSchema = z
  .object({
    leaveTypeId: z.string().min(1).max(100),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    reason: z.string().trim().min(3, "Reason must be at least 3 characters").max(1000),
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: "End date must be on or after start date",
    path: ["endDate"],
  });

export const respondLeaveSchema = z.object({
  id: z.string().min(1).max(100),
  action: z.enum(["APPROVE", "REJECT"]),
  approverNote: z.string().trim().max(500).optional().nullable(),
});

export const adjustLeaveBalanceSchema = z.object({
  employeeId: z.string().min(1).max(100),
  leaveTypeId: z.string().min(1).max(100),
  year: z.number().int().min(2000).max(2100).optional(),
  allotted: z.number().min(0).max(365),
  reason: z.string().trim().min(3).max(500),
});

export const uploadEmployeeDocumentSchema = z.object({
  employeeId: z.string().min(1).max(100),
  documentType: z.enum(DOCUMENT_TYPES),
  title: z.string().trim().max(200).optional().nullable(),
  fileUrl: z.string().min(1).max(8000000),
});

export const employeeAttendanceSchema = z.object({
  employeeId: z.string().min(1).max(100),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
});

export const employeeAttendanceHistorySchema = z.object({
  employeeId: z.string().min(1),
  year: z.number().int().optional(),
  month: z.number().int().min(1).max(12).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type EmployeeListFilter = z.infer<typeof employeeListFilterSchema>;
export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;
export type CreateDesignationInput = z.infer<typeof createDesignationSchema>;
export type UpdateDesignationInput = z.infer<typeof updateDesignationSchema>;
export type CheckInOutInput = z.infer<typeof checkInOutSchema>;
export type UpdateCompanySettingsInput = z.infer<typeof updateCompanySettingsSchema>;
export type CreateLeaveTypeInput = z.infer<typeof createLeaveTypeSchema>;
export type UpdateLeaveTypeInput = z.infer<typeof updateLeaveTypeSchema>;
export type ApplyLeaveInput = z.infer<typeof applyLeaveSchema>;
export type RespondLeaveInput = z.infer<typeof respondLeaveSchema>;
export type AdjustLeaveBalanceInput = z.infer<typeof adjustLeaveBalanceSchema>;
export type UploadEmployeeDocumentInput = z.infer<
  typeof uploadEmployeeDocumentSchema
>;
