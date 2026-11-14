import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createTargetSchema,
  updateTargetSchema,
  logTargetActivitySchema,
  verifyTargetActivitySchema,
  syncTargetBonusSchema,
  targetItemSchema,
  getISTDateParts,
  getISTDateString,
} from "@realty-smartz/shared";
import { orgManageProcedure, protectedProcedure, router } from "../trpc";
import { getHolidaysForOrg } from "./holiday";

/**
 * Calculates real-time 10% Discipline (Attendance & Punctuality) Score
 * - Fixed 10% weight of total scorecard
 * - Daily evaluation:
 *   - On-time (before 10:30 AM IST): 1.0 day credit
 *   - Late (10:30 AM - 11:00 AM IST): 0.6 day credit (late cut)
 *   - Late after 11:00 AM / Half Day: 0.5 day credit
 *   - Approved Leave / Holiday: 1.0 credit (neutral, no penalty)
 *   - Unapproved Absent: 0.0 credit
 */
export async function calculateDisciplineScore(
  prisma: any,
  employeeId: string,
  startDate: Date,
  endDate: Date
) {
  // 1. Fetch employee to check joining date and organization
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { organizationId: true, dateOfJoining: true },
  });

  const orgId = employee?.organizationId || "org_default_realty";

  // 2. Fetch company settings for weekly off day
  let weeklyOffDay = 2; // Default Tuesday (2) in Realty Smartz
  try {
    const settings = await prisma.companySettings.findFirst({
      where: { organizationId: orgId },
    });
    if (settings && typeof settings.weeklyOffDay === "number") {
      weeklyOffDay = settings.weeklyOffDay;
    }
  } catch (err) {}

  // 3. Fetch official company holidays for this organization
  const holidayDateMap = new Map<string, string>();
  try {
    const holidays = await getHolidaysForOrg(prisma, orgId);
    if (Array.isArray(holidays)) {
      for (const h of holidays) {
        if (h.date) holidayDateMap.set(h.date, h.name || "Holiday");
      }
    }
  } catch (err) {}

  // 4. Fetch approved leave requests for this employee in date range
  const leaveDateMap = new Map<
    string,
    { isPaid: boolean; isHalfDay: boolean; typeName: string }
  >();
  try {
    const leaveRequests = await prisma.leaveRequest.findMany({
      where: {
        employeeId,
        status: "APPROVED",
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      include: { leaveType: true },
    });

    for (const req of leaveRequests) {
      const isPaid = !(
        req.leaveType?.name?.toLowerCase().includes("unpaid") ||
        req.leaveType?.name?.toLowerCase().includes("lwp")
      );
      const rStart = new Date(req.startDate);
      const rEnd = new Date(req.endDate);
      const rCurr = new Date(rStart);
      while (rCurr <= rEnd) {
        const ds = getISTDateString(rCurr);
        leaveDateMap.set(ds, {
          isPaid,
          isHalfDay: req.isHalfDay,
          typeName: req.leaveType?.name || "Leave",
        });
        rCurr.setDate(rCurr.getDate() + 1);
      }
    }
  } catch (err) {}

  // 5. Fetch attendance logs for this employee in date range
  const logs = await prisma.attendanceLog.findMany({
    where: {
      employeeId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  const logsByDate = new Map<string, any>();
  for (const log of logs) {
    const dStr = getISTDateString(new Date(log.date));
    logsByDate.set(dStr, log);
  }

  // 6. Respect date of joining so employee is not penalized for dates before joining
  const now = new Date();
  const cutoff = endDate < now ? endDate : now;
  let curr = new Date(startDate);
  if (employee?.dateOfJoining) {
    const joiningDate = new Date(employee.dateOfJoining);
    if (joiningDate > curr) {
      curr = new Date(joiningDate);
    }
  }

  let expectedWorkingDays = 0;
  let earnedCredits = 0;
  let onTimeDays = 0;
  let lateDays = 0;
  let halfDays = 0;
  let absentDays = 0;
  let paidLeaveDays = 0;
  let unpaidLeaveDays = 0;
  let holidayCount = 0;
  let weeklyOffCount = 0;

  while (curr <= cutoff) {
    const istParts = getISTDateParts(curr);
    const dStr = `${istParts.year}-${String(istParts.month).padStart(2, "0")}-${String(istParts.day).padStart(2, "0")}`;
    const dayOfWeek = new Date(Date.UTC(istParts.year, istParts.month - 1, istParts.day)).getUTCDay();

    // Designated Weekly Off (Tuesday in Realty Smartz, or Sunday)
    if (dayOfWeek === weeklyOffDay || dayOfWeek === 0) {
      weeklyOffCount++;
    } else if (holidayDateMap.has(dStr)) {
      // Official Company Holiday
      holidayCount++;
    } else if (leaveDateMap.has(dStr)) {
      // Approved Leave (Paid vs Unpaid)
      const leave = leaveDateMap.get(dStr)!;
      if (leave.isPaid) {
        const credit = leave.isHalfDay ? 0.5 : 1.0;
        paidLeaveDays += credit;
        earnedCredits += credit;
        expectedWorkingDays += credit;
      } else {
        // Unpaid Leave (LWP)
        const days = leave.isHalfDay ? 0.5 : 1.0;
        unpaidLeaveDays += days;
        expectedWorkingDays += days;
      }
    } else {
      // Normal Expected Working Day
      expectedWorkingDays++;
      const log = logsByDate.get(dStr);

      if (!log) {
        const todayStr = getISTDateString(now);
        if (dStr < todayStr) {
          absentDays++;
        }
      } else {
        if (log.status === "PRESENT") {
          if (log.checkInTime) {
            const ist = getISTDateParts(new Date(log.checkInTime));
            const minutes = ist.hour * 60 + ist.minute;

            if (minutes <= 630) { // <= 10:30 AM IST
              onTimeDays++;
              earnedCredits += 1.0;
            } else if (minutes <= 660) { // 10:31 - 11:00 AM IST
              lateDays++;
              earnedCredits += 0.6; // Deduction for late after 10:30 AM
            } else { // > 11:00 AM IST
              halfDays++;
              earnedCredits += 0.5; // Deduction for late after 11:00 AM
            }
          } else {
            onTimeDays++;
            earnedCredits += 1.0;
          }
        } else if (log.status === "LATE") {
          lateDays++;
          earnedCredits += 0.6;
        } else if (log.status === "HALF_DAY") {
          halfDays++;
          earnedCredits += 0.5;
        } else if (log.status === "ON_LEAVE") {
          paidLeaveDays++;
          earnedCredits += 1.0;
        } else if (log.status === "HOLIDAY") {
          holidayCount++;
          expectedWorkingDays--;
        } else {
          absentDays++;
        }
      }
    }

    curr.setDate(curr.getDate() + 1);
  }

  const effectiveWorkingDays = Math.max(1, expectedWorkingDays);
  const rawScore = (earnedCredits / effectiveWorkingDays) * 10;
  const score = Math.min(10, Math.max(0, Math.round(rawScore * 10) / 10));

  return {
    score,
    maxScore: 10,
    expectedWorkingDays: Math.round(expectedWorkingDays * 10) / 10,
    earnedCredits: Math.round(earnedCredits * 10) / 10,
    onTimeDays,
    lateDays,
    halfDays,
    absentDays,
    paidLeaveDays: Math.round(paidLeaveDays * 10) / 10,
    unpaidLeaveDays: Math.round(unpaidLeaveDays * 10) / 10,
    holidayCount,
    weeklyOffCount,
  };
}

export const targetRouter = router({
  listAdmin: orgManageProcedure
    .input(
      z
        .object({
          year: z.number().int().optional(),
          month: z.number().int().optional(),
          employeeId: z.string().optional(),
          departmentId: z.string().optional(),
          companyName: z.string().optional(),
          status: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId || "org_default_realty";

      const where: any = {
        organizationId: orgId,
      };

      if (input?.year) where.year = input.year;
      if (input?.month) where.month = input.month;
      if (input?.employeeId) where.employeeId = input.employeeId;
      if (input?.status) where.status = input.status;
      if (input?.departmentId) {
        where.employee = { departmentId: input.departmentId };
      }
      if (input?.companyName && input.companyName !== "ALL") {
        where.OR = [
          { companyName: input.companyName },
          { employee: { companyName: input.companyName } },
        ];
      }

      const targets = await ctx.prisma.employeeTarget.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              employeeCode: true,
              companyName: true,
              managerId: true,
              manager: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  employeeCode: true,
                  designation: { select: { title: true } },
                },
              },
              directReports: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  employeeCode: true,
                  companyName: true,
                  designation: { select: { title: true } },
                },
              },
              department: { select: { id: true, name: true } },
              designation: { select: { id: true, title: true } },
            },
          },
          items: {
            orderBy: { createdAt: "asc" },
          },
          activities: {
            orderBy: { activityDate: "desc" },
          },
        },
        orderBy: [{ year: "desc" }, { month: "desc" }, { createdAt: "desc" }],
      });

      // Compute live scorecard metrics including Discipline 10% for each target
      const targetsWithScorecard = await Promise.all(
        targets.map(async (t) => {
          const discipline = await calculateDisciplineScore(
            ctx.prisma,
            t.employeeId,
            new Date(t.startDate),
            new Date(t.endDate)
          );

          let totalAssignedWeight = 10; // Discipline starts at 10%
          let totalEarnedScore = discipline.score; // Out of 10

          const computedItems = (t.items || []).map((item) => {
            totalAssignedWeight += item.weightPercent || 0;
            const targetVal = item.targetValue || 0;
            const achievedVal = item.achievedValue || 0;

            // Pro-rata achievement percentage for this single item
            const itemCompletionRate =
              targetVal > 0 ? Math.min(1.0, achievedVal / targetVal) : 0;
            const earnedItemScore =
              Math.round(itemCompletionRate * item.weightPercent * 10) / 10;
            totalEarnedScore += earnedItemScore;

            return {
              ...item,
              itemCompletionRate: Math.round(itemCompletionRate * 100),
              earnedScore: earnedItemScore,
            };
          });

          const finalScore = Math.min(
            100,
            Math.round(totalEarnedScore * 10) / 10
          );

          const resolvedCompanyName =
            t.companyName || t.employee?.companyName || "Realty Smartz";

          return {
            ...t,
            companyName: resolvedCompanyName,
            discipline,
            items: computedItems,
            scorecard: {
              disciplineScore: discipline.score,
              maxDiscipline: 10,
              performanceScore: Math.round((finalScore - discipline.score) * 10) / 10,
              totalScore: finalScore,
              totalWeight: totalAssignedWeight,
            },
          };
        })
      );

      // Pending verification count
      const pendingCount = await ctx.prisma.targetActivity.count({
        where: {
          status: "PENDING",
          target: { organizationId: orgId },
        },
      });

      // Company-wise calculations across the 4 companies
      const TARGET_COMPANIES = [
        "Realty Smartz",
        "Smartz Spaces",
        "EngageXpert",
        "BuySquad",
      ] as const;

      const companyBreakdown = TARGET_COMPANIES.map((company) => {
        const companyTargets = targetsWithScorecard.filter(
          (t) => (t.companyName || "Realty Smartz") === company
        );

        let targetRevenue = 0;
        let achievedRevenue = 0;
        let targetVisits = 0;
        let achievedVisits = 0;
        let targetBookings = 0;
        let achievedBookings = 0;
        let targetCalls = 0;
        let achievedCalls = 0;
        let targetLeads = 0;
        let achievedLeads = 0;
        let scoreSum = 0;

        for (const ct of companyTargets) {
          targetRevenue += ct.targetRevenue || 0;
          achievedRevenue += ct.currentRevenue || 0;
          targetVisits += ct.targetVisits || 0;
          achievedVisits += ct.currentVisits || 0;
          targetBookings += ct.targetBookings || 0;
          achievedBookings += ct.currentBookings || 0;
          scoreSum += ct.scorecard.totalScore || 0;

          for (const it of ct.items || []) {
            const label = ((it.title || "") + " " + (it.category || "")).toLowerCase();
            if (label.includes("call")) {
              targetCalls += it.targetValue || 0;
              achievedCalls += it.achievedValue || 0;
            } else if (label.includes("lead")) {
              targetLeads += it.targetValue || 0;
              achievedLeads += it.achievedValue || 0;
            }
          }
        }

        const avgScore =
          companyTargets.length > 0
            ? Math.round((scoreSum / companyTargets.length) * 10) / 10
            : 0;

        const revenueProgressPct =
          targetRevenue > 0
            ? Math.min(100, Math.round((achievedRevenue / targetRevenue) * 100))
            : 0;

        return {
          companyName: company,
          targetsCount: companyTargets.length,
          targetRevenue,
          achievedRevenue,
          targetVisits,
          achievedVisits,
          targetBookings,
          achievedBookings,
          targetCalls,
          achievedCalls,
          targetLeads,
          achievedLeads,
          avgScore,
          revenueProgressPct,
        };
      });

      // Team Leaders & their team member breakdown
      const targetByEmpId = new Map<string, any>();
      for (const t of targetsWithScorecard) {
        targetByEmpId.set(t.employeeId, t);
      }

      const allEmployees = await ctx.prisma.employee.findMany({
        where: { organizationId: orgId, role: "EMPLOYEE" },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeCode: true,
          companyName: true,
          managerId: true,
          designation: { select: { title: true } },
          department: { select: { name: true } },
          directReports: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeCode: true,
              companyName: true,
              designation: { select: { title: true } },
            },
          },
        },
      });

      const tlList = allEmployees.filter((emp) => {
        const title = (emp.designation?.title || "").toLowerCase();
        const isDesignatedTL =
          title.includes("lead") || title.includes("manager") || title.includes("tl");
        const hasReports = emp.directReports && emp.directReports.length > 0;
        return hasReports || isDesignatedTL;
      });

      const teamLeaders = tlList.map((tl) => {
        const tlTarget = targetByEmpId.get(tl.id);
        const memberCards = (tl.directReports || []).map((rep) => {
          const repTarget = targetByEmpId.get(rep.id);
          return {
            id: rep.id,
            name: `${rep.firstName} ${rep.lastName}`.trim(),
            employeeCode: rep.employeeCode || "RS",
            companyName: rep.companyName || tl.companyName || "Realty Smartz",
            designation: rep.designation?.title || "Executive",
            hasTarget: !!repTarget,
            targetId: repTarget?.id,
            score: repTarget?.scorecard?.totalScore ?? 0,
            targetRevenue: repTarget?.targetRevenue ?? 0,
            achievedRevenue: repTarget?.currentRevenue ?? 0,
            targetVisits: repTarget?.targetVisits ?? 0,
            achievedVisits: repTarget?.currentVisits ?? 0,
            targetBookings: repTarget?.targetBookings ?? 0,
            achievedBookings: repTarget?.currentBookings ?? 0,
          };
        });

        const teamTargetRevenue =
          (tlTarget?.targetRevenue || 0) +
          memberCards.reduce((acc, m) => acc + m.targetRevenue, 0);
        const teamAchievedRevenue =
          (tlTarget?.currentRevenue || 0) +
          memberCards.reduce((acc, m) => acc + m.achievedRevenue, 0);
        const teamTargetVisits =
          (tlTarget?.targetVisits || 0) +
          memberCards.reduce((acc, m) => acc + m.targetVisits, 0);
        const teamAchievedVisits =
          (tlTarget?.currentVisits || 0) +
          memberCards.reduce((acc, m) => acc + m.achievedVisits, 0);
        const teamTargetBookings =
          (tlTarget?.targetBookings || 0) +
          memberCards.reduce((acc, m) => acc + m.targetBookings, 0);
        const teamAchievedBookings =
          (tlTarget?.currentBookings || 0) +
          memberCards.reduce((acc, m) => acc + m.achievedBookings, 0);

        const sumScore =
          (tlTarget?.scorecard?.totalScore || 0) +
          memberCards.reduce((acc, m) => acc + m.score, 0);
        const totalHeadcount = (tlTarget ? 1 : 0) + memberCards.length;
        const teamAvgScore =
          totalHeadcount > 0 ? Math.round((sumScore / totalHeadcount) * 10) / 10 : 0;

        return {
          id: tl.id,
          name: `${tl.firstName} ${tl.lastName}`.trim(),
          employeeCode: tl.employeeCode || "RS",
          companyName: tl.companyName || "Realty Smartz",
          designation: tl.designation?.title || "Team Leader",
          department: tl.department?.name || "Sales",
          memberCount: memberCards.length,
          members: memberCards,
          tlTarget,
          teamStats: {
            teamTargetRevenue,
            teamAchievedRevenue,
            teamTargetVisits,
            teamAchievedVisits,
            teamTargetBookings,
            teamAchievedBookings,
            teamAvgScore,
            progressPct:
              teamTargetRevenue > 0
                ? Math.min(100, Math.round((teamAchievedRevenue / teamTargetRevenue) * 100))
                : 0,
          },
        };
      });

      // Overall aggregates
      let totalTargetRevenue = 0;
      let totalAchievedRevenue = 0;
      let totalTargetVisits = 0;
      let totalAchievedVisits = 0;
      let totalTargetBookings = 0;
      let totalAchievedBookings = 0;
      let totalIncentivePaid = 0;
      let sumOfScores = 0;

      for (const t of targetsWithScorecard) {
        totalTargetRevenue += t.targetRevenue || 0;
        totalAchievedRevenue += t.currentRevenue || 0;
        totalTargetVisits += t.targetVisits || 0;
        totalAchievedVisits += t.currentVisits || 0;
        totalTargetBookings += t.targetBookings || 0;
        totalAchievedBookings += t.currentBookings || 0;
        sumOfScores += t.scorecard.totalScore;
        if (t.isBonusAwarded) {
          totalIncentivePaid +=
            (t.incentiveAmount || 0) +
            ((t.incentivePercent || 0) / 100) * (t.currentRevenue || 0);
        }
      }

      const avgScore =
        targetsWithScorecard.length > 0
          ? Math.round((sumOfScores / targetsWithScorecard.length) * 10) / 10
          : 0;

      return {
        targets: targetsWithScorecard,
        pendingVerificationsCount: pendingCount,
        companyBreakdown,
        teamLeaders,
        summary: {
          totalTargetRevenue,
          totalAchievedRevenue,
          totalTargetVisits,
          totalAchievedVisits,
          totalTargetBookings,
          totalAchievedBookings,
          totalIncentivePaid,
          avgScore,
          totalAssigned: targetsWithScorecard.length,
        },
      };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId || "org_default_realty";
      const target = await ctx.prisma.employeeTarget.findFirst({
        where: {
          id: input.id,
          organizationId: orgId,
        },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              employeeCode: true,
              department: { select: { id: true, name: true } },
              designation: { select: { id: true, title: true } },
            },
          },
          items: {
            orderBy: { createdAt: "asc" },
          },
          activities: {
            include: { targetItem: true },
            orderBy: { activityDate: "desc" },
          },
        },
      });

      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Target not found" });
      }

      const discipline = await calculateDisciplineScore(
        ctx.prisma,
        target.employeeId,
        new Date(target.startDate),
        new Date(target.endDate)
      );

      let totalEarnedScore = discipline.score;
      const computedItems = (target.items || []).map((item) => {
        const targetVal = item.targetValue || 0;
        const achievedVal = item.achievedValue || 0;
        const rate = targetVal > 0 ? Math.min(1.0, achievedVal / targetVal) : 0;
        const earned = Math.round(rate * item.weightPercent * 10) / 10;
        totalEarnedScore += earned;
        return {
          ...item,
          completionRate: Math.round(rate * 100),
          earnedScore: earned,
        };
      });

      return {
        ...target,
        discipline,
        items: computedItems,
        totalScore: Math.min(100, Math.round(totalEarnedScore * 10) / 10),
      };
    }),

  create: orgManageProcedure
    .input(createTargetSchema)
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId || "org_default_realty";

      const employee = await ctx.prisma.employee.findFirst({
        where: { id: input.employeeId, organizationId: orgId },
        include: { department: true, designation: true },
      });

      if (!employee) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Employee not found in organization",
        });
      }

      const companyName =
        input.companyName || employee.companyName || "Realty Smartz";

      // Keep employee companyName synchronized
      if (!employee.companyName || employee.companyName !== companyName) {
        await ctx.prisma.employee.update({
          where: { id: employee.id },
          data: { companyName },
        });
      }

      // 1. Create target parent record
      const target = await ctx.prisma.employeeTarget.create({
        data: {
          organizationId: orgId,
          employeeId: input.employeeId,
          companyName,
          title: input.title,
          periodType: input.periodType,
          month: input.month,
          year: input.year,
          startDate: input.startDate,
          endDate: input.endDate,
          targetVisits: input.targetVisits || 0,
          targetBookings: input.targetBookings || 0,
          targetRevenue: input.targetRevenue || 0,
          incentiveAmount: input.incentiveAmount || 0,
          incentivePercent: input.incentivePercent || 0,
          notes: input.notes,
          createdById: ctx.session.user.id,
          status: "IN_PROGRESS",
        },
      });

      // 2. Prepare items: either user provided or role/department-informed defaults
      let itemsToCreate = input.items || [];

      if (itemsToCreate.length === 0) {
        const deptName = (employee.department?.name || "").toLowerCase();
        const desigName = (employee.designation?.title || "").toLowerCase();
        const titleLower = (input.title || "").toLowerCase();

        if (
          deptName.includes("presales") ||
          desigName.includes("presales") ||
          titleLower.includes("presales")
        ) {
          // Presales Deliverables Preset
          itemsToCreate = [
            {
              title: "Outbound Calling & Prospect Outreach",
              category: "PRESALES",
              targetValue: 500,
              unit: "Calls",
              weightPercent: 30,
              notes: "Direct telephone outreach to prospective buyers",
            },
            {
              title: "Verified Hot & Warm Buyer Leads",
              category: "PRESALES",
              targetValue: 40,
              unit: "Leads",
              weightPercent: 35,
              notes: "Qualified prospective buyers matched with project portfolio",
            },
            {
              title: "Confirmed Site Visits Coordinated",
              category: "PRESALES",
              targetValue: 20,
              unit: "Visits",
              weightPercent: 25,
              notes: "Client site visits scheduled with sales executives",
            },
          ];
        } else if (
          desigName.includes("lead") ||
          desigName.includes("manager") ||
          desigName.includes("tl") ||
          titleLower.includes("team leader")
        ) {
          // Team Leader Deliverables Preset
          itemsToCreate = [
            {
              title: "Team Gross Booked Revenue",
              category: "SALES",
              targetValue: input.targetRevenue || 15000000,
              unit: "INR",
              weightPercent: 40,
              notes: "Total gross deal revenue closed by reporting team",
            },
            {
              title: "Team Confirmed Bookings",
              category: "SALES",
              targetValue: input.targetBookings || 6,
              unit: "Bookings",
              weightPercent: 30,
              notes: "Verified unit bookings closed across the team",
            },
            {
              title: "Team Buyer Site Visits",
              category: "SALES",
              targetValue: input.targetVisits || 40,
              unit: "Visits",
              weightPercent: 20,
              notes: "Total prospective buyer site inspections logged by team",
            },
          ];
        } else if (deptName.includes("hr") || deptName.includes("human")) {
          itemsToCreate = [
            {
              title: "New Candidate Joinings",
              category: "HR",
              targetValue: 3,
              unit: "Hires",
              weightPercent: 40,
              notes: "Verified joining of hired candidates",
            },
            {
              title: "Screenings & Interviews",
              category: "HR",
              targetValue: 25,
              unit: "Interviews",
              weightPercent: 30,
              notes: "Candidate screening and coordination",
            },
            {
              title: "HR Operations & Onboarding",
              category: "HR",
              targetValue: 10,
              unit: "Tasks",
              weightPercent: 20,
              notes: "Documentation and compliance checklists",
            },
          ];
        } else if (
          deptName.includes("it") ||
          deptName.includes("tech") ||
          deptName.includes("develop")
        ) {
          itemsToCreate = [
            {
              title: "Sprint Tasks & Milestones",
              category: "IT",
              targetValue: 8,
              unit: "Tasks",
              weightPercent: 40,
              notes: "Core development tasks shipped",
            },
            {
              title: "Bug Fixes & Maintenance",
              category: "IT",
              targetValue: 12,
              unit: "Fixes",
              weightPercent: 30,
              notes: "Resolution of reported bugs",
            },
            {
              title: "Code Reviews & Documentation",
              category: "IT",
              targetValue: 5,
              unit: "Deliverables",
              weightPercent: 20,
              notes: "Code reviews and architecture docs",
            },
          ];
        } else {
          // Default Sales / Commercial Targets
          itemsToCreate = [
            {
              title: "Site Visits & Client Walkthroughs",
              category: "SALES",
              targetValue: input.targetVisits || 15,
              unit: "Visits",
              weightPercent: 30,
              notes: "Completed prospective buyer site visits",
            },
            {
              title: "Closed Property Deals & Bookings",
              category: "SALES",
              targetValue: input.targetBookings || 2,
              unit: "Bookings",
              weightPercent: 30,
              notes: "Confirmed deals with token / advance",
            },
            {
              title: "Booked Deal Revenue Target",
              category: "SALES",
              targetValue: input.targetRevenue || 5000000,
              unit: "INR",
              weightPercent: 30,
              notes: "Gross sales value closed",
            },
          ];
        }
      }

      // Bulk create items for this target
      if (itemsToCreate.length > 0) {
        await ctx.prisma.$transaction(
          itemsToCreate.map((item) =>
            ctx.prisma.targetItem.create({
              data: {
                targetId: target.id,
                title: item.title,
                category: item.category,
                targetValue: item.targetValue,
                unit: item.unit,
                weightPercent: item.weightPercent,
                notes: item.notes,
              },
            })
          )
        );
      }

      return target;
    }),

  update: orgManageProcedure
    .input(updateTargetSchema)
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId || "org_default_realty";

      const existing = await ctx.prisma.employeeTarget.findFirst({
        where: { id: input.id, organizationId: orgId },
      });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Target not found" });
      }

      const { id, items, companyName, ...data } = input;
      const updated = await ctx.prisma.employeeTarget.update({
        where: { id },
        data: {
          ...(companyName !== undefined ? { companyName } : {}),
          ...(data.title !== undefined ? { title: data.title } : {}),
          ...(data.periodType !== undefined ? { periodType: data.periodType } : {}),
          ...(data.month !== undefined ? { month: data.month } : {}),
          ...(data.year !== undefined ? { year: data.year } : {}),
          ...(data.startDate !== undefined ? { startDate: data.startDate } : {}),
          ...(data.endDate !== undefined ? { endDate: data.endDate } : {}),
          ...(data.targetVisits !== undefined ? { targetVisits: data.targetVisits } : {}),
          ...(data.targetBookings !== undefined ? { targetBookings: data.targetBookings } : {}),
          ...(data.targetRevenue !== undefined ? { targetRevenue: data.targetRevenue } : {}),
          ...(data.incentiveAmount !== undefined ? { incentiveAmount: data.incentiveAmount } : {}),
          ...(data.incentivePercent !== undefined ? { incentivePercent: data.incentivePercent } : {}),
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(data.notes !== undefined ? { notes: data.notes } : {}),
        },
      });

      // Synchronize employee companyName if updated
      if (companyName && existing.employeeId) {
        await ctx.prisma.employee.update({
          where: { id: existing.employeeId },
          data: { companyName },
        });
      }

      // If items provided, synchronize items
      if (items && items.length > 0) {
        await ctx.prisma.targetItem.deleteMany({
          where: { targetId: id },
        });
        await ctx.prisma.$transaction(
          items.map((item) =>
            ctx.prisma.targetItem.create({
              data: {
                targetId: id,
                title: item.title,
                category: item.category,
                targetValue: item.targetValue,
                unit: item.unit,
                weightPercent: item.weightPercent,
                notes: item.notes,
              },
            })
          )
        );
      }

      return updated;
    }),

  delete: orgManageProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId || "org_default_realty";
      const existing = await ctx.prisma.employeeTarget.findFirst({
        where: { id: input.id, organizationId: orgId },
      });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Target not found" });
      }

      return ctx.prisma.employeeTarget.delete({
        where: { id: input.id },
      });
    }),

  // Logged-in employee's personal targets with scorecard
  myTargets: protectedProcedure.query(async ({ ctx }) => {
    const employeeId = ctx.session.user.id;
    const targets = await ctx.prisma.employeeTarget.findMany({
      where: { employeeId },
      include: {
        items: {
          orderBy: { createdAt: "asc" },
        },
        activities: {
          include: { targetItem: true },
          orderBy: { activityDate: "desc" },
        },
      },
      orderBy: [{ year: "desc" }, { month: "desc" }, { createdAt: "desc" }],
    });

    const enriched = await Promise.all(
      targets.map(async (t) => {
        const discipline = await calculateDisciplineScore(
          ctx.prisma,
          employeeId,
          new Date(t.startDate),
          new Date(t.endDate)
        );

        let totalEarnedScore = discipline.score;
        const computedItems = (t.items || []).map((item) => {
          const targetVal = item.targetValue || 0;
          const achievedVal = item.achievedValue || 0;
          const rate = targetVal > 0 ? Math.min(1.0, achievedVal / targetVal) : 0;
          const earned = Math.round(rate * item.weightPercent * 10) / 10;
          totalEarnedScore += earned;
          return {
            ...item,
            completionRate: Math.round(rate * 100),
            earnedScore: earned,
          };
        });

        return {
          ...t,
          companyName: t.companyName || "Realty Smartz",
          discipline,
          items: computedItems,
          totalScore: Math.min(100, Math.round(totalEarnedScore * 10) / 10),
        };
      })
    );

    return enriched;
  }),

  // If the logged-in employee is a Team Leader/Manager, get team performance
  myTeamPerformance: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId || "org_default_realty";
    const employeeId = ctx.session.user.id;

    const me = await ctx.prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        designation: true,
        department: true,
        directReports: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            companyName: true,
            designation: { select: { title: true } },
          },
        },
      },
    });

    if (!me) return null;

    const isTL =
      (me.directReports && me.directReports.length > 0) ||
      (me.designation?.title || "").toLowerCase().includes("lead") ||
      (me.designation?.title || "").toLowerCase().includes("manager");

    if (!isTL) return null;

    const reportIds = me.directReports.map((r) => r.id);
    const teamTargets = await ctx.prisma.employeeTarget.findMany({
      where: {
        employeeId: { in: reportIds },
        organizationId: orgId,
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            companyName: true,
            designation: { select: { title: true } },
          },
        },
        items: true,
      },
      orderBy: { createdAt: "desc" },
    });

    let teamTargetRevenue = 0;
    let teamAchievedRevenue = 0;
    let teamTargetVisits = 0;
    let teamAchievedVisits = 0;
    let teamTargetBookings = 0;
    let teamAchievedBookings = 0;

    for (const t of teamTargets) {
      teamTargetRevenue += t.targetRevenue || 0;
      teamAchievedRevenue += t.currentRevenue || 0;
      teamTargetVisits += t.targetVisits || 0;
      teamAchievedVisits += t.currentVisits || 0;
      teamTargetBookings += t.targetBookings || 0;
      teamAchievedBookings += t.currentBookings || 0;
    }

    return {
      isTeamLeader: true,
      leaderName: `${me.firstName} ${me.lastName}`,
      companyName: me.companyName || "Realty Smartz",
      memberCount: me.directReports.length,
      directReports: me.directReports,
      teamTargets,
      summary: {
        teamTargetRevenue,
        teamAchievedRevenue,
        teamTargetVisits,
        teamAchievedVisits,
        teamTargetBookings,
        teamAchievedBookings,
        progressPct:
          teamTargetRevenue > 0
            ? Math.min(100, Math.round((teamAchievedRevenue / teamTargetRevenue) * 100))
            : 0,
      },
    };
  }),

  // Employee or Admin logs activity / completion
  logActivity: protectedProcedure
    .input(logTargetActivitySchema)
    .mutation(async ({ ctx, input }) => {
      const target = await ctx.prisma.employeeTarget.findUnique({
        where: { id: input.targetId },
      });

      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Target not found" });
      }

      const isOwner = target.employeeId === ctx.session.user.id;
      const isAdmin =
        ctx.session.user.role === "ADMIN" || ctx.session.user.role === "HR";

      if (!isOwner && !isAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not permitted to log activity for this target",
        });
      }

      // If Admin logs it, it is automatically APPROVED. If employee submits, it is PENDING verification.
      const initialStatus = isAdmin ? "APPROVED" : "PENDING";

      const activity = await ctx.prisma.targetActivity.create({
        data: {
          targetId: input.targetId,
          targetItemId: input.targetItemId || null,
          employeeId: target.employeeId,
          activityType: input.activityType,
          title: input.title,
          projectName: input.projectName || "",
          clientName: input.clientName || "",
          clientPhone: input.clientPhone,
          unitNumber: input.unitNumber,
          quantity: input.quantity,
          revenueAmount: input.revenueAmount,
          activityDate: input.activityDate,
          notes: input.notes,
          proofUrl: input.proofUrl,
          status: initialStatus,
          verifiedById: isAdmin ? ctx.session.user.id : null,
          verifiedAt: isAdmin ? new Date() : null,
        },
      });

      // If approved immediately (by Admin), update TargetItem and totals right away
      if (initialStatus === "APPROVED") {
        if (input.targetItemId) {
          await ctx.prisma.targetItem.update({
            where: { id: input.targetItemId },
            data: {
              achievedValue: { increment: input.quantity },
            },
          });
        }

        if (input.activityType === "SITE_VISIT") {
          await ctx.prisma.employeeTarget.update({
            where: { id: input.targetId },
            data: { currentVisits: { increment: 1 } },
          });
        } else if (input.activityType === "BOOKING") {
          await ctx.prisma.employeeTarget.update({
            where: { id: input.targetId },
            data: {
              currentBookings: { increment: 1 },
              currentRevenue: { increment: input.revenueAmount },
            },
          });
        }
      }

      return activity;
    }),

  // List all pending activities needing verification (Admin)
  listPendingVerifications: orgManageProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.user.organizationId || "org_default_realty";

    return ctx.prisma.targetActivity.findMany({
      where: {
        status: "PENDING",
        target: { organizationId: orgId },
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            department: { select: { name: true } },
          },
        },
        target: {
          select: {
            id: true,
            title: true,
            month: true,
            year: true,
          },
        },
        targetItem: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  // Admin verifies or rejects an activity
  verifyActivity: orgManageProcedure
    .input(verifyTargetActivitySchema)
    .mutation(async ({ ctx, input }) => {
      const activity = await ctx.prisma.targetActivity.findUnique({
        where: { id: input.activityId },
        include: { target: true, targetItem: true },
      });

      if (!activity) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Activity submission not found",
        });
      }

      if (activity.status !== "PENDING") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `This submission has already been ${activity.status.toLowerCase()}.`,
        });
      }

      if (input.action === "APPROVE") {
        // 1. Mark approved
        const updated = await ctx.prisma.targetActivity.update({
          where: { id: input.activityId },
          data: {
            status: "APPROVED",
            verifiedById: ctx.session.user.id,
            verifiedAt: new Date(),
          },
        });

        // 2. Increment achievedValue on the linked TargetItem
        if (activity.targetItemId) {
          await ctx.prisma.targetItem.update({
            where: { id: activity.targetItemId },
            data: {
              achievedValue: { increment: activity.quantity },
            },
          });
        }

        // 3. Update legacy visits/bookings/revenue on target parent
        if (activity.activityType === "SITE_VISIT") {
          await ctx.prisma.employeeTarget.update({
            where: { id: activity.targetId },
            data: { currentVisits: { increment: 1 } },
          });
        } else if (activity.activityType === "BOOKING") {
          await ctx.prisma.employeeTarget.update({
            where: { id: activity.targetId },
            data: {
              currentBookings: { increment: 1 },
              currentRevenue: { increment: Number(activity.revenueAmount || 0) },
            },
          });
        }

        return { success: true, status: "APPROVED", activity: updated };
      } else {
        // Reject
        const updated = await ctx.prisma.targetActivity.update({
          where: { id: input.activityId },
          data: {
            status: "REJECTED",
            verifiedById: ctx.session.user.id,
            verifiedAt: new Date(),
            rejectionReason: input.rejectionReason || "Verification rejected by manager",
          },
        });

        return { success: true, status: "REJECTED", activity: updated };
      }
    }),

  deleteActivity: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const activity = await ctx.prisma.targetActivity.findUnique({
        where: { id: input.id },
        include: { target: true, targetItem: true },
      });

      if (!activity) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Activity not found" });
      }

      const isOwner = activity.employeeId === ctx.session.user.id;
      const isAdmin =
        ctx.session.user.role === "ADMIN" || ctx.session.user.role === "HR";

      if (!isOwner && !isAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not permitted to delete this activity",
        });
      }

      // If it was already approved, deduct its quantity from TargetItem
      if (activity.status === "APPROVED" && activity.targetItemId) {
        await ctx.prisma.targetItem.update({
          where: { id: activity.targetItemId },
          data: {
            achievedValue: { decrement: activity.quantity },
          },
        });
      }

      await ctx.prisma.targetActivity.delete({
        where: { id: input.id },
      });

      // Recalculate parent target totals
      const remainingApproved = await ctx.prisma.targetActivity.findMany({
        where: { targetId: activity.targetId, status: "APPROVED" },
      });

      let currentVisits = 0;
      let currentBookings = 0;
      let currentRevenue = 0;

      for (const act of remainingApproved) {
        if (act.activityType === "SITE_VISIT") currentVisits += 1;
        if (act.activityType === "BOOKING") {
          currentBookings += 1;
          currentRevenue += Number(act.revenueAmount || 0);
        }
      }

      await ctx.prisma.employeeTarget.update({
        where: { id: activity.targetId },
        data: {
          currentVisits,
          currentBookings,
          currentRevenue,
        },
      });

      return { success: true };
    }),

  syncBonusToPayroll: orgManageProcedure
    .input(syncTargetBonusSchema)
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.session.user.organizationId || "org_default_realty";
      const target = await ctx.prisma.employeeTarget.findFirst({
        where: { id: input.targetId, organizationId: orgId },
        include: { employee: true },
      });

      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Target not found" });
      }

      const calculatedBonus =
        target.incentiveAmount +
        ((target.incentivePercent || 0) / 100) * (target.currentRevenue || 0);
      const bonusAmount =
        input.customBonusAmount !== undefined && input.customBonusAmount !== null
          ? input.customBonusAmount
          : calculatedBonus;

      if (bonusAmount <= 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Bonus amount must be greater than zero to sync with payroll.",
        });
      }

      const month = target.month || new Date().getMonth() + 1;
      const year = target.year || new Date().getFullYear();
      const adjustmentId = `tgt_bonus_${target.id}`;

      await ctx.prisma.$executeRawUnsafe(
        `INSERT INTO payroll_adjustments (
          id, employee_id, month, year, type, amount, remark, created_at
        ) VALUES (
          $1, $2, $3, $4, 'bonus', $5, $6, NOW()
        ) ON CONFLICT (id) DO UPDATE SET
          amount = EXCLUDED.amount,
          remark = EXCLUDED.remark`,
        adjustmentId,
        target.employeeId,
        month,
        year,
        bonusAmount,
        `Target Achievement Incentive: ${target.title}`
      );

      await ctx.prisma.employeeTarget.update({
        where: { id: target.id },
        data: { isBonusAwarded: true, status: "COMPLETED" },
      });

      return {
        success: true,
        amount: bonusAmount,
        employeeName: `${target.employee.firstName} ${target.employee.lastName}`,
        month,
        year,
      };
    }),
});
