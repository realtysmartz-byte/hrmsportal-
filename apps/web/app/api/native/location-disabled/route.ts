import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@realty-smartz/db";
import { authOptions } from "@/lib/auth";
import { notifyLocationDisabledAlert } from "@realty-smartz/api";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { reason?: string; deviceInfo?: string } = {};
  try {
    body = await req.json();
  } catch {}

  const emp = await prisma.employee.findUnique({
    where: { id: session.user.id },
    select: {
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

  try {
    await notifyLocationDisabledAlert({
      employeeName: `${emp.firstName} ${emp.lastName}`,
      employeeEmail: emp.email,
      employeeCode: emp.employeeCode,
      departmentName: emp.department?.name,
      attemptTime: new Date(),
      reason: body.reason || "Device GPS location turned off / permission revoked while on active duty",
      deviceInfo: body.deviceInfo || "Android Native HRMS App",
      managerEmail: emp.manager?.email,
    });
  } catch (err) {
    console.error("[location-disabled] email dispatch error:", err);
  }

  return NextResponse.json({ ok: true, alerted: true });
}

