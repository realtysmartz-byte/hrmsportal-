import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@realty-smartz/db";
import { authOptions, verifyDutyToken } from "@/lib/auth";
import { notifyLocationDisabledAlert } from "@realty-smartz/api";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: {
    reason?: string;
    deviceInfo?: string;
    employeeId?: string;
    dutyToken?: string;
    employeeEmail?: string;
  } = {};
  try {
    body = await req.json();
  } catch { }

  const session = await getServerSession(authOptions);
  let employeeId = session?.user?.id;

  if (!employeeId) {
      const candidateId = req.headers.get("x-employee-id") || body.employeeId;
      if (candidateId) {
        employeeId = candidateId;
      }
    }

    // Fallback to employeeEmail if id wasn't passed directly
    if (!employeeId && body.employeeEmail) {
      const byEmail = await prisma.employee.findFirst({
        where: { email: { equals: body.employeeEmail.trim(), mode: "insensitive" } },
        select: { id: true },
      });
      if (byEmail) {
        employeeId = byEmail.id;
      }
    }

    if (!employeeId) {
      return NextResponse.json({ error: "Unauthorized: Missing employee context" }, { status: 401 });
    }

    const emp = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeCode: true,
        email: true,
        department: { select: { name: true } },
        manager: { select: { email: true } },
      },
    });

    if (!emp) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const now = new Date();

    // 1. Send immediate Alert Email to Employee AND Admin/HR
    try {
      await notifyLocationDisabledAlert({
        employeeName: `${emp.firstName} ${emp.lastName}`,
        employeeEmail: emp.email,
        employeeCode: emp.employeeCode,
        departmentName: emp.department?.name,
        attemptTime: now,
        reason: body.reason || "Device GPS / Location was switched OFF in settings while on active duty",
        deviceInfo: body.deviceInfo || "Android Native HRMS App",
        managerEmail: emp.manager?.email,
      });
    } catch (err) {
      console.error("[location-disabled] email dispatch error:", err);
    }

    // 2. Record a null-coordinate location ping with timestamp so tracking logs show null with exact time
    try {
      await prisma.locationPing.create({
        data: {
          employeeId: emp.id,
          lat: 0.0,
          lng: 0.0,
          address: "Location Services Switched OFF / Disabled",
          accuracyM: null,
          withinGeofence: false,
          capturedAt: now,
        },
      });
    } catch (pingErr) {
      console.error("[location-disabled] ping record error:", pingErr);
    }

    return NextResponse.json({ ok: true, alerted: true, timestamp: now.toISOString() });
  }

