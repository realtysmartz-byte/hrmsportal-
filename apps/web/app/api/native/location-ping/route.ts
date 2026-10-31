import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@realty-smartz/db";
import { startOfDayUTC } from "@realty-smartz/shared";
import { authOptions } from "@/lib/auth";
import { assertRateLimit, resolvePunchGeofence, reverseGeocodePunchAddress } from "@realty-smartz/api";
import { z } from "zod";

export const dynamic = "force-dynamic";

const MIN_TRACKING_PING_GAP_MS = 50 * 60 * 1000; // 50 minutes debounce for 1 hour tracking
const locationPingBodySchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracyM: z.number().positive().lt(50_000),
  fixTimestamp: z.coerce.date(),
  isMockLocation: z.boolean().optional(),
}).superRefine((value, ctx) => {
  const timestamp = value.fixTimestamp.getTime();
  const now = Date.now();
  if (timestamp > now) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Location fix timestamp cannot be in the future",
      path: ["fixTimestamp"],
    });
  } else if (now - timestamp > 5 * 60_000) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Location fix is older than 5 minutes",
      path: ["fixTimestamp"],
    });
  }
});

function clientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  const values = forwarded?.split(",");
  return values?.[values.length - 1]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

/**
 * Authenticated endpoint for the Android app duty-location service.
 * At most one saved ping per ~30 minutes while on duty.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = locationPingBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: `Invalid location data: ${parsed.error.issues[0]?.message ?? "check GPS fix"}` },
      { status: 400 }
    );
  }
  const fix = parsed.data;

  const ip = clientIp(req);
  const employeeHit = assertRateLimit(`native-location:emp:${session.user.id}`, 10, 60_000);
  const ipHit = assertRateLimit(`native-location:ip:${ip}`, 10, 60_000);
  if (!employeeHit.ok || !ipHit.ok) {
    const retry = Math.max(
      employeeHit.ok ? 0 : employeeHit.retryAfterSec,
      ipHit.ok ? 0 : ipHit.retryAfterSec
    );
    return NextResponse.json(
      { error: `Too many location reports. Try again in ${retry}s.` },
      { status: 429 }
    );
  }

  const employee = await prisma.employee.findUnique({
    where: { id: session.user.id },
    select: { id: true },
  });
  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 401 });
  }

  const today = startOfDayUTC(new Date());
  const [todayLog, recent] = await Promise.all([
    prisma.attendanceLog.findUnique({
      where: { employeeId_date: { employeeId: employee.id, date: today } },
      select: { checkInTime: true, checkOutTime: true },
    }),
    prisma.locationPing.findFirst({
      where: {
        employeeId: employee.id,
        capturedAt: { gte: new Date(Date.now() - MIN_TRACKING_PING_GAP_MS) },
      },
      orderBy: { capturedAt: "desc" },
      select: { id: true },
    }),
  ]);

  if (!todayLog?.checkInTime || todayLog.checkOutTime) {
    return NextResponse.json({ error: "Not on duty", stopTracking: true }, { status: 400 });
  }
  if (recent) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const geo = await resolvePunchGeofence(prisma, employee.id, fix.lat, fix.lng);
  let address = (body as any)?.address;
  if (!address || address.match(/^-?\d+\.\d+,\s*-?\d+\.\d+$/)) {
    try {
      address = await reverseGeocodePunchAddress(fix.lat, fix.lng);
    } catch {}
  }
  if (!address) {
    address = geo.matched?.name ?? `${fix.lat.toFixed(5)}, ${fix.lng.toFixed(5)}`;
  }
  if (fix.isMockLocation) {
    address = `${address} · review:mock-gps`;
  }

  await prisma.locationPing.create({
    data: {
      employeeId: employee.id,
      lat: fix.lat,
      lng: fix.lng,
      address,
      accuracyM: fix.accuracyM,
      withinGeofence: geo.withinGeofence,
      capturedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, skipped: false });
}
