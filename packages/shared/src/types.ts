import type { EmployeeStatus, Role } from "./constants";

export type EmployeeSummary = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: Role;
  status: EmployeeStatus;
  profilePhotoUrl: string | null;
  department: { id: string; name: string } | null;
  designation: { id: string; title: string } | null;
  manager: {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode: string;
  } | null;
};


export type DashboardStats = {
  totalEmployees: number;
  departmentCount: number;
  recentJoiners: EmployeeSummary[];
};
