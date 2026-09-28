import { PrismaClient, Role, EmployeeStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("=== RESETTING DATABASE EMPLOYEES FOR PRODUCTION ===");

  // 1. Delete dependent child records
  console.log("Cleaning test attendance logs, leave records, location pings...");
  await prisma.attendanceLog.deleteMany({});
  await prisma.leaveRequest.deleteMany({});
  await prisma.leaveBalance.deleteMany({});
  await prisma.locationPing.deleteMany({});
  await prisma.employeeDocument.deleteMany({});
  await prisma.employeeJobHistory.deleteMany({});
  await prisma.interviewRound.deleteMany({});
  await prisma.candidateNote.deleteMany({});
  await prisma.candidate.deleteMany({});
  await prisma.review.deleteMany({});
  await prisma.goal.deleteMany({});

  // 2. Clear any manager self-relations
  await prisma.employee.updateMany({
    data: { managerId: null },
  });

  // 3. Delete all old test employees
  const deleted = await prisma.employee.deleteMany({});
  console.log(`Deleted ${deleted.count} old test employees.`);

  // 4. Find HR department and designation
  let hrDept = await prisma.department.findUnique({
    where: { name: "Human Resources" },
  });
  if (!hrDept) {
    hrDept = await prisma.department.create({ data: { name: "Human Resources" } });
  }

  let hrManagerDesig = await prisma.designation.findUnique({
    where: { title: "HR Manager" },
  });
  if (!hrManagerDesig) {
    hrManagerDesig = await prisma.designation.create({ data: { title: "HR Manager" } });
  }

  // 5. Create the official HR Admin
  console.log("Creating new production HR Admin: hr@realtysmartz.in ...");
  const password = "HR@realty#$";
  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date();

  const hrAdmin = await prisma.employee.create({
    data: {
      employeeCode: "RS-0001",
      firstName: "HR",
      lastName: "Admin",
      email: "hr@realtysmartz.in",
      passwordHash,
      phone: "+91 98765 00001",
      role: Role.ADMIN,
      departmentId: hrDept.id,
      designationId: hrManagerDesig.id,
      dateOfJoining: now,
      dateOfBirth: new Date("1992-05-15"),
      address: "Realty Smartz HQ, Gurugram, Haryana",
      status: EmployeeStatus.ACTIVE,
      workLocationName: "Realty Smartz Private Limited HQ, Gurugram",
      workLocationLat: 28.4595,
      workLocationLng: 77.0266,
    },
  });

  // 6. Allocate Leave Balances for the HR Admin
  const leaveTypes = await prisma.leaveType.findMany();
  const currentYear = now.getFullYear();
  if (leaveTypes.length > 0) {
    await prisma.leaveBalance.createMany({
      data: leaveTypes.map((lt) => ({
        employeeId: hrAdmin.id,
        leaveTypeId: lt.id,
        year: currentYear,
        allotted: lt.annualQuota,
        used: 0,
        remaining: lt.annualQuota,
      })),
      skipDuplicates: true,
    });
  }

  // 7. Verification test
  const verify = await bcrypt.compare(password, hrAdmin.passwordHash);
  console.log("=== SETUP COMPLETE ===");
  console.log({
    id: hrAdmin.id,
    employeeCode: hrAdmin.employeeCode,
    name: `${hrAdmin.firstName} ${hrAdmin.lastName}`,
    email: hrAdmin.email,
    role: hrAdmin.role,
    passwordMatch: verify ? "PASSED (Login verified)" : "FAILED",
  });
}

main()
  .catch((e) => {
    console.error("Migration error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
