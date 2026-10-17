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
  return {
    workLocationName: first?.name ?? null,
    workLocationLat: first?.lat ?? null,
    workLocationLng: first?.lng ?? null,
    assignedLocations: sites && sites.length > 0 ? sites.slice(0, 3) : null,
  };
}

/**
 * Punch sites: company office ALWAYS + up to 3 assigned sites (200m each).
 */
export async function getPunchGeofenceSites(
  prisma: PrismaClient,
  employeeId: string
): Promise<EffectiveWorkLocation[]> {
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
      name: settings.officeName,
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
  let matched: EffectiveWorkLocation | null = null;
  let matchedDist = Number.POSITIVE_INFINITY;

  for (const site of sites) {
    const d = distanceToWorkLocationM(site, lat, lng);
    if (d < nearestDist) {
      nearest = site;
      nearestDist = d;
    }
    if (d <= site.radiusM && d < matchedDist) {
      matched = site;
      matchedDist = d;
    }
  }

  return {
    withinGeofence: matched != null,
    matched,
    nearest,
    distanceM: matched ? matchedDist : nearestDist,
    sites,
  };
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
