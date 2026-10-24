import { NextResponse } from "next/server";
import { prisma } from "@realty-smartz/db";
import {
  formatWeeklyBirthdayTelegramMessage,
  getWeeklyBirthdayRange,
  sendTelegramNotification,
} from "@realty-smartz/api";

export const dynamic = "force-dynamic";

/**
 * Weekly Monday 9:00 AM IST Birthday Announcement Cron
 * GET /api/cron/birthdays
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { weekRangeStr, days } = getWeeklyBirthdayRange();

    const employees = await prisma.employee.findMany({
      where: {
        status: "ACTIVE",
        dateOfBirth: { not: null },
      },
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        dateOfBirth: true,
        designation: { select: { title: true } },
        department: { select: { name: true } },
      },
    });

    const birthdays = employees
      .flatMap((emp) => {
        if (!emp.dateOfBirth) return [];
        const dob = new Date(emp.dateOfBirth);
        const dobMonth = dob.getMonth() + 1;
        const dobDay = dob.getDate();
        const matchIndex = days.findIndex((d) => d.month === dobMonth && d.day === dobDay);
        if (matchIndex === -1) return [];

        return [
          {
            id: emp.id,
            name: `${emp.firstName} ${emp.lastName}`.trim(),
            employeeCode: emp.employeeCode,
            birthdayDate: days[matchIndex].displayDate,
            designation: emp.designation?.title,
            department: emp.department?.name,
            phone: emp.phone,
            email: emp.email,
            dayIndex: matchIndex,
          },
        ];
      })
      .sort((a, b) => a.dayIndex - b.dayIndex);

    const msg = formatWeeklyBirthdayTelegramMessage({
      weekRangeStr,
      birthdays,
    });

    // Send weekly announcement (even if 0 birthdays, as requested)
    await sendTelegramNotification(
      prisma,
      "ATTENDANCE_LEAVE",
      "notifyBirthday",
      msg
    );

    return NextResponse.json({
      success: true,
      count: birthdays.length,
      weekRange: weekRangeStr,
      employees: birthdays.map((e) => `${e.name} (${e.birthdayDate})`),
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
