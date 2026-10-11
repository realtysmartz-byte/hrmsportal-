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

/**
 * The single place an employee is allowed to punch in from:
 * their HR-assigned site if one is set, otherwise the company office.
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
