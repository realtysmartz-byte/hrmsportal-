import { NextRequest, NextResponse } from "next/server";

// Curated top Delhi-NCR / Gurugram commercial & residential hubs for instant zero-latency suggestions
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
    displayName: "M3M Urbana, Golf Course Extension Road, Sector 67, Gurugram, Haryana 122102",
    lat: 28.397521,
    lng: 77.062085,
    address: "M3M Urbana, Sector 67, Gurugram, Haryana",
    tag: "Commercial Hub",
  },
  {
    name: "M3M Golf Estate",
    displayName: "M3M Golf Estate, Golf Course Extension Rd, Sector 65, Gurugram, Haryana 122101",
    lat: 28.4011436,
    lng: 77.0664133,
    address: "M3M Golf Estate, Sector 65, Gurugram, Haryana",
    tag: "Luxury Residential",
  },
  {
    name: "M3M IFC (International Financial Center)",
    displayName: "M3M IFC, Sector 66, Golf Course Extension Road, Gurugram, Haryana 122002",
    lat: 28.4049117,
    lng: 77.0584264,
    address: "M3M IFC, Sector 66, Gurugram, Haryana",
    tag: "Corporate Tower",
  },
  {
    name: "M3M Broadway",
    displayName: "M3M Broadway, Golf Course Extension Road, Sector 71, Gurugram, Haryana 122001",
    lat: 28.392941,
    lng: 77.017832,
    address: "M3M Broadway, Sector 71, Gurugram, Haryana",
    tag: "Commercial Complex",
  },
  {
    name: "M3M Cosmopolitan",
    displayName: "M3M Cosmopolitan, Sector 66 / Sector 67, Gurugram, Haryana 122001",
    lat: 28.4019442,
    lng: 77.0598657,
    address: "M3M Cosmopolitan, Sector 66, Gurugram, Haryana",
    tag: "Retail & Offices",
  },
  {
    name: "M3M Corner Walk",
    displayName: "M3M Corner Walk, Sector 74, Gurugram, Haryana 122004",
    lat: 28.4022405,
    lng: 77.0083793,
    address: "M3M Corner Walk, Sector 74, Gurugram, Haryana",
    tag: "Commercial Project",
  },
  {
    name: "M3M Skywalk",
    displayName: "M3M Skywalk, Sector 74, SPR Road, Gurugram, Haryana 122004",
    lat: 28.399512,
    lng: 77.010254,
    address: "M3M Skywalk, Sector 74, Gurugram, Haryana",
    tag: "Mixed Development",
  },
  {
    name: "M3M Atrium 57",
    displayName: "M3M Atrium 57, Sector 57, Gurugram, Haryana 122003",
    lat: 28.431201,
    lng: 77.078912,
    address: "M3M Atrium 57, Sector 57, Gurugram, Haryana",
    tag: "High Street Retail",
  },
  {
    name: "DLF Cyber City",
    displayName: "DLF Cyber City, DLF Phase 2, Sector 24, Gurugram, Haryana 122002",
    lat: 28.4906,
    lng: 77.0898,
    address: "DLF Cyber City, DLF Phase 2, Gurugram, Haryana",
    tag: "Tech Park",
  },
  {
    name: "Omaxe Chowk",
    displayName: "Omaxe Chowk, Chandni Chowk, Delhi 110006",
    lat: 28.6562,
    lng: 77.2307,
    address: "Chandni Chowk, Delhi",
    tag: "Commercial Center",
  },
];

/**
 * Handles both:
 * 1. Forward Geocoding / Search Autocomplete: ?q=<search_text>
 * 2. Reverse Geocoding: ?lat=<number>&lng=<number>
 */
export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q")?.trim();
  const lat = req.nextUrl.searchParams.get("lat");
  const lng = req.nextUrl.searchParams.get("lng");

  // CASE 1: Location search / autocomplete
  if (query) {
    const qLower = query.toLowerCase();

    // 1. Check instant curated matches
    const localMatches = POPULAR_HUBS.filter(
      (h) =>
        h.name.toLowerCase().includes(qLower) ||
        h.displayName.toLowerCase().includes(qLower) ||
        h.address.toLowerCase().includes(qLower)
    );

    // 2. Fetch live results from OpenStreetMap Nominatim
    let remoteMatches: Array<{
      name: string;
      displayName: string;
      lat: number;
      lng: number;
      address: string;
      tag?: string;
    }> = [];

    try {
      const searchUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
        query
      )}&countrycodes=in&limit=8&addressdetails=1`;

      const res = await fetch(searchUrl, {
        headers: {
          "User-Agent":
            "RealtySmartzHRMS/1.0 (internal-hr; contact@realtysmartz.in)",
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

        remoteMatches = data.map((item) => ({
          name: item.name || item.display_name.split(",")[0].trim(),
          displayName: item.display_name,
          lat: Number(item.lat),
          lng: Number(item.lon),
          address: item.display_name,
          tag: item.type ? item.type.toUpperCase() : "LOCATION",
        }));
      }
    } catch {
      // If Nominatim fails or times out, localMatches will still respond instantly
    }

    // Combine & remove duplicate coordinates
    const combined = [...localMatches, ...remoteMatches];
    const unique = new Map<string, (typeof combined)[0]>();

    for (const item of combined) {
      const key = `${item.lat.toFixed(4)}_${item.lng.toFixed(4)}`;
      if (!unique.has(key)) {
        unique.set(key, item);
      }
    }

    return NextResponse.json({
      results: Array.from(unique.values()).slice(0, 10),
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
        "User-Agent":
          "RealtySmartzHRMS/1.0 (internal-hr; contact@realtysmartz.in)",
        Accept: "application/json",
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Geocoding provider error" },
        { status: 502 }
      );
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

    // Overwrite OSM "Sunbreeze" locality tag or generic strings with official corporate branding
    if (!placeName || /sunbreeze/i.test(placeName) || placeName === "Current location") {
      placeName = "Realty Smartz Private Limited";
    }

    if (/sunbreeze/i.test(address)) {
      address = address.replace(/sunbreeze/gi, "Realty Smartz Private Limited");
    }

    return NextResponse.json({
      name: placeName,
      address,
      lat: Number(lat),
      lng: Number(lng),
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to contact geocoding provider" },
      { status: 502 }
    );
  }
}

