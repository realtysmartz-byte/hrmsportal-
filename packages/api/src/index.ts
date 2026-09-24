import { router } from "./trpc";
import { employeeRouter } from "./routers/employee";
import { departmentRouter } from "./routers/department";
import { designationRouter } from "./routers/designation";
import { attendanceRouter } from "./routers/attendance";
import { leaveRouter } from "./routers/leave";
import { companySettingsRouter } from "./routers/companySettings";
import { recruitmentRouter } from "./routers/recruitment";
import { performanceRouter } from "./routers/performance";

export const appRouter = router({
  employee: employeeRouter,
  department: departmentRouter,
  designation: designationRouter,
  attendance: attendanceRouter,
  leave: leaveRouter,
  companySettings: companySettingsRouter,
  recruitment: recruitmentRouter,
  performance: performanceRouter,
});

export type AppRouter = typeof appRouter;

export { createContext } from "./context";
export type {
  Context,
  Session,
  SessionUser,
  CreateContextOptions,
} from "./context";
