import { router } from "./trpc";
import { employeeRouter } from "./routers/employee";
import { departmentRouter } from "./routers/department";
import { designationRouter } from "./routers/designation";
import { attendanceRouter } from "./routers/attendance";
import { leaveRouter } from "./routers/leave";
import { companySettingsRouter } from "./routers/companySettings";
import { recruitmentRouter } from "./routers/recruitment";
import { performanceRouter } from "./routers/performance";
import { googleSheetsRouter } from "./routers/googleSheets";
import { emailSettingsRouter } from "./routers/emailSettings";

export const appRouter = router({
  employee: employeeRouter,
  department: departmentRouter,
  designation: designationRouter,
  attendance: attendanceRouter,
  leave: leaveRouter,
  companySettings: companySettingsRouter,
  recruitment: recruitmentRouter,
  performance: performanceRouter,
  googleSheets: googleSheetsRouter,
  emailSettings: emailSettingsRouter,
});

export type AppRouter = typeof appRouter;

export { createContext } from "./context";
export {
  getEffectiveWorkLocation,
  distanceToWorkLocationM,
} from "./lib/work-location";
export type { EffectiveWorkLocation } from "./lib/work-location";
export type {
  Context,
  Session,
  SessionUser,
  CreateContextOptions,
} from "./context";

export {
  generateDailyAttendanceData,
  syncReportToGoogleSheet,
  type GoogleSheetConfig,
  type DailyReportRow,
} from "./lib/google-sheets";
export {
  getActiveGoogleSheetConfig,
  setLastSyncMetadata,
} from "./routers/googleSheets";
export {
  sendMail,
  notifyWelcomeEmployee,
  notifyPunchDetails,
  notifyCheckOutDetails,
  notifyLatePunch,
  notifyOutsideGeofence,
  testSmtpConnection,
  getSmtpConfig,
} from "./lib/email";

export { ensureAutoPunchOut } from "./lib/attendance-auto";

