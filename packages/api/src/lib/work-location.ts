import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@realty-smartz/db";
import { haversineDistanceM } from "@realty-smartz/shared";

export type EffectiveWorkLocation = {
  source: "ASSIGNED" | "OFFICE";
  name: string;
  lat: number;
  lng: number;
  radiusM: number;
};

export type PunchGeofenceResult =
  | {
      allowed: true;
      name: string;
      source: "ASSIGNED" | "OFFICE";
      distanceM: number;
      radiusM: number;
    }
  | {
      allowed: false;
      nearestName: string;
      distanceM: number;
      radiusM: number;
    };

/**
 * Primary workplace for labels / maps: assigned site if set, else company office.
 */
export async function getEffectiveWorkLocation(
  prisma: PrismaClient,
  employeeId: string
): Promise<EffectiveWorkLocation> {
  const [emp, settings] = await Promise.all([
    prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        workLocationName: true,
        workLocationLat: true,
        workLocationLng: true,
      },
    }),
    prisma.companySettings.findUnique({ where: { id: "singleton" } }),
  ]);

  if (!settings) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Company office location is not configured",
    });
  }

  if (emp?.workLocationLat != null && emp.workLocationLng != null) {
    return {
      source: "ASSIGNED",
      name: emp.workLocationName || "Assigned site",
      lat: emp.workLocationLat,
      lng: emp.workLocationLng,
      radiusM: settings.geofenceRadiusM,
    };
  }

  return {
    source: "OFFICE",
    name: settings.officeName,
    lat: settings.officeLat,
    lng: settings.officeLng,
    radiusM: settings.geofenceRadiusM,
  };
}

export function distanceToWorkLocationM(
  loc: EffectiveWorkLocation,
  lat: number,
  lng: number
): number {
  return haversineDistanceM(lat, lng, loc.lat, loc.lng);
}

/**
 * Punch / live tracking: employee may be at their assigned site OR the company HQ.
 * This stops HQ staff with a field site from showing as "far / outside" when they are in office.
 */
export async function resolvePunchGeofence(
  prisma: PrismaClient,
  employeeId: string,
  lat: number,
  lng: number
): Promise<PunchGeofenceResult> {
  const [emp, settings] = await Promise.all([
    prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        workLocationName: true,
        workLocationLat: true,
        workLocationLng: true,
      },
    }),
    prisma.companySettings.findUnique({ where: { id: "singleton" } }),
  ]);

  if (!settings) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Company office location is not configured",
    });
  }

  const radiusM = settings.geofenceRadiusM;
  const officeDist = haversineDistanceM(lat, lng, settings.officeLat, settings.officeLng);
  const atOffice = officeDist <= radiusM;

  if (emp?.workLocationLat != null && emp.workLocationLng != null) {
    const siteName = emp.workLocationName || "Assigned site";
    const siteDist = haversineDistanceM(lat, lng, emp.workLocationLat, emp.workLocationLng);
    const atSite = siteDist <= radiusM;

    if (atSite) {
      return {
        allowed: true,
        name: siteName,
        source: "ASSIGNED",
        distanceM: siteDist,
        radiusM,
      };
    }
    if (atOffice) {
      return {
        allowed: true,
        name: settings.officeName,
        source: "OFFICE",
        distanceM: officeDist,
        radiusM,
      };
    }

    const nearerIsSite = siteDist <= officeDist;
    return {
      allowed: false,
      nearestName: nearerIsSite ? siteName : settings.officeName,
      distanceM: nearerIsSite ? siteDist : officeDist,
      radiusM,
    };
  }

  if (atOffice) {
    return {
      allowed: true,
      name: settings.officeName,
      source: "OFFICE",
      distanceM: officeDist,
      radiusM,
    };
  }

  return {
    allowed: false,
    nearestName: settings.officeName,
    distanceM: officeDist,
    radiusM,
  };
}
