import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@realty-smartz/db";
import { startOfDayUTC } from "@realty-smartz/shared";
import { authOptions } from "@/lib/auth";
import { resolvePunchGeofence } from "@realty-smartz/api";

export const dynamic = "force-dynamic";

/**
 * Authenticated endpoint for the Android app duty-location service.
 * Uses the website session cookie — no push notifications.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id && !session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    lat?: number;
    lng?: number;
    address?: string | null;
    accuracyM?: number | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  const employee =
    (await prisma.employee.findUnique({
      where: { id: session.user.id },
      select: { id: true },
    })) ??
    (session.user.email
      ? await prisma.employee.findUnique({
          where: { email: session.user.email.toLowerCase() },
          select: { id: true },
        })
      : null);

  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 401 });
  }

  const today = startOfDayUTC(new Date());
  const todayLog = await prisma.attendanceLog.findUnique({
    where: { employeeId_date: { employeeId: employee.id, date: today } },
    select: { checkInTime: true, checkOutTime: true },
  });

  if (!todayLog?.checkInTime || todayLog.checkOutTime) {
    return NextResponse.json({ error: "Not on duty", stopTracking: true }, { status: 400 });
  }

  const geo = await resolvePunchGeofence(prisma, employee.id, lat, lng);
  const address = geo.allowed
    ? geo.name
    : body.address?.trim() || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

  const ping = await prisma.locationPing.create({
    data: {
      employeeId: employee.id,
      lat,
      lng,
      address,
      accuracyM:
        body.accuracyM != null && Number.isFinite(Number(body.accuracyM))
          ? Number(body.accuracyM)
          : null,
      withinGeofence: geo.allowed,
      capturedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, id: ping.id });
}
