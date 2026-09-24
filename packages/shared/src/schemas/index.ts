import { z } from "zod";
import { EMPLOYEE_STATUSES, ROLES } from "../constants";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const DOCUMENT_TYPES = [
  "PAN_CARD",
  "AADHAR_CARD",
  "OFFER_LETTER",
  "EDUCATIONAL_CERTIFICATE",
  "OTHER",
] as const;

export const createEmployeeSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  phone: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  emergencyContactName: z.string().optional().nullable(),
  emergencyContactPhone: z.string().optional().nullable(),
  role: z.enum(ROLES).default("EMPLOYEE"),
  designationId: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  managerId: z.string().optional().nullable(),
  dateOfJoining: z.coerce.date().optional().nullable(),
  dateOfBirth: z.coerce.date().optional().nullable(),
  address: z.string().optional().nullable(),
  profilePhotoUrl: z
    .union([z.string().url(), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  status: z.enum(EMPLOYEE_STATUSES).default("ACTIVE"),
  workLocationLat: z.number().optional().nullable(),
  workLocationLng: z.number().optional().nullable(),
  workLocationName: z.string().optional().nullable(),
});

export const updateEmployeeSchema = createEmployeeSchema
  .omit({ password: true })
  .extend({
    password: z
      .string()
      .min(6, "Password must be at least 6 characters")
      .optional()
      .or(z.literal("")),
  })
  .partial()
  .extend({
    id: z.string().min(1),
  });

export const employeeListFilterSchema = z.object({
  search: z.string().optional(),
  departmentId: z.string().optional(),
  status: z.enum(EMPLOYEE_STATUSES).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

export const createDepartmentSchema = z.object({
  name: z.string().min(1, "Department name is required").max(100),
});

export const updateDepartmentSchema = createDepartmentSchema.extend({
  id: z.string().min(1),
});

export const createDesignationSchema = z.object({
  title: z.string().min(1, "Designation title is required").max(100),
});

export const updateDesignationSchema = createDesignationSchema.extend({
  id: z.string().min(1),
});

export const checkInOutSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: z.string().min(1),
});

export const myAttendanceMonthSchema = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
});

export const teamAttendanceSchema = z.object({
  date: z.coerce.date().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  departmentId: z.string().optional(),
  outsideGeofenceOnly: z.boolean().optional(),
});

export const updateCompanySettingsSchema = z.object({
  officeName: z.string().min(1).max(200),
  officeLat: z.number().min(-90).max(90),
  officeLng: z.number().min(-180).max(180),
  geofenceRadiusM: z.number().int().min(50).max(5000),
  weeklyOffDay: z.number().int().min(0).max(6).optional(),
});

export const locationPingSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: z.string().max(500).optional().nullable(),
  accuracyM: z.number().min(0).optional().nullable(),
});

export const createLeaveTypeSchema = z.object({
  name: z.string().min(1).max(100),
  annualQuota: z.number().int().min(0).max(365),
  carryForwardAllowed: z.boolean().default(false),
  requiresApproval: z.boolean().default(true),
});

export const updateLeaveTypeSchema = createLeaveTypeSchema.extend({
  id: z.string().min(1),
});

export const applyLeaveSchema = z
  .object({
    leaveTypeId: z.string().min(1),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    reason: z.string().min(3).max(1000),
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: "End date must be on or after start date",
    path: ["endDate"],
  });

export const respondLeaveSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["APPROVE", "REJECT"]),
  approverNote: z.string().max(500).optional().nullable(),
});

export const adjustLeaveBalanceSchema = z.object({
  employeeId: z.string().min(1),
  leaveTypeId: z.string().min(1),
  year: z.number().int().optional(),
  allotted: z.number().min(0).max(365),
  reason: z.string().min(3).max(500),
});

export const uploadEmployeeDocumentSchema = z.object({
  employeeId: z.string().min(1),
  documentType: z.enum(DOCUMENT_TYPES),
  title: z.string().max(200).optional().nullable(),
  fileUrl: z.string().min(1),
});

export const employeeAttendanceSchema = z.object({
  employeeId: z.string().min(1),
  year: z.number().int(),
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
