import { NextResponse } from "next/server";
import { prisma } from "@realty-smartz/db";
import {
  formatBirthdayTelegramMessage,
  sendTelegramNotification,
} from "@realty-smartz/api";

export const dynamic = "force-dynamic";

/**
 * Daily 9:00 AM IST Birthday Wishes Cron
 * GET /api/cron/birthdays
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();

    const employees = await prisma.employee.findMany({
      where: {
        status: "ACTIVE",
        dateOfBirth: { not: null },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        designation: { select: { title: true } },
        department: { select: { name: true } },
      },
    });

    const birthdayEmployees = employees.filter((emp) => {
      if (!emp.dateOfBirth) return false;
      const dob = new Date(emp.dateOfBirth);
      return dob.getMonth() + 1 === currentMonth && dob.getDate() === currentDay;
    });

    for (const emp of birthdayEmployees) {
      const msg = formatBirthdayTelegramMessage({
        employeeName: `${emp.firstName} ${emp.lastName}`,
        designation: emp.designation?.title,
        department: emp.department?.name,
      });
      await sendTelegramNotification(
        prisma,
        "ATTENDANCE_LEAVE",
        "notifyBirthday",
        msg
      );
    }

    return NextResponse.json({
      success: true,
      count: birthdayEmployees.length,
      employees: birthdayEmployees.map((e) => `${e.firstName} ${e.lastName}`),
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron:birthdays] Error:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
