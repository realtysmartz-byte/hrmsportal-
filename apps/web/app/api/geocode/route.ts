import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  POPULAR_HUBS,
  matchSectorQuery,
  type PlaceItem,
} from "@/lib/places-registry";

const MAX_QUERY_LENGTH = 600;
const SHORT_MAPS_URL =
  /^https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps)\/[A-Za-z0-9_-]+(?:\?[^\s#]*)?$/i;
const MAPS_LINK =
  /^https?:\/\/(?:(?:www\.)?google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)/i;

/**
 * Resolves a Google Maps short link by reading up to two redirect hops.
 * Only exact maps.app.goo.gl / goo.gl/maps URLs are fetched, and each hop must land on a Google Maps URL,
 * so user input can't make the server call arbitrary hosts.
 */
async function resolveShortMapsUrl(url: string): Promise<string | null> {
  let current = url;
  for (let hop = 0; hop < 2; hop++) {
    try {
      const res = await fetch(current, {
        redirect: "manual",
        signal: AbortSignal.timeout(4000),
      });
      const location = res.headers.get("location");
      if (!location) return hop === 0 ? null : current;
      const next = new URL(location, current).toString();
      if (!MAPS_LINK.test(next)) return null;
      if (!SHORT_MAPS_URL.test(next)) return next;
      current = next;
    } catch {
      return null;
    }
  }
  return current;
}

function isValidLatLng(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/** Place name from links like https://www.google.com/maps/place/M3M+Urbana/@... */
function placeNameFromMapsUrl(url: string): string | null {
  const m = url.match(/\/maps\/place\/([^/@?]+)/);
  if (!m) return null;
  try {
    const name = decodeURIComponent(m[1].replace(/\+/g, " ")).trim();
    return name && !/^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(name) ? name.slice(0, 180) : null;
  } catch {
    return null;
  }
}

/**
 * Parses exact coordinates from direct lat/lng inputs or Google Maps links (full or short).
 * `placeName` is returned for links that name a place, even when they carry no coordinates.
 */
async function parseCoordinatesFromQuery(
  query: string
): Promise<{ item: PlaceItem | null; placeName: string | null }> {
  let q = query.trim();

  if (SHORT_MAPS_URL.test(q)) {
    q = (await resolveShortMapsUrl(q)) ?? q;
  }

  const placeName = placeNameFromMapsUrl(q);
  const pin = (lat: number, lng: number, tag: string): PlaceItem => ({
    name: placeName ?? `Pinned location [${lat.toFixed(5)}, ${lng.toFixed(5)}]`,
    displayName: placeName
      ? `${placeName} (${lat.toFixed(6)}, ${lng.toFixed(6)})`
      : `Google Maps pin (${lat.toFixed(6)}, ${lng.toFixed(6)})`,
    lat,
    lng,
    address: `Coordinates: ${lat.toFixed(6)}, ${lng.toFixed(6)}`,
    tag,
  });

  // 1. Exact place pin inside place links: ...!3d28.39972!4d77.03857
  const exactPin = q.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (exactPin) {
    const lat = parseFloat(exactPin[1]);
    const lng = parseFloat(exactPin[2]);
    if (isValidLatLng(lat, lng)) return { item: pin(lat, lng, "EXACT GPS PIN"), placeName };
  }

  // 2. ?q=lat,lng / query= / destination= / ll= links, and /maps/search/lat,lng
  const paramMatch =
    q.match(/[?&](?:q|query|destination|ll|saddr|daddr)=(-?\d+\.\d+)(?:,|%2C)\+?(-?\d+\.\d+)/i) ||
    q.match(/\/maps\/(?:search|place|dir)\/(-?\d+\.\d+),\+?(-?\d+\.\d+)/);
  if (paramMatch) {
    const lat = parseFloat(paramMatch[1]);
    const lng = parseFloat(paramMatch[2]);
    if (isValidLatLng(lat, lng)) return { item: pin(lat, lng, "GOOGLE MAPS PIN"), placeName };
  }

  // 3. Map viewport centre: /maps/@28.3997,77.0385,17z (less exact than a place pin)
  const gmapUrlMatch = q.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (gmapUrlMatch) {
    const lat = parseFloat(gmapUrlMatch[1]);
    const lng = parseFloat(gmapUrlMatch[2]);
    if (isValidLatLng(lat, lng)) return { item: pin(lat, lng, "MAP CENTRE"), placeName };
  }

  // 4. Pattern: Direct lat, lng string like "28.3997, 77.0385" or "40.7128, -74.0060"
  const directCoordMatch = q.match(/^(-?\d{1,2}\.\d+)[,\s]+(-?\d{1,3}\.\d+)$/);
  if (directCoordMatch) {
    const lat = parseFloat(directCoordMatch[1]);
    const lng = parseFloat(directCoordMatch[2]);
    if (isValidLatLng(lat, lng)) {
      return {
        item: {
          name: `Custom Location [${lat.toFixed(5)}, ${lng.toFixed(5)}]`,
          displayName: `Custom Coordinates (${lat.toFixed(6)}, ${lng.toFixed(6)})`,
          lat,
          lng,
          address: `Custom Coordinates (${lat.toFixed(6)}, ${lng.toFixed(6)})`,
          tag: "GPS COORDINATES",
        },
        placeName,
      };
    }
  }

  return { item: null, placeName };
}

/**
 * Fetch from official Google Places Text Search API if a Google Maps API Key is configured.
 * Covers every business, street, building, and location worldwide with 100% Google Maps fidelity.
 */
async function fetchFromGooglePlaces(query: string): Promise<PlaceItem[]> {
  const apiKey =
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey || apiKey.trim() === "" || apiKey === '""') return [];

  try {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
      query
    )}&key=${apiKey}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];

    const data = (await res.json()) as {
      status?: string;
      results?: Array<{
        name?: string;
        formatted_address?: string;
        geometry?: { location?: { lat?: number; lng?: number } };
        types?: string[];
      }>;
    };

    if (data.status !== "OK" || !Array.isArray(data.results)) return [];

    return data.results
      .filter((r) => r.geometry?.location?.lat != null && r.geometry?.location?.lng != null)
      .map((r) => {
        const lat = r.geometry!.location!.lat!;
        const lng = r.geometry!.location!.lng!;
        const name = r.name || r.formatted_address?.split(",")[0] || "Location";
        const displayName = r.formatted_address || name;
        const tag = (r.types?.[0] || "GOOGLE PLACE").replace(/_/g, " ").toUpperCase();

        return {
          name: name.slice(0, 80),
          displayName: displayName.slice(0, 150),
          lat: Number(lat),
          lng: Number(lng),
          address: displayName.slice(0, 160),
          tag: tag.slice(0, 18),
        };
      });
  } catch {
    return [];
  }
}

