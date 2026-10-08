import { NextRequest, NextResponse } from "next/server";

// Comprehensive curated registry of Gurugram / Delhi-NCR commercial, tech & project hubs
const POPULAR_HUBS = [
  {
    name: "REALTY SMARTZ PVT LTD (HQ)",
    displayName: "REALTY SMARTZ PVT LTD, Badshahpur, Sector 66, Gurugram, Haryana 122101",
    lat: 28.3997196,
    lng: 77.0385682,
    address: "REALTY SMARTZ PVT LTD, Badshahpur, Sector 66, Gurugram, Haryana 122101",
    tag: "Official HQ Office",
  },
  {
    name: "M3M Urbana",
    displayName: "M3M Urbana, Golf Course Extension Road, Sector 67, Gurugram 122102",
    lat: 28.397521,
    lng: 77.062085,
    address: "M3M Urbana, Sector 67, Golf Course Ext Rd, Gurugram",
    tag: "Commercial Hub",
  },
  {
    name: "M3M Golf Estate",
    displayName: "M3M Golf Estate, Golf Course Extension Rd, Sector 65, Gurugram 122101",
    lat: 28.4011436,
    lng: 77.0664133,
    address: "M3M Golf Estate, Sector 65, Gurugram",
    tag: "Luxury Residential",
  },
  {
    name: "M3M IFC (International Financial Center)",
    displayName: "M3M IFC, Golf Course Extension Road, Sector 66, Gurugram 122002",
    lat: 28.4049117,
    lng: 77.0584264,
    address: "M3M IFC, Sector 66, Gurugram",
    tag: "Corporate Tower",
  },
  {
    name: "M3M Broadway",
    displayName: "M3M Broadway, Golf Course Extension Road, Sector 71, Gurugram 122001",
    lat: 28.392941,
    lng: 77.017832,
    address: "M3M Broadway, Sector 71, Gurugram",
    tag: "Commercial Complex",
  },
  {
    name: "M3M Cosmopolitan",
    displayName: "M3M Cosmopolitan, Golf Course Ext Rd, Sector 66, Gurugram 122001",
    lat: 28.4019442,
    lng: 77.0598657,
    address: "M3M Cosmopolitan, Sector 66, Gurugram",
    tag: "Retail & Offices",
  },
  {
    name: "M3M Corner Walk",
    displayName: "M3M Corner Walk, Sector 74, Gurugram 122004",
    lat: 28.4022405,
    lng: 77.0083793,
    address: "M3M Corner Walk, Sector 74, Gurugram",
    tag: "Commercial Project",
  },
  {
    name: "M3M Skywalk",
    displayName: "M3M Skywalk, Sector 74, SPR Road, Gurugram 122004",
    lat: 28.399512,
    lng: 77.010254,
    address: "M3M Skywalk, Sector 74, Gurugram",
    tag: "Mixed Development",
  },
  {
    name: "M3M Atrium 57",
    displayName: "M3M Atrium 57, Sector 57, Gurugram 122003",
    lat: 28.431201,
    lng: 77.078912,
    address: "M3M Atrium 57, Sector 57, Gurugram",
    tag: "High Street Retail",
  },
  {
    name: "M3M Capital",
    displayName: "M3M Capital, Sector 113, Dwarka Expressway, Gurugram 122017",
    lat: 28.528412,
    lng: 77.031548,
    address: "M3M Capital, Sector 113, Dwarka Expressway, Gurugram",
    tag: "Residential Project",
  },
  {
    name: "M3M Crown",
    displayName: "M3M Crown, Sector 111, Dwarka Expressway, Gurugram 122017",
    lat: 28.531204,
    lng: 77.027891,
    address: "M3M Crown, Sector 111, Dwarka Expressway, Gurugram",
    tag: "Luxury Project",
  },
  {
    name: "M3M Antalya Hills",
    displayName: "M3M Antalya Hills, Sector 79, Gurugram 122004",
    lat: 28.361521,
    lng: 76.989214,
    address: "M3M Antalya Hills, Sector 79, Gurugram",
    tag: "Hillside Homes",
  },
  {
    name: "M3M Jewel",
    displayName: "M3M Jewel, Sector 25, MG Road, Gurugram 122002",
    lat: 28.483912,
    lng: 77.086411,
    address: "M3M Jewel, Sector 25, MG Road, Gurugram",
    tag: "Luxury Retail",
  },
  {
    name: "M3M Route 65",
    displayName: "M3M Route 65, Sector 65, Golf Course Ext Rd, Gurugram 122101",
    lat: 28.404121,
    lng: 77.068914,
    address: "M3M Route 65, Sector 65, Gurugram",
    tag: "High Street Commercial",
  },
  {
    name: "M3M Soulitude",
    displayName: "M3M Soulitude, Sector 89, New Gurugram 122505",
    lat: 28.409514,
    lng: 76.941205,
    address: "M3M Soulitude, Sector 89, Gurugram",
    tag: "Low Rise Floors",
  },
  {
    name: "M3M Merlin",
    displayName: "M3M Merlin, Sector 67, Golf Course Ext Rd, Gurugram 122102",
    lat: 28.396102,
    lng: 77.059412,
    address: "M3M Merlin, Sector 67, Gurugram",
    tag: "Singapore Style Residences",
  },
  {
    name: "M3M Woodshire",
    displayName: "M3M Woodshire, Sector 107, Dwarka Expressway, Gurugram 122006",
    lat: 28.514211,
    lng: 76.994512,
    address: "M3M Woodshire, Sector 107, Gurugram",
    tag: "Residential Complex",
  },
  {
    name: "M3M Heights",
    displayName: "M3M Heights, Sector 65, Golf Course Ext Rd, Gurugram 122101",
    lat: 28.402511,
    lng: 77.067124,
    address: "M3M Heights, Sector 65, Gurugram",
    tag: "Tower Living",
  },
  {
    name: "M3M Skylofts",
    displayName: "M3M Skylofts, Sector 71, SPR, Gurugram 122001",
    lat: 28.393112,
    lng: 77.018412,
    address: "M3M Skylofts, Sector 71, Gurugram",
    tag: "Service Apartments",
  },
  {
    name: "DLF Cyber City",
    displayName: "DLF Cyber City, DLF Phase 2, Sector 24, Gurugram 122002",
    lat: 28.4906,
    lng: 77.0898,
    address: "DLF Cyber City, DLF Phase 2, Gurugram",
    tag: "Tech Park",
  },
  {
    name: "DLF Cyber Hub",
    displayName: "DLF Cyber Hub, DLF Phase 2, Gurugram 122002",
    lat: 28.4952,
    lng: 77.0886,
    address: "DLF Cyber Hub, Gurugram",
    tag: "Dining & Commercial",
  },
  {
    name: "DLF Downtown",
    displayName: "DLF Downtown, Sector 25A, DLF Phase 3, Gurugram 122002",
    lat: 28.4912,
    lng: 77.0945,
    address: "DLF Downtown, Sector 25A, Gurugram",
    tag: "Grade A Offices",
  },
  {
    name: "DLF Horizon Center",
    displayName: "One Horizon Center, Golf Course Road, Sector 43, Gurugram 122002",
    lat: 28.4725,
    lng: 77.0968,
    address: "One Horizon Center, Golf Course Rd, Gurugram",
    tag: "Corporate Towers",
  },
  {
    name: "DLF The Camellias",
    displayName: "DLF The Camellias, Golf Course Road, Sector 42, Gurugram 122002",
    lat: 28.4682,
    lng: 77.0984,
    address: "DLF Camellias, Sector 42, Gurugram",
    tag: "Ultra Luxury",
  },
  {
    name: "AIPL Joy Central",
    displayName: "AIPL Joy Central, Sector 65, Golf Course Ext Rd, Gurugram 122101",
    lat: 28.4062,
    lng: 77.0641,
    address: "AIPL Joy Central, Sector 65, Gurugram",
    tag: "Commercial Retail",
  },
  {
    name: "AIPL Joy Street",
    displayName: "AIPL Joy Street, Sector 66, Golf Course Ext Rd, Gurugram 122101",
    lat: 28.4035,
    lng: 77.0542,
    address: "AIPL Joy Street, Sector 66, Gurugram",
    tag: "Retail & Offices",
  },
  {
    name: "Emaar Palm Drive",
    displayName: "Emaar The Palm Drive, Golf Course Ext Rd, Sector 66, Gurugram 122002",
    lat: 28.4018,
    lng: 77.0519,
    address: "Emaar Palm Drive, Sector 66, Gurugram",
    tag: "Luxury Residential",
  },
  {
    name: "Central Park Resorts",
    displayName: "Central Park Resorts, Sector 48, Sohna Road, Gurugram 122018",
    lat: 28.4234,
    lng: 77.0389,
    address: "Central Park Resorts, Sector 48, Gurugram",
    tag: "Luxury Township",
  },
  {
    name: "Vipul Tech Square",
    displayName: "Vipul Tech Square, Golf Course Road, Sector 43, Gurugram 122002",
    lat: 28.4651,
    lng: 77.0942,
    address: "Vipul Tech Square, Sector 43, Gurugram",
    tag: "IT Park",
  },
  {
    name: "Spaze i-Tech Park",
    displayName: "Spaze i-Tech Park, Sector 49, Sohna Road, Gurugram 122018",
    lat: 28.4145,
    lng: 77.0421,
    address: "Spaze i-Tech Park, Sector 49, Gurugram",
    tag: "Commercial Offices",
  },
  {
    name: "Omaxe Chowk",
    displayName: "Omaxe Chowk, Chandni Chowk, Delhi 110006",
    lat: 28.6562,
    lng: 77.2307,
    address: "Chandni Chowk, Old Delhi",
    tag: "Commercial Center",
  },
];

