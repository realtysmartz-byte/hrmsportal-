import { NextRequest, NextResponse } from "next/server";
import {
  POPULAR_HUBS,
  matchSectorQuery,
  type PlaceItem,
} from "@/lib/places-registry";

/**
 * Parses exact coordinates from direct lat/lng inputs, Google Maps share links, or short URLs.
 */
async function parseCoordinatesFromQuery(query: string): Promise<PlaceItem | null> {
  let q = query.trim();

  // 1. Follow short Google Maps URLs (e.g. https://maps.app.goo.gl/XYZ or https://goo.gl/maps/XYZ)
  if (/https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps)\/[A-Za-z0-9_-]+/i.test(q)) {
    try {
      const res = await fetch(q, {
        redirect: "follow",
        signal: AbortSignal.timeout(4000),
      });
      if (res.url) {
        q = res.url;
      }
    } catch {
      // ignore network issue on short url follow
    }
  }

  // 2. Pattern: @lat,lng in Google Maps URL
  const gmapUrlMatch = q.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (gmapUrlMatch) {
    const lat = parseFloat(gmapUrlMatch[1]);
    const lng = parseFloat(gmapUrlMatch[2]);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return {
        name: `Google Maps Location [${lat.toFixed(5)}, ${lng.toFixed(5)}]`,
        displayName: `Google Maps Pinpoint [${lat.toFixed(6)}, ${lng.toFixed(6)}]`,
        lat,
        lng,
        address: `Coordinates: ${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        tag: "Exact GPS Pin",
      };
    }
  }

  // 3. Pattern: ?q=lat,lng or query=lat,lng or destination=lat,lng
  const paramMatch = q.match(/[?&](?:q|query|destination|ll|saddr|daddr)=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (paramMatch) {
    const lat = parseFloat(paramMatch[1]);
    const lng = parseFloat(paramMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) {
      return {
        name: `Pinned Location [${lat.toFixed(5)}, ${lng.toFixed(5)}]`,
        displayName: `Google Maps Coordinate Link [${lat.toFixed(6)}, ${lng.toFixed(6)}]`,
        lat,
        lng,
        address: `Coordinates: ${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        tag: "Google Maps Pin",
      };
    }
  }

  // 4. Pattern: Direct lat, lng string like "28.3997, 77.0385" or "28.3997196 77.0385682"
  const directCoordMatch = q.match(/^(-?\d{1,2}\.\d+)[,\s]+(-?\d{1,3}\.\d+)$/);
  if (directCoordMatch) {
    const lat = parseFloat(directCoordMatch[1]);
    const lng = parseFloat(directCoordMatch[2]);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return {
        name: `Custom Location [${lat.toFixed(5)}, ${lng.toFixed(5)}]`,
        displayName: `Custom Coordinates (${lat.toFixed(6)}, ${lng.toFixed(6)})`,
        lat,
        lng,
        address: `Custom Coordinates (${lat.toFixed(6)}, ${lng.toFixed(6)})`,
        tag: "Custom GPS Coordinates",
      };
    }
  }

  return null;
}

/**
 * Fetch micro-locations (every society, building, chowk, sector, market) from Komoot Photon
 * with location proximity scoring centered around Gurugram / Delhi-NCR (28.3997, 77.0385)
 * Filtered strictly to India coordinates so foreign cities are never returned.
 */
