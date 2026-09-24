import { PrismaClient, Role, EmployeeStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Realty Smartz HRMS...");

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

  // PLACEHOLDER — update real office coords via /settings/company
  // Approx. Cyber City / Golf Course Road, Gurugram
  await prisma.companySettings.create({
    data: {
      id: "singleton",
      officeName: "Realty Smartz HQ, Gurugram",
      officeLat: 28.4595,
      officeLng: 77.0266,
      geofenceRadiusM: 200,
    },
  });

  const casual = await prisma.leaveType.create({
    data: {
      name: "Casual Leave",
      annualQuota: 12,
      carryForwardAllowed: false,
      requiresApproval: true,
    },
  });
  const sick = await prisma.leaveType.create({
    data: {
      name: "Sick Leave",
      annualQuota: 8,
      carryForwardAllowed: false,
      requiresApproval: true,
    },
  });
  const earned = await prisma.leaveType.create({
    data: {
      name: "Earned Leave",
      annualQuota: 15,
      carryForwardAllowed: true,
      requiresApproval: true,
    },
  });

  const engineering = await prisma.department.create({
    data: { name: "Engineering" },
  });
  const sales = await prisma.department.create({
    data: { name: "Sales" },
  });
  const hrDept = await prisma.department.create({
    data: { name: "Human Resources" },
  });

  const ceo = await prisma.designation.create({
    data: { title: "Chief Executive Officer" },
  });
  const hrManager = await prisma.designation.create({
    data: { title: "HR Manager" },
  });
  const engManager = await prisma.designation.create({
    data: { title: "Engineering Manager" },
  });
  const salesManager = await prisma.designation.create({
    data: { title: "Sales Manager" },
  });
  const softwareEngineer = await prisma.designation.create({
    data: { title: "Software Engineer" },
  });
  const salesExecutive = await prisma.designation.create({
    data: { title: "Sales Executive" },
  });
  const hrExecutive = await prisma.designation.create({
    data: { title: "HR Executive" },
  });

  const passwordHash = await bcrypt.hash("Admin@123", 12);
  const empPassword = await bcrypt.hash("Employee@123", 12);

  const admin = await prisma.employee.create({
    data: {
      employeeCode: "RS-0001",
      firstName: "Rajesh",
      lastName: "Sharma",
      email: "admin@realtysmartz.com",
      passwordHash,
      phone: "+91 98765 00001",
      role: Role.ADMIN,
      designationId: ceo.id,
      departmentId: hrDept.id,
      dateOfJoining: new Date("2020-01-15"),
      dateOfBirth: new Date("1985-03-20"),
      address: "Gurugram, Haryana",
      status: EmployeeStatus.ACTIVE,
      workLocationName: "Realty Smartz HQ, Gurugram",
      workLocationLat: 28.4595,
      workLocationLng: 77.0266,
    },
  });

  const hr = await prisma.employee.create({
    data: {
      employeeCode: "RS-0002",
      firstName: "Priya",
      lastName: "Mehta",
      email: "hr@realtysmartz.com",
      passwordHash: empPassword,
      phone: "+91 98765 00002",
      role: Role.HR,
      designationId: hrManager.id,
      departmentId: hrDept.id,
      managerId: admin.id,
      dateOfJoining: new Date("2021-03-01"),
      dateOfBirth: new Date("1990-07-12"),
      address: "Gurugram, Haryana",
      status: EmployeeStatus.ACTIVE,
      workLocationName: "Realty Smartz HQ, Gurugram",
      workLocationLat: 28.4595,
      workLocationLng: 77.0266,
    },
  });

  const engLead = await prisma.employee.create({
    data: {
      employeeCode: "RS-0003",
      firstName: "Amit",
      lastName: "Verma",
      email: "amit.verma@realtysmartz.com",
      passwordHash: empPassword,
      phone: "+91 98765 00003",
      role: Role.MANAGER,
      designationId: engManager.id,
      departmentId: engineering.id,
      managerId: admin.id,
      dateOfJoining: new Date("2021-06-15"),
      dateOfBirth: new Date("1988-11-05"),
      address: "Noida, Uttar Pradesh",
      status: EmployeeStatus.ACTIVE,
      workLocationName: "Realty Smartz HQ, Gurugram",
      workLocationLat: 28.4595,
      workLocationLng: 77.0266,
    },
  });

  const salesLead = await prisma.employee.create({
    data: {
      employeeCode: "RS-0004",
      firstName: "Neha",
      lastName: "Kapoor",
      email: "neha.kapoor@realtysmartz.com",
      passwordHash: empPassword,
      phone: "+91 98765 00004",
      role: Role.MANAGER,
      designationId: salesManager.id,
      departmentId: sales.id,
      managerId: admin.id,
      dateOfJoining: new Date("2021-08-01"),
      dateOfBirth: new Date("1991-02-28"),
      address: "Delhi",
      status: EmployeeStatus.ACTIVE,
      workLocationName: "Realty Smartz HQ, Gurugram",
      workLocationLat: 28.4595,
      workLocationLng: 77.0266,
    },
  });

  await prisma.employee.createMany({
    data: [
      {
        employeeCode: "RS-0005",
        firstName: "Rohan",
        lastName: "Singh",
        email: "rohan.singh@realtysmartz.com",
        passwordHash: empPassword,
        phone: "+91 98765 00005",
        role: Role.EMPLOYEE,
        designationId: softwareEngineer.id,
        departmentId: engineering.id,
        managerId: engLead.id,
        dateOfJoining: new Date("2023-01-10"),
        dateOfBirth: new Date("1995-09-18"),
        address: "Gurugram, Haryana",
        status: EmployeeStatus.ACTIVE,
        workLocationName: "Realty Smartz HQ, Gurugram",
        workLocationLat: 28.4595,
        workLocationLng: 77.0266,
      },
      {
        employeeCode: "RS-0006",
        firstName: "Ananya",
        lastName: "Gupta",
        email: "ananya.gupta@realtysmartz.com",
        passwordHash: empPassword,
        phone: "+91 98765 00006",
        role: Role.EMPLOYEE,
        designationId: softwareEngineer.id,
        departmentId: engineering.id,
        managerId: engLead.id,
        dateOfJoining: new Date("2023-04-20"),
        dateOfBirth: new Date("1996-12-03"),
        address: "Gurugram, Haryana",
        status: EmployeeStatus.ACTIVE,
        workLocationName: "Realty Smartz HQ, Gurugram",
        workLocationLat: 28.4595,
        workLocationLng: 77.0266,
      },
      {
        employeeCode: "RS-0007",
        firstName: "Vikram",
        lastName: "Malhotra",
        email: "vikram.malhotra@realtysmartz.com",
        passwordHash: empPassword,
        phone: "+91 98765 00007",
        role: Role.EMPLOYEE,
        designationId: salesExecutive.id,
        departmentId: sales.id,
        managerId: salesLead.id,
        dateOfJoining: new Date("2022-11-05"),
        dateOfBirth: new Date("1993-05-22"),
        address: "Faridabad, Haryana",
        status: EmployeeStatus.ACTIVE,
        workLocationName: "Realty Smartz HQ, Gurugram",
        workLocationLat: 28.4595,
        workLocationLng: 77.0266,
      },
      {
        employeeCode: "RS-0008",
        firstName: "Sneha",
        lastName: "Patel",
        email: "sneha.patel@realtysmartz.com",
        passwordHash: empPassword,
        phone: "+91 98765 00008",
        role: Role.EMPLOYEE,
        designationId: salesExecutive.id,
        departmentId: sales.id,
        managerId: salesLead.id,
        dateOfJoining: new Date("2024-02-15"),
        dateOfBirth: new Date("1997-08-14"),
        address: "Gurugram, Haryana",
        status: EmployeeStatus.ACTIVE,
        workLocationName: "Realty Smartz HQ, Gurugram",
        workLocationLat: 28.4595,
        workLocationLng: 77.0266,
      },
      {
        employeeCode: "RS-0009",
        firstName: "Kavita",
        lastName: "Joshi",
        email: "kavita.joshi@realtysmartz.com",
        passwordHash: empPassword,
        phone: "+91 98765 00009",
        role: Role.EMPLOYEE,
        designationId: hrExecutive.id,
        departmentId: hrDept.id,
        managerId: hr.id,
        dateOfJoining: new Date("2024-06-01"),
        dateOfBirth: new Date("1994-01-30"),
        address: "Gurugram, Haryana",
        status: EmployeeStatus.ON_LEAVE,
        workLocationName: "Realty Smartz HQ, Gurugram",
        workLocationLat: 28.4595,
        workLocationLng: 77.0266,
      },
    ],
  });

  const allEmployees = await prisma.employee.findMany({ select: { id: true } });
  const year = new Date().getFullYear();
  const leaveTypes = [casual, sick, earned];

  await prisma.leaveBalance.createMany({
    data: allEmployees.flatMap((e) =>
      leaveTypes.map((lt) => ({
        employeeId: e.id,
        leaveTypeId: lt.id,
        year,
        allotted: lt.annualQuota,
        used: 0,
        remaining: lt.annualQuota,
      }))
    ),
  });

  const rohan = await prisma.employee.findUnique({
    where: { email: "rohan.singh@realtysmartz.com" },
  });
  const ananya = await prisma.employee.findUnique({
    where: { email: "ananya.gupta@realtysmartz.com" },
  });
  const kavita = await prisma.employee.findUnique({
    where: { email: "kavita.joshi@realtysmartz.com" },
  });

  // Demo attendance logs (past few weekdays)
  if (rohan && ananya) {
    const today = new Date();
    const daysBack = [1, 2, 3, 4];
    for (const offset of daysBack) {
      const d = new Date(today);
      d.setDate(d.getDate() - offset);
      if (d.getDay() === 2) continue; // Tuesday weekly off

      const dateOnly = new Date(
        Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
      );
      const checkIn = new Date(d);
      checkIn.setHours(9, 15 + offset, 0, 0);
      const checkOut = new Date(d);
      checkOut.setHours(18, 0, 0, 0);

      await prisma.attendanceLog.create({
        data: {
          employeeId: rohan.id,
          date: dateOnly,
          checkInTime: checkIn,
          checkInLat: 28.4595,
          checkInLng: 77.0266,
          checkInAddress: "Realty Smartz HQ, Gurugram",
          checkOutTime: checkOut,
          checkOutLat: 28.4595,
          checkOutLng: 77.0266,
          checkOutAddress: "Realty Smartz HQ, Gurugram",
          status: offset === 2 ? "LATE" : "PRESENT",
          withinGeofence: true,
          totalHours: 8.5,
        },
      });

      await prisma.attendanceLog.create({
        data: {
          employeeId: ananya.id,
          date: dateOnly,
          checkInTime: checkIn,
          checkInLat: 28.5,
          checkInLng: 77.1,
          checkInAddress: "Client site, Gurugram",
          checkOutTime: checkOut,
          checkOutLat: 28.5,
          checkOutLng: 77.1,
          checkOutAddress: "Client site, Gurugram",
          status: "PRESENT",
          withinGeofence: false,
          totalHours: 8.25,
          notes: "Outside geofence (~6km from office)",
        },
      });
    }
  }

  // Demo leave request
  if (kavita && hr) {
    const start = new Date();
    start.setDate(start.getDate() - 1);
    const end = new Date();
    end.setDate(end.getDate() + 1);
    const startDate = new Date(
      Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())
    );
    const endDate = new Date(
      Date.UTC(end.getFullYear(), end.getMonth(), end.getDate())
    );

    const leaveReq = await prisma.leaveRequest.create({
      data: {
        employeeId: kavita.id,
        leaveTypeId: sick.id,
        startDate,
        endDate,
        numberOfDays: 2,
        reason: "Medical rest as advised by doctor",
        status: "APPROVED",
        approvedById: hr.id,
        respondedAt: new Date(),
      },
    });

    await prisma.leaveBalance.updateMany({
      where: {
        employeeId: kavita.id,
        leaveTypeId: sick.id,
        year,
      },
      data: { used: 2, remaining: 6 },
    });

    for (const day of [startDate, endDate]) {
      if (day.getUTCDay() === 2) continue; // Tuesday weekly off

      await prisma.attendanceLog.upsert({
        where: {
          employeeId_date: { employeeId: kavita.id, date: day },
        },
        create: {
          employeeId: kavita.id,
          date: day,
          status: "ON_LEAVE",
          withinGeofence: true,
          notes: `Leave ${leaveReq.id}`,
        },
        update: { status: "ON_LEAVE" },
      });
    }

    if (rohan) {
      await prisma.leaveRequest.create({
        data: {
          employeeId: rohan.id,
          leaveTypeId: casual.id,
          startDate: new Date(
            Date.UTC(year, new Date().getMonth(), new Date().getDate() + 7)
          ),
          endDate: new Date(
            Date.UTC(year, new Date().getMonth(), new Date().getDate() + 8)
          ),
          numberOfDays: 2,
          reason: "Family function",
          status: "PENDING",
        },
      });
    }
  }

  // Phase 3 — Recruitment demo
  const jobFe = await prisma.jobPosting.create({
    data: {
      title: "Senior Frontend Engineer",
      departmentId: engineering.id,
      description:
        "Build the Realty Smartz HRMS and property platforms with Next.js.",
      requirements: "5+ years React/TypeScript, strong UI craft.",
      location: "Gurugram",
      employmentType: "FULL_TIME",
      status: "OPEN",
      postedById: hr.id,
    },
  });
  const jobSales = await prisma.jobPosting.create({
    data: {
      title: "Sales Executive — Residential",
      departmentId: sales.id,
      description: "Drive residential property sales across NCR.",
      requirements: "2+ years real-estate sales experience preferred.",
      location: "Gurugram",
      employmentType: "FULL_TIME",
      status: "OPEN",
      postedById: hr.id,
    },
  });
  await prisma.jobPosting.create({
    data: {
      title: "HR Intern",
      departmentId: hrDept.id,
      description: "Support HR operations and recruitment coordination.",
      requirements: "Graduate; interest in people ops.",
      location: "Gurugram",
      employmentType: "INTERNSHIP",
      status: "ON_HOLD",
      postedById: admin.id,
    },
  });

  const cand1 = await prisma.candidate.create({
    data: {
      jobPostingId: jobFe.id,
      fullName: "Arjun Nair",
      email: "arjun.nair@example.com",
      phone: "+91 98000 11111",
      source: "LINKEDIN",
      currentStage: "SCREENING",
      resumeUrl: "https://example.com/resumes/arjun-nair.pdf",
    },
  });
  await prisma.candidate.create({
    data: {
      jobPostingId: jobFe.id,
      fullName: "Meera Iyer",
      email: "meera.iyer@example.com",
      phone: "+91 98000 22222",
      source: "REFERRAL",
      referredById: engLead.id,
      currentStage: "INTERVIEW",
    },
  });
  await prisma.candidate.create({
    data: {
      jobPostingId: jobSales.id,
      fullName: "Kabir Khan",
      email: "kabir.khan@example.com",
      phone: "+91 98000 33333",
      source: "DIRECT",
      currentStage: "OFFER",
    },
  });
  await prisma.candidate.create({
    data: {
      jobPostingId: jobSales.id,
      fullName: "Isha Rao",
      email: "isha.rao@example.com",
      phone: "+91 98000 44444",
      source: "JOB_BOARD",
      currentStage: "APPLIED",
    },
  });

  await prisma.interviewRound.create({
    data: {
      candidateId: cand1.id,
      roundName: "Technical Round 1",
      interviewerId: engLead.id,
      scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      status: "SCHEDULED",
    },
  });

  // ----------------------------------------------------------------
  // Performance Management Seeds
  // ----------------------------------------------------------------
  console.log("Seeding Performance Management cycles...");

  const closedCycle = await prisma.performanceCycle.create({
    data: {
      name: "H2 2025 Annual Review",
      cycleType: "APPRAISAL",
      startDate: new Date("2025-07-01"),
      endDate: new Date("2025-12-31"),
      status: "CLOSED",
      createdById: admin.id,
    },
  });

  if (rohan) {
    await prisma.goal.create({
      data: {
        cycleId: closedCycle.id,
        employeeId: rohan.id,
        title: "Build client portal authentication and session sync",
        category: "INDIVIDUAL",
        targetValue: "100% test coverage",
        progressPercent: 100,
        status: "COMPLETED",
      },
    });

    await prisma.goal.create({
      data: {
        cycleId: closedCycle.id,
        employeeId: rohan.id,
        title: "Refactor legacy geofencing calculations",
        category: "TEAM",
        targetValue: "<50ms response",
        progressPercent: 100,
        status: "COMPLETED",
      },
    });

    await prisma.review.create({
      data: {
        cycleId: closedCycle.id,
        employeeId: rohan.id,
        reviewerId: rohan.id,
        reviewType: "SELF",
        rating: 4,
        strengths:
          "Delivered authentication module ahead of schedule; resolved session stability bugs.",
        improvements: "Need to write more end-to-end integration tests.",
        comments:
          "Looking forward to taking on tech lead responsibilities in 2026.",
        status: "SUBMITTED",
        submittedAt: new Date("2025-12-20"),
      },
    });

    await prisma.review.create({
      data: {
        cycleId: closedCycle.id,
        employeeId: rohan.id,
        reviewerId: engLead.id,
        reviewType: "MANAGER",
        rating: 5,
        strengths:
          "Outstanding problem solving and code quality. Rohan has been a core pillar in our portal reliability.",
        improvements:
          "Encourage more active participation in architecture design reviews.",
        comments:
          "Recommended for Senior Engineer promotion in the next revision.",
        status: "SUBMITTED",
        submittedAt: new Date("2025-12-28"),
      },
    });
  }

  const activeCycle = await prisma.performanceCycle.create({
    data: {
      name: "H1 2026 Appraisal & OKRs",
      cycleType: "OKR",
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-06-30"),
      status: "ACTIVE",
      createdById: admin.id,
    },
  });

  if (rohan) {
    const goalOkr1 = await prisma.goal.create({
      data: {
        cycleId: activeCycle.id,
        employeeId: rohan.id,
        title: "Improve mobile portal Core Web Vitals to 95+",
        category: "INDIVIDUAL",
        targetValue: "95+ Lighthouse",
        progressPercent: 75,
        status: "IN_PROGRESS",
      },
    });

    await prisma.keyResult.createMany({
      data: [
        {
          goalId: goalOkr1.id,
          description: "Reduce First Contentful Paint to under 1.2s",
          progressPercent: 80,
          completed: false,
        },
        {
          goalId: goalOkr1.id,
          description: "Implement code-splitting on large bundles",
          progressPercent: 70,
          completed: false,
        },
      ],
    });

    await prisma.review.create({
      data: {
        cycleId: activeCycle.id,
        employeeId: rohan.id,
        reviewerId: rohan.id,
        reviewType: "SELF",
        rating: 4,
        strengths:
          "Performance optimization has shown 30% speedup in field location pings.",
        improvements:
          "Coordinate earlier with QA team for cross-device tests.",
        comments: "Goal on track for Q2 delivery.",
        status: "SUBMITTED",
        submittedAt: new Date(),
      },
    });
  }

  console.log("Seed complete.");
  console.log("Admin login: admin@realtysmartz.com / Admin@123");
  console.log("Employee login: any *@realtysmartz.com / Employee@123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