// Helper to extract coordinates from Google Maps URLs or direct lat,lng strings
function parseCoordinatesFromQuery(query: string): { lat: number; lng: number; label: string } | null {
  const q = query.trim();

  // Pattern 1: Google Maps URL containing @lat,lng or place/.../@lat,lng
  const gmapUrlMatch = q.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (gmapUrlMatch) {
    const lat = parseFloat(gmapUrlMatch[1]);
    const lng = parseFloat(gmapUrlMatch[2]);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng, label: "Google Maps Pinpoint" };
    }
  }

  // Pattern 2: ?q=lat,lng or destination=lat,lng or query=lat,lng
  const paramMatch = q.match(/[?&](?:q|query|destination|ll|saddr|daddr)=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (paramMatch) {
    const lat = parseFloat(paramMatch[1]);
    const lng = parseFloat(paramMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) {
      return { lat, lng, label: "Google Maps Coordinate Link" };
    }
  }

  // Pattern 3: Direct lat, lng string like "28.3997, 77.0385" or "28.3997196 77.0385682"
  const directCoordMatch = q.match(/^(-?\d{1,2}\.\d+)[,\s]+(-?\d{1,3}\.\d+)$/);
  if (directCoordMatch) {
    const lat = parseFloat(directCoordMatch[1]);
    const lng = parseFloat(directCoordMatch[2]);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng, label: `Custom Coordinates (${lat.toFixed(5)}, ${lng.toFixed(5)})` };
    }
  }

  return null;
}