async function fetchFromPhoton(query: string): Promise<PlaceItem[]> {
  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(
      query
    )}&lat=28.3997&lon=77.0385&limit=15`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: {
        Accept: "application/json",
      },
      next: { revalidate: 60 },
    });

    if (!res.ok) return [];

    const json = (await res.json()) as {
      features?: Array<{
        properties?: {
          name?: string;
          street?: string;
          housenumber?: string;
          district?: string;
          locality?: string;
          city?: string;
          state?: string;
          postcode?: string;
          type?: string;
          osm_value?: string;
          osm_key?: string;
          country?: string;
        };
        geometry?: {
          coordinates?: [number, number]; // [lon, lat]
        };
      }>;
    };

    if (!json.features || !Array.isArray(json.features)) return [];

    return json.features
      .filter((f) => {
        if (!f.geometry?.coordinates || f.geometry.coordinates.length !== 2) return false;
        const [lon, lat] = f.geometry.coordinates;
        // Strictly filter to India geography (lat 8° to 38°, lon 68° to 98°)
        return lat >= 8 && lat <= 38 && lon >= 68 && lon <= 98;
      })
      .map((f) => {
        const p = f.properties || {};
        const coords = f.geometry!.coordinates!;
        const lng = coords[0];
        const lat = coords[1];

        const rawName = p.name || p.street || p.district || "Location";
        const parts = [
          p.name,
          p.housenumber,
          p.street,
          p.district,
          p.locality,
          p.city,
          p.state,
        ].filter(Boolean) as string[];

        // Remove adjacent duplicates e.g. "Gurgaon, Gurgaon"
        const cleanParts = parts.filter((val, i, arr) => arr.indexOf(val) === i);
        const displayName = cleanParts.slice(0, 4).join(", ") || rawName;

        let tag = (p.osm_value || p.type || "SITE").toUpperCase();
        if (tag === "YES" || tag === "HOUSE") tag = "RESIDENTIAL";
        if (tag === "MALL" || tag === "SHOP") tag = "COMMERCIAL";

        return {
          name: rawName.slice(0, 70),
          displayName: displayName.slice(0, 140),
          lat: Number(lat),
          lng: Number(lng),
          address: displayName.slice(0, 150),
          tag: tag.slice(0, 14),
        };
      });
  } catch {
    return [];
  }
}

/**
 * Fetch from OpenStreetMap Nominatim with country code filter for India
 */
async function fetchFromNominatim(query: string): Promise<PlaceItem[]> {
  try {
    let effectiveQuery = query;
    if (
      /^(sec|sector)\s*\d+/i.test(query) &&
      !/gurugram|gurgaon|delhi|haryana/i.test(query)
    ) {
      effectiveQuery = `${query}, Gurugram, Haryana`;
    }

    const searchUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
      effectiveQuery
    )}&countrycodes=in&limit=10&addressdetails=1`;

    const res = await fetch(searchUrl, {
      signal: AbortSignal.timeout(5000),
      headers: {
        "User-Agent": "RealtySmartzHRMS/1.0 (internal-hr; contact@realtysmartz.in)",
        Accept: "application/json",
      },
      next: { revalidate: 60 },
    });

    if (!res.ok) return [];

    const data = (await res.json()) as Array<{
      name?: string;
      display_name: string;
      lat: string;
      lon: string;
      type?: string;
    }>;

    return data.map((item) => {
      const rawName = item.name || item.display_name.split(",")[0].trim();
      const parts = item.display_name.split(",").map((s) => s.trim());
      const cleanShort = parts.slice(0, 4).join(", ");
      return {
        name: rawName.slice(0, 70),
        displayName: cleanShort.slice(0, 140),
        lat: Number(item.lat),
        lng: Number(item.lon),
        address: cleanShort.slice(0, 150),
        tag: item.type ? item.type.toUpperCase().slice(0, 14) : "LOCATION",
      };
    });
  } catch {
    return [];
  }
}

/**
 * High-speed Open-Meteo geocoding fallback for Indian cities, towns, and localities
 */
