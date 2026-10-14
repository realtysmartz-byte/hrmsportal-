import { PrismaClient, Role, EmployeeStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Initializing Realty Smartz Private Limited HRMS in clean Production mode...");

  // 1. Purge all existing records
  console.log("Purging all demo records...");
  await prisma.keyResult.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.review.deleteMany();
  await prisma.performanceCycle.deleteMany();
  await prisma.locationPing.deleteMany();
  await prisma.employeeDocument.deleteMany();
  await prisma.employeeJobHistory.deleteMany();
  await prisma.candidateNote.deleteMany();
  await prisma.interviewRound.deleteMany();
  await prisma.candidate.deleteMany();
  await prisma.jobPosting.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.leaveBalance.deleteMany();
  await prisma.attendanceLog.deleteMany();
  await prisma.leaveType.deleteMany();
  await prisma.companySettings.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.designation.deleteMany();
  await prisma.department.deleteMany();

  // 2. Base Company Settings (REALTY SMARTZ PVT LTD)
  console.log("Setting up Company Settings...");
  await prisma.companySettings.create({
    data: {
      id: "singleton",
      officeName: "REALTY SMARTZ PVT LTD",
      officeLat: 28.3997196,
      officeLng: 77.0385682,
      geofenceRadiusM: 200,
      weeklyOffDay: 2, // Tuesday weekly off
    },
  });

  // 3. Standard Leave Types (18 Leaves Total: 9 Casual + 9 Sick)
  console.log("Creating standard leave types (18 leaves total)...");
  const casual = await prisma.leaveType.create({
    data: {
      name: "Casual Leave",
      annualQuota: 9,
      carryForwardAllowed: false,
      requiresApproval: true,
    },
  });
  const sick = await prisma.leaveType.create({
    data: {
      name: "Sick Leave",
      annualQuota: 9,
      carryForwardAllowed: false,
      requiresApproval: true,
    },
  });

  // 4. Standard Departments
  console.log("Creating departments...");
  const executiveDept = await prisma.department.create({
    data: { name: "Executive" },
  });
  const hrDept = await prisma.department.create({ data: { name: "Human Resources" } });
  await prisma.department.create({ data: { name: "Engineering" } });
  await prisma.department.create({ data: { name: "Sales" } });
  await prisma.department.create({ data: { name: "Finance" } });
  await prisma.department.create({ data: { name: "Marketing" } });
  await prisma.department.create({ data: { name: "Operations" } });

  // 5. Standard Designations
  console.log("Creating designations...");
  const ceo = await prisma.designation.create({
    data: { title: "Chief Executive Officer" },
  });
  const hrManagerDesig = await prisma.designation.create({ data: { title: "HR Manager" } });
  await prisma.designation.create({ data: { title: "Engineering Manager" } });
  await prisma.designation.create({ data: { title: "Sales Manager" } });
  await prisma.designation.create({ data: { title: "Software Engineer" } });
  await prisma.designation.create({ data: { title: "Sales Executive" } });
  await prisma.designation.create({ data: { title: "HR Executive" } });
  await prisma.designation.create({ data: { title: "Finance Executive" } });

  // 6. Exactly ONE Production HR Admin Employee
  console.log("Creating sole system administrator (HR Admin)...");
  const adminPasswordHash = await bcrypt.hash("HR@realty#$", 12);
  const now = new Date();
  const currentYear = now.getFullYear();

  const admin = await prisma.employee.create({
    data: {
      employeeCode: "RS-0001",
      firstName: "HR",
      lastName: "Admin",
      email: "hr@realtysmartz.in",
      passwordHash: adminPasswordHash,
      phone: "+91 98765 00001",
      role: Role.ADMIN,
      departmentId: hrDept.id,
      designationId: hrManagerDesig.id,
      dateOfJoining: now,
      dateOfBirth: new Date("1992-05-15"),
      address: "Realty Smartz HQ, Gurugram, Haryana",
      status: EmployeeStatus.ACTIVE,
    },
  });

  // 7. Initial Leave Balances for the Admin
  await prisma.leaveBalance.createMany({
    data: [
      {
        employeeId: admin.id,
        leaveTypeId: casual.id,
        year: currentYear,
        allotted: casual.annualQuota,
        used: 0,
        remaining: casual.annualQuota,
      },
      {
        employeeId: admin.id,
        leaveTypeId: sick.id,
        year: currentYear,
        allotted: sick.annualQuota,
        used: 0,
        remaining: sick.annualQuota,
      },
    ],
  });

  console.log("--------------------------------------------------");
  console.log("Production initialization complete!");
  console.log("Database contains ONLY 1 employee:");
  console.log(`Email:    hr@realtysmartz.in`);
  console.log(`Password: HR@realty#$`);
  console.log(`Role:     ADMIN (Full system access)`);
  console.log("All other demo records and seeded test data purged.");
  console.log("--------------------------------------------------");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