/**
 * Handles:
 * 1. Forward Geocoding / Search Autocomplete: ?q=<search_text>
 *    - Google Maps links & coordinates parsed directly
 *    - Curated registry of all M3M, DLF, & Gurugram commercial hubs
 *    - OpenStreetMap Nominatim with viewbox priority bias for Delhi NCR
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
    const directCoords = parseCoordinatesFromQuery(query);
    const directMatch = directCoords
      ? [
          {
            name: directCoords.label,
            displayName: `${directCoords.label} [${directCoords.lat.toFixed(5)}, ${directCoords.lng.toFixed(5)}]`,
            lat: directCoords.lat,
            lng: directCoords.lng,
            address: `Coordinates: ${directCoords.lat.toFixed(6)}, ${directCoords.lng.toFixed(6)}`,
            tag: "Exact GPS Pin",
          },
        ]
      : [];

    // 2. Curated instant local registry match
    const localMatches = POPULAR_HUBS.filter((h) => {
      const name = h.name.toLowerCase();
      const disp = h.displayName.toLowerCase();
      const addr = h.address.toLowerCase();

      // Check if user is searching for tokens e.g. "m3m 65" or "urbana"
      const words = qLower.split(/[\s,]+/).filter((w) => w.length > 1);
      if (words.length > 1) {
        return words.every((w) => name.includes(w) || disp.includes(w) || addr.includes(w));
      }
      return name.includes(qLower) || disp.includes(qLower) || addr.includes(qLower);
    });

    // 3. Fetch live results from OpenStreetMap Nominatim
    let remoteMatches: Array<{
      name: string;
      displayName: string;
      lat: number;
      lng: number;
      address: string;
      tag?: string;
    }> = [];

    // Optimize search query for local Delhi-NCR / Gurugram
    let effectiveQuery = query;
    if (/^(sec|sector)\s*\d+/i.test(query) && !/gurugram|gurgaon|delhi|haryana/i.test(query)) {
      effectiveQuery = `${query}, Gurugram, Haryana`;
    }

    try {
      // Biased towards Gurugram & Delhi NCR with viewbox bounding
      const searchUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
        effectiveQuery
      )}&countrycodes=in&viewbox=76.80,28.62,77.28,28.25&bounded=0&limit=8&addressdetails=1`;

      const res = await fetch(searchUrl, {
        headers: {
          "User-Agent": "RealtySmartzHRMS/1.0 (internal-hr; contact@realtysmartz.in)",
          Accept: "application/json",
        },
        next: { revalidate: 60 },
      });

      if (res.ok) {
        const data = (await res.json()) as Array<{
          name?: string;
          display_name: string;
          lat: string;
          lon: string;
          type?: string;
        }>;

        remoteMatches = data.map((item) => {
          const rawName = item.name || item.display_name.split(",")[0].trim();
          // Shorten display name so it never exceeds 120 chars
          const parts = item.display_name.split(",").map((s) => s.trim());
          const cleanShort = parts.slice(0, 4).join(", ");
          return {
            name: rawName.slice(0, 80),
            displayName: cleanShort.slice(0, 130),
            lat: Number(item.lat),
            lng: Number(item.lon),
            address: cleanShort.slice(0, 140),
            tag: item.type ? item.type.toUpperCase() : "LOCATION",
          };
        });
      }
    } catch {
      // If Nominatim fails or times out, localMatches will still respond instantly
    }

    // Combine: Direct GPS Pin -> Curated Projects -> Remote Nominatim
    const combined = [...directMatch, ...localMatches, ...remoteMatches];
    const unique = new Map<string, (typeof combined)[0]>();

    for (const item of combined) {
      const key = `${item.lat.toFixed(4)}_${item.lng.toFixed(4)}`;
      if (!unique.has(key)) {
        unique.set(key, item);
      }
    }

    return NextResponse.json({
      results: Array.from(unique.values()).slice(0, 12),
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
      name: placeName.slice(0, 80),
      address: address.slice(0, 150),
      lat: Number(lat),
      lng: Number(lng),
    });
  } catch {
    return NextResponse.json({ error: "Failed to contact geocoding provider" }, { status: 502 });
  }
}
