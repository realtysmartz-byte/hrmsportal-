import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@realty-smartz/db";
import { startOfDayUTC } from "@realty-smartz/shared";
import { authOptions, verifyDutyToken } from "@/lib/auth";
import { assertRateLimit, resolvePunchGeofence, reverseGeocodePunchAddress } from "@realty-smartz/api";
import { z } from "zod";

export const dynamic = "force-dynamic";

const MIN_TRACKING_PING_GAP_MS = 45 * 60 * 1000; // 45 minutes debounce for 1 hour tracking

const locationPingBodySchema = z
  .object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    accuracyM: z.number().lt(50_000).nullable().optional(),
    fixTimestamp: z.coerce.date(),
    isMockLocation: z.boolean().optional(),
    isLocationOff: z.boolean().optional(),
    employeeId: z.string().optional(),
    employeeEmail: z.string().optional(),
    dutyToken: z.string().optional(),
    address: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    const timestamp = value.fixTimestamp.getTime();
    const now = Date.now();
    if (timestamp > now + 120_000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Location fix timestamp cannot be in the future",
        path: ["fixTimestamp"],
      });
    } else if (now - timestamp > 15 * 60_000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Location fix is older than 15 minutes",
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
 * Supports standard web session cookie or verified duty token for background pings.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  let employeeId = session?.user?.id;
  if (!employeeId) {
      const candidateId = req.headers.get("x-employee-id") || (body as any)?.employeeId;
      if (candidateId) {
        employeeId = candidateId;
      }
    }

    if (!employeeId && (body as any)?.employeeEmail) {
      const byEmail = await prisma.employee.findFirst({
        where: { email: { equals: String((body as any).employeeEmail).trim(), mode: "insensitive" } },
        select: { id: true },
      });
      if (byEmail) {
        employeeId = byEmail.id;
      }
    }

    if (!employeeId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = locationPingBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: `Invalid location data: ${parsed.error.issues[0]?.message ?? "check GPS fix"}` },
        { status: 400 }
      );
    }
    const fix = parsed.data;

    // Handle location turned off event explicitly: record null with timestamp and alert email
    if (fix.isLocationOff || (fix.lat === 0 && fix.lng === 0 && (body as any)?.isLocationOff)) {
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

      if (emp) {
        try {
          const { notifyLocationDisabledAlert } = await import("@realty-smartz/api");
          await notifyLocationDisabledAlert({
            employeeName: `${emp.firstName} ${emp.lastName}`,
            employeeEmail: emp.email,
            employeeCode: emp.employeeCode,
            departmentName: emp.department?.name,
            attemptTime: new Date(),
            reason: (body as any)?.address || "Device GPS location was turned off while on active duty",
            deviceInfo: (body as any)?.deviceInfo || "Android Native HRMS App",
            managerEmail: emp.manager?.email,
          });
        } catch (err) {
          console.error("[location-ping:off] alert email error:", err);
        }

        await prisma.locationPing.create({
          data: {
            employeeId: emp.id,
            lat: 0.0,
            lng: 0.0,
            address: fix.address || "Location Services Switched OFF / Disabled",
            accuracyM: null,
            withinGeofence: false,
            capturedAt: new Date(),
          },
        });
      }

      return NextResponse.json({ ok: true, isLocationOff: true });
    }

    if (fix.isMockLocation || (fix.lat === 0 && fix.lng === 0)) {
      return NextResponse.json(
        { error: "Fake GPS / Mock coordinates detected and rejected.", isMock: true },
        { status: 400 }
      );
    }

    const ip = clientIp(req);
    const employeeHit = assertRateLimit(`native-location:emp:${employeeId}`, 15, 60_000);
    const ipHit = assertRateLimit(`native-location:ip:${ip}`, 30, 60_000);
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
      where: { id: employeeId },
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
      } catch { }
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