/**
 * Worldwide micro-locations (every society, building, chowk, street, market, town)
 * from Komoot Photon OpenStreetMap index covering the WHOLE WORLD.
 * NO country filter or coordinate bounding box restrictions.
 */
async function fetchWorldwideFromPhoton(query: string): Promise<PlaceItem[]> {
  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=15`;

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
      .filter((f) => f.geometry?.coordinates?.length === 2)
      .map((f) => {
        const p = f.properties || {};
        const coords = f.geometry!.coordinates!;
        const lng = coords[0];
        const lat = coords[1];

        const rawName = p.name || p.street || p.district || p.city || "Location";
        const parts = [
          p.name,
          p.housenumber,
          p.street,
          p.district,
          p.locality,
          p.city,
          p.state,
          p.country,
        ].filter(Boolean) as string[];

        // Remove adjacent/identical duplicates e.g. "Dubai, Dubai"
        const cleanParts = parts.filter((val, i, arr) => arr.indexOf(val) === i);
        const displayName = cleanParts.slice(0, 5).join(", ") || rawName;

        let tag = (p.osm_value || p.type || "SITE").toUpperCase();
        if (tag === "YES" || tag === "HOUSE") tag = "RESIDENTIAL";
        if (tag === "MALL" || tag === "SHOP") tag = "COMMERCIAL";

        return {
          name: rawName.slice(0, 80),
          displayName: displayName.slice(0, 150),
          lat: Number(lat),
          lng: Number(lng),
          address: displayName.slice(0, 160),
          tag: tag.slice(0, 18),
        };
      });
  } catch {
    return [];
  }
}

/**
 * Fetch from OpenStreetMap Nominatim across the WHOLE WORLD.
 * NO country code restrictions.
 */
async function fetchWorldwideFromNominatim(query: string): Promise<PlaceItem[]> {
  try {
    const searchUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
      query
    )}&limit=12&addressdetails=1`;

    const res = await fetch(searchUrl, {
      signal: AbortSignal.timeout(5000),
      headers: {
        "User-Agent": "RealtySmartzHRMS/1.0 (global-portal; contact@realtysmartz.in)",
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

    if (!Array.isArray(data)) return [];

    return data.map((item) => {
      const rawName = item.name || item.display_name.split(",")[0].trim();
      const parts = item.display_name.split(",").map((s) => s.trim());
      const cleanShort = parts.slice(0, 5).join(", ");
      return {
        name: rawName.slice(0, 80),
        displayName: cleanShort.slice(0, 150),
        lat: Number(item.lat),
        lng: Number(item.lon),
        address: cleanShort.slice(0, 160),
        tag: item.type ? item.type.toUpperCase().slice(0, 18) : "LOCATION",
      };
    });
  } catch {
    return [];
  }
}

/**
 * High-speed Open-Meteo geocoding fallback for cities, towns, and localities worldwide.
 * NO country filter.
 */
async function fetchWorldwideFromOpenMeteo(query: string): Promise<PlaceItem[]> {
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

    return data.results.map((r) => {
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
 *    - Google Places API (if API Key provided) -> 100% native Google Maps results
 *    - Exact Google Maps links & GPS coordinates parsed instantly worldwide
 *    - Worldwide Komoot Photon OpenStreetMap index (every street, building, village, landmark)
 *    - Worldwide OpenStreetMap Nominatim search across all 195+ countries
 *    - Worldwide Open-Meteo cities, towns, and districts
 *    - Dynamic Gurugram Sector Resolver & Project Registry (as offline assistance, not restrictive)
 * 2. Reverse Geocoding: ?lat=<number>&lng=<number>
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const query = req.nextUrl.searchParams.get("q")?.trim();
  const lat = req.nextUrl.searchParams.get("lat");
  const lng = req.nextUrl.searchParams.get("lng");

  if (query && query.length > MAX_QUERY_LENGTH) {
    return NextResponse.json({ error: "Query too long" }, { status: 400 });
  }

  // CASE 1: Location search / autocomplete
  if (query) {
    // 1. Direct coordinate or Google Maps URL parsing
    const parsed = await parseCoordinatesFromQuery(query);
    const isLink = MAPS_LINK.test(query);
    if (isLink && parsed.item) {
      return NextResponse.json({ results: [parsed.item] });
    }
    if (isLink && !parsed.placeName) {
      return NextResponse.json({ results: [] });
    }
    // A link that names a place but has no coordinates is searched by that name
    const searchQuery = isLink ? parsed.placeName! : query;
    const qLower = searchQuery.toLowerCase();
    const directMatch: PlaceItem[] = parsed.item ? [parsed.item] : [];

    // 2. Official Google Places Text Search (if Google Maps API Key is active)
    const googlePromise = fetchFromGooglePlaces(searchQuery);

    // 3. Dynamic Sector matcher helper (e.g. "Sector 82", "Sec 106", "Sector 37D", etc.)
    const sectorMatch = matchSectorQuery(searchQuery);
    const sectorList: PlaceItem[] = sectorMatch ? [sectorMatch] : [];

    // 4. Quick match for known builder projects / hubs
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

    // 5. Parallel fetch from worldwide geocoding engines
    const [googleSettled, photonSettled, nominatimSettled, meteoSettled] =
      await Promise.allSettled([
        googlePromise,
        fetchWorldwideFromPhoton(searchQuery),
        fetchWorldwideFromNominatim(searchQuery),
        fetchWorldwideFromOpenMeteo(searchQuery),
      ]);

    const googleMatches = googleSettled.status === "fulfilled" ? googleSettled.value : [];
    const photonMatches = photonSettled.status === "fulfilled" ? photonSettled.value : [];
    const nominatimMatches =
      nominatimSettled.status === "fulfilled" ? nominatimSettled.value : [];
    const meteoMatches = meteoSettled.status === "fulfilled" ? meteoSettled.value : [];

    // Priority ordering:
    // 1. Direct GPS / Google link
    // 2. Official Google Places results (if available)
    // 3. Sector & project helpers
    // 4. Worldwide Photon (micro places, streets, buildings globally)
    // 5. Worldwide Nominatim
    // 6. Worldwide Open-Meteo
    const combined = [
      ...directMatch,
      ...googleMatches,
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
      results: Array.from(unique.values()).slice(0, 30),
    });
  }

  // CASE 2: Reverse geocode with lat and lng
  if (!lat || !lng) {
    return NextResponse.json(
      { error: "Provide either ?q=<search> or ?lat=<lat>&lng=<lng>" },
      { status: 400 }
    );
  }

  const numLat = parseFloat(lat);
  const numLng = parseFloat(lng);
  if (
    !Number.isFinite(numLat) ||
    !Number.isFinite(numLng) ||
    numLat < -90 ||
    numLat > 90 ||
    numLng < -180 ||
    numLng > 180
  ) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  // If Google Maps API key is configured, use Google Reverse Geocoding
  const apiKey =
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (apiKey && apiKey.trim() !== "" && apiKey !== '""') {
    try {
      const gUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${numLat},${numLng}&key=${apiKey}`;
      const gRes = await fetch(gUrl, { signal: AbortSignal.timeout(4000) });
      if (gRes.ok) {
        const gData = (await gRes.json()) as {
          status?: string;
          results?: Array<{
            formatted_address?: string;
            address_components?: Array<{ long_name?: string; types?: string[] }>;
          }>;
        };
        if (gData.status === "OK" && gData.results && gData.results.length > 0) {
          const first = gData.results[0];
          const name =
            first.address_components?.[0]?.long_name ||
            first.formatted_address?.split(",")[0] ||
            "Location";
          return NextResponse.json({
            name: name.slice(0, 80),
            address: (first.formatted_address || `${numLat}, ${numLng}`).slice(0, 160),
            lat: numLat,
            lng: numLng,
          });
        }
      }
    } catch {
      // Fallback to OpenStreetMap reverse geocoding
    }
  }

  // OpenStreetMap reverse geocode
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${numLat}&lon=${numLng}&addressdetails=1`;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(4500),
      headers: {
        "User-Agent": "RealtySmartzHRMS/1.0 (global-portal; contact@realtysmartz.in)",
        Accept: "application/json",
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return NextResponse.json({
        name: `Location [${numLat.toFixed(5)}, ${numLng.toFixed(5)}]`,
        address: `Coordinates: ${numLat.toFixed(6)}, ${numLng.toFixed(6)}`,
        lat: numLat,
        lng: numLng,
      });
    }

    const data = (await res.json()) as {
      display_name?: string;
      name?: string;
      address?: Record<string, string>;
    };

    const addr = data.address ?? {};
    const placeName =
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
      `Location [${numLat.toFixed(5)}, ${numLng.toFixed(5)}]`;

    const address = data.display_name || `${numLat}, ${numLng}`;

    return NextResponse.json({
      name: placeName.slice(0, 80),
      address: address.slice(0, 160),
      lat: numLat,
      lng: numLng,
    });
  } catch {
    return NextResponse.json({
      name: `Location [${numLat.toFixed(5)}, ${numLng.toFixed(5)}]`,
      address: `Coordinates: ${numLat.toFixed(6)}, ${numLng.toFixed(6)}`,
      lat: numLat,
      lng: numLng,
    });
  }
}
