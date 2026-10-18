import { TRPCError } from "@trpc/server";
import { Prisma, type PrismaClient } from "@realty-smartz/db";
import { haversineDistanceM } from "@realty-smartz/shared";

export type EffectiveWorkLocation = {
  source: "ASSIGNED" | "OFFICE";
  name: string;
  lat: number;
  lng: number;
  radiusM: number;
};

export const OFFICE_PUNCH_LOCATION_NAME = "Realty Smartz Pvt Ltd";

export type AssignedSite = { name: string; lat: number; lng: number };

export type PunchGeofenceMatch = {
  withinGeofence: boolean;
  matched: EffectiveWorkLocation | null;
  nearest: EffectiveWorkLocation;
  distanceM: number;
  sites: EffectiveWorkLocation[];
};

type OfficeSettings = {
  officeName: string;
  officeLat: number;
  officeLng: number;
  geofenceRadiusM: number;
};

let officeSettingsCache: { at: number; data: OfficeSettings } | null = null;
const OFFICE_SETTINGS_TTL_MS = 5 * 60 * 1000;
const workLocationCache = new Map<
  string,
  { at: number; sites: EffectiveWorkLocation[] }
>();
const WORK_LOCATION_TTL_MS = 5 * 60 * 1000;

export function invalidatePunchGeofenceCache(employeeId?: string) {
  if (employeeId) {
    workLocationCache.delete(employeeId);
    return;
  }
  workLocationCache.clear();
  officeSettingsCache = null;
}

async function getOfficeSettings(prisma: PrismaClient): Promise<OfficeSettings> {
  const now = Date.now();
  if (officeSettingsCache && now - officeSettingsCache.at < OFFICE_SETTINGS_TTL_MS) {
    return officeSettingsCache.data;
  }
  const settings = await prisma.companySettings.findUnique({
    where: { id: "singleton" },
    select: {
      officeName: true,
      officeLat: true,
      officeLng: true,
      geofenceRadiusM: true,
    },
  });
  if (!settings) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Company office location is not configured",
    });
  }
  officeSettingsCache = { at: now, data: settings };
  return settings;
}

/** Normalize DB json / legacy single fields into up to 3 sites. */
export function parseAssignedSites(emp: {
  assignedLocations?: unknown;
  workLocationName?: string | null;
  workLocationLat?: number | null;
  workLocationLng?: number | null;
}): AssignedSite[] {
  const fromJson: AssignedSite[] = [];
  const raw = emp.assignedLocations;
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const lat = Number(o.lat);
      const lng = Number(o.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      fromJson.push({
        name: String(o.name || "Assigned site").slice(0, 200),
        lat,
        lng,
      });
      if (fromJson.length >= 3) break;
    }
  }
  if (fromJson.length > 0) return fromJson;

  if (emp.workLocationLat != null && emp.workLocationLng != null) {
    return [
      {
        name: emp.workLocationName || "Assigned site",
        lat: emp.workLocationLat,
        lng: emp.workLocationLng,
      },
    ];
  }
  return [];
}

/** Keep legacy columns in sync with first assigned site (or clear). */
export function syncLegacyWorkLocation(sites: AssignedSite[] | null | undefined) {
  const first = sites?.[0];
  const list = sites && sites.length > 0 ? sites.slice(0, 3) : null;
  return {
    workLocationName: first?.name ?? null,
    workLocationLat: first?.lat ?? null,
    workLocationLng: first?.lng ?? null,
    // Prisma Json? needs DbNull for SQL NULL — plain `null` fails tsc
    assignedLocations: list === null ? Prisma.DbNull : (list as Prisma.InputJsonValue),
  };
}

/**
 * Punch sites: company office ALWAYS + up to 3 assigned sites.
 */
export async function getPunchGeofenceSites(
  prisma: PrismaClient,
  employeeId: string
): Promise<EffectiveWorkLocation[]> {
  const now = Date.now();
  const cached = workLocationCache.get(employeeId);
  if (cached && now - cached.at < WORK_LOCATION_TTL_MS) {
    return cached.sites;
  }

  const [emp, settings] = await Promise.all([
    prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        workLocationName: true,
        workLocationLat: true,
        workLocationLng: true,
        assignedLocations: true,
      },
    }),
    getOfficeSettings(prisma),
  ]);

  const sites: EffectiveWorkLocation[] = [
    {
      source: "OFFICE",
      name: OFFICE_PUNCH_LOCATION_NAME,
      lat: settings.officeLat,
      lng: settings.officeLng,
      radiusM: settings.geofenceRadiusM,
    },
  ];

  for (const s of parseAssignedSites(emp ?? {})) {
    sites.push({
      source: "ASSIGNED",
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      radiusM: settings.geofenceRadiusM,
    });
  }

  workLocationCache.set(employeeId, { at: now, sites });
  return sites;
}

export async function resolvePunchGeofence(
  prisma: PrismaClient,
  employeeId: string,
  lat: number,
  lng: number
): Promise<PunchGeofenceMatch> {
  const sites = await getPunchGeofenceSites(prisma, employeeId);

  let nearest = sites[0];
  let nearestDist = distanceToWorkLocationM(nearest, lat, lng);
  let closestMatched: EffectiveWorkLocation | null = null;
  let closestMatchedDist = Number.POSITIVE_INFINITY;
  let officeMatch: EffectiveWorkLocation | null = null;
  let officeDistance = Number.POSITIVE_INFINITY;

  for (const site of sites) {
    const d = distanceToWorkLocationM(site, lat, lng);
    if (d < nearestDist) {
      nearest = site;
      nearestDist = d;
    }
    if (site.source === "OFFICE") {
      officeDistance = d;
      if (d <= site.radiusM) officeMatch = site;
    } else if (d <= site.radiusM && d < closestMatchedDist) {
      closestMatched = site;
      closestMatchedDist = d;
    }
  }

  // If office and an assigned site overlap, keep the office label; both remain eligible.
  const matched = officeMatch ?? closestMatched;
  const matchedDist = officeMatch ? officeDistance : closestMatchedDist;

  return {
    withinGeofence: matched != null,
    matched,
    nearest,
    distanceM: matched ? matchedDist : nearestDist,
    sites,
  };
}

export async function canonicalizeOfficeAttendanceLabels<
  T extends {
    checkInLat: number | null;
    checkInLng: number | null;
    checkInAddress: string | null;
  },
>(prisma: PrismaClient, logs: T[]): Promise<T[]> {
  if (logs.length === 0) return logs;
  const settings = await getOfficeSettings(prisma);
  return logs.map((log) => {
    if (log.checkInLat == null || log.checkInLng == null) return log;
    if (
      haversineDistanceM(
        log.checkInLat,
        log.checkInLng,
        settings.officeLat,
        settings.officeLng
      ) > settings.geofenceRadiusM
    ) {
      return log;
    }
    return { ...log, checkInAddress: OFFICE_PUNCH_LOCATION_NAME };
  });
}

export async function getEffectiveWorkLocation(
  prisma: PrismaClient,
  employeeId: string
): Promise<EffectiveWorkLocation> {
  const sites = await getPunchGeofenceSites(prisma, employeeId);
  return sites.find((s) => s.source === "ASSIGNED") ?? sites[0];
}

export function distanceToWorkLocationM(
  loc: Pick<EffectiveWorkLocation, "lat" | "lng">,
  lat: number,
  lng: number
): number {
  return haversineDistanceM(lat, lng, loc.lat, loc.lng);
}
