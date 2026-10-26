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
  employeeCode: z
    .string()
    .trim()
    .max(30)
    .regex(/^[A-Za-z0-9_-]*$/, "Employee ID can only contain letters, numbers, - and _")
    .optional()
    .transform((v) => (v ? v.toUpperCase() : undefined)),
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  email: z.string().trim().email("Invalid email address").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(128),
  phone: z.string().trim().max(30).optional().nullable(),
  gender: z.string().trim().max(30).optional().nullable(),
  emergencyContactName: z.string().trim().max(100).optional().nullable(),
  emergencyContactPhone: z.string().trim().max(30).optional().nullable(),
  bloodGroup: z.string().trim().max(5).optional().nullable(),
  role: z.enum(ROLES).default("EMPLOYEE"),
  designationId: z.string().max(100).optional().nullable(),
  departmentId: z.string().max(100).optional().nullable(),
  managerId: z.string().max(100).optional().nullable(),
  dateOfJoining: z.coerce.date().optional().nullable(),
  dateOfBirth: z.coerce.date().optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  profilePhotoUrl: z
    .union([
      z.string().url().max(2048),
      z
        .string()
        .max(200_000, "Photo is too large")
        .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, "Invalid photo"),
      z.literal(""),
      z.null(),
    ])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  status: z.enum(EMPLOYEE_STATUSES).default("ACTIVE"),
  workLocationLat: z.number().min(-90).max(90).optional().nullable(),
  workLocationLng: z.number().min(-180).max(180).optional().nullable(),
  workLocationName: z.string().trim().max(200).optional().nullable(),
  assignedLocations: z
    .array(
      z.object({
        name: z.string().trim().max(200),
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      })
    )
    .max(3)
    .optional()
    .nullable(),
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
    statusEffectiveDate: z.coerce.date().optional().nullable(),
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
  /** Client hint only — server overwrites with geofence/site name */
  address: z.string().trim().min(1).max(500),
  accuracyM: z.number().positive().lt(50_000),
  fixTimestamp: z.coerce.date(),
  isMockLocation: z.boolean().optional(),
}).superRefine((val, ctx) => {
  const t = val.fixTimestamp.getTime();
  const now = Date.now();
  const allowedClockSkewMs = 2 * 60_000;
  if (t > now + allowedClockSkewMs) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Location fix timestamp is more than 2 minutes in the future",
      path: ["fixTimestamp"],
    });
  } else if (now - t > 5 * 60_000) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Location fix is older than 5 minutes — refresh GPS and try again",
      path: ["fixTimestamp"],
    });
  }
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
  accuracyM: z.number().positive().lt(50_000),
  capturedAt: z.coerce.date(),
}).superRefine((val, ctx) => {
  const timestamp = val.capturedAt.getTime();
  const now = Date.now();
  if (timestamp > now) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Location fix timestamp cannot be in the future",
      path: ["capturedAt"],
    });
  } else if (now - timestamp > 5 * 60_000) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Location fix is older than 5 minutes — refresh GPS and try again",
      path: ["capturedAt"],
    });
  }
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
    isHalfDay: z.boolean().optional().default(false),
    halfDaySlot: z.enum(["FIRST_HALF", "SECOND_HALF"]).optional().nullable(),
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

export const holidayTypeSchema = z.enum(["PUBLIC", "RESTRICTED", "COMPANY"]);

export const createHolidaySchema = z.object({
  name: z.string().trim().min(1, "Holiday name is required").max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  type: holidayTypeSchema.default("PUBLIC"),
  description: z.string().trim().max(300).optional().nullable(),
});

export const announceHolidaysSchema = z.object({
  name: z.string().trim().min(1, "Holiday name is required").max(100),
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")).min(1, "At least one date is required"),
  type: holidayTypeSchema.default("PUBLIC"),
  description: z.string().trim().max(300).optional().nullable(),
});

export const updateHolidaySchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, "Holiday name is required").max(100).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").optional(),
  type: holidayTypeSchema.optional(),
  description: z.string().trim().max(300).optional().nullable(),
});

export type AnnounceHolidaysInput = z.infer<typeof announceHolidaysSchema>;
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
export type CreateHolidayInput = z.infer<typeof createHolidaySchema>;
export type UpdateHolidayInput = z.infer<typeof updateHolidaySchema>;