async function fetchFromOpenMeteo(query: string): Promise<PlaceItem[]> {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      query
    )}&count=8&language=en&format=json`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(4000),
      headers: { Accept: "application/json" },
      next: { revalidate: 60 },
    });

    if (!res.ok) return [];

    const data = (await res.json()) as {
      results?: Array<{
        name: string;
        latitude: number;
        longitude: number;
        country_code?: string;
        country?: string;
        admin1?: string;
        admin2?: string;
      }>;
    };

    if (!data.results || !Array.isArray(data.results)) return [];

    return data.results
      .filter((r) => r.country_code === "IN" || r.country === "India")
      .map((r) => {
        const parts = [r.name, r.admin2, r.admin1, r.country].filter(Boolean);
        const displayName = parts.join(", ");
        return {
          name: r.name,
          displayName,
          lat: r.latitude,
          lng: r.longitude,
          address: displayName,
          tag: "TOWN / DISTRICT",
        };
      });
  } catch {
    return [];
  }
}

/**
 * Handles:
 * 1. Forward Geocoding / Search Autocomplete: ?q=<search_text>
 *    - Exact Google Maps links & GPS coordinates parsed instantly
 *    - Dynamic Gurugram Sector Resolver (Sector 1 to Sector 115)
 *    - Comprehensive curated registry of 100+ NCR builder projects & tech parks
 *    - Multi-tier online geocoding (Photon + Nominatim + Open-Meteo) strictly filtered to India
 * 2. Reverse Geocoding: ?lat=<number>&lng=<number>
 */
export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q")?.trim();
  const lat = req.nextUrl.searchParams.get("lat");
  const lng = req.nextUrl.searchParams.get("lng");

  // CASE 1: Location search / autocomplete
  if (query) {
    const qLower = query.toLowerCase();

    // 1. Direct coordinate or Google Maps URL parsing
    const directCoords = await parseCoordinatesFromQuery(query);
    const directMatch: PlaceItem[] = directCoords ? [directCoords] : [];

    // 2. Dynamic Sector matcher (e.g. "Sector 82", "Sec 106", "Sector 37D", etc.)
    const sectorMatch = matchSectorQuery(query);
    const sectorList: PlaceItem[] = sectorMatch ? [sectorMatch] : [];

    // 3. Curated instant local registry match (Multi-token flexible matching)
    const words = qLower.split(/[\s,]+/).filter((w) => w.length > 0);
    const localMatches: PlaceItem[] = POPULAR_HUBS.filter((h) => {
      const name = h.name.toLowerCase();
      const disp = h.displayName.toLowerCase();
      const addr = h.address.toLowerCase();
      const tag = (h.tag || "").toLowerCase();

      if (words.length > 1) {
        return words.every(
          (w) => name.includes(w) || disp.includes(w) || addr.includes(w) || tag.includes(w)
        );
      }
      return (
        name.includes(qLower) ||
        disp.includes(qLower) ||
        addr.includes(qLower) ||
        tag.includes(qLower)
      );
    });

    // 4. Parallel fetch: Photon (hyper-local micro locations) + Nominatim + Open-Meteo
    const [photonSettled, nominatimSettled, meteoSettled] = await Promise.allSettled([
      fetchFromPhoton(query),
      fetchFromNominatim(query),
      fetchFromOpenMeteo(query),
    ]);

    const photonMatches = photonSettled.status === "fulfilled" ? photonSettled.value : [];
    const nominatimMatches = nominatimSettled.status === "fulfilled" ? nominatimSettled.value : [];
    const meteoMatches = meteoSettled.status === "fulfilled" ? meteoSettled.value : [];

    // Combine in priority order: Direct GPS Pin -> Sector Match -> Curated Projects -> Online Micro-Sites
    const combined = [
      ...directMatch,
      ...sectorList,
      ...localMatches,
      ...photonMatches,
      ...nominatimMatches,
      ...meteoMatches,
    ];

    // Deduplicate items that have nearly identical coordinates (~100m) or identical names
    const unique = new Map<string, PlaceItem>();

    for (const item of combined) {
      // Key on rounded coordinates (3 decimal places ~ 110 meters) + normalized name prefix
      const normName = item.name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);
      const geoKey = `${item.lat.toFixed(3)}_${item.lng.toFixed(3)}_${normName}`;

      if (!unique.has(geoKey)) {
        unique.set(geoKey, item);
      }
    }

    return NextResponse.json({
      results: Array.from(unique.values()).slice(0, 25),
    });
  }

  // CASE 2: Reverse geocode with lat and lng
  if (!lat || !lng) {
    return NextResponse.json(
      { error: "Provide either ?q=<search> or ?lat=<lat>&lng=<lng>" },
      { status: 400 }
    );
  }

  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(4500),
      headers: {
        "User-Agent": "RealtySmartzHRMS/1.0 (internal-hr; contact@realtysmartz.in)",
        Accept: "application/json",
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Geocoding provider error" }, { status: 502 });
    }

    const data = (await res.json()) as {
      display_name?: string;
      name?: string;
      address?: Record<string, string>;
    };

    const addr = data.address ?? {};
    let placeName =
      data.name ||
      addr.building ||
      addr.amenity ||
      addr.office ||
      addr.shop ||
      addr.road ||
      addr.neighbourhood ||
      addr.suburb ||
      addr.village ||
      addr.town ||
      addr.city ||
      "Realty Smartz Private Limited";

    let address = data.display_name || `${lat}, ${lng}`;

    if (!placeName || /sunbreeze/i.test(placeName) || placeName === "Current location") {
      placeName = "Realty Smartz Private Limited";
    }

    if (/sunbreeze/i.test(address)) {
      address = address.replace(/sunbreeze/gi, "Realty Smartz Private Limited");
    }

    return NextResponse.json({
      name: placeName.slice(0, 70),
      address: address.slice(0, 150),
      lat: Number(lat),
      lng: Number(lng),
    });
  } catch {
    return NextResponse.json({ error: "Failed to contact geocoding provider" }, { status: 502 });
  }
}
