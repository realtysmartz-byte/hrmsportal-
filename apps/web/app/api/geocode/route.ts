import { NextRequest, NextResponse } from "next/server";

/**
 * Proxies Nominatim reverse geocoding.
 * Returns a short place name + full address for check-in display.
 */
export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get("lat");
  const lng = req.nextUrl.searchParams.get("lng");

  if (!lat || !lng) {
    return NextResponse.json(
      { error: "lat and lng are required" },
      { status: 400 }
    );
  }

  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "RealtySmartzHRMS/1.0 (internal-hr; contact@realtysmartz.com)",
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
      "Current location";

    const address = data.display_name || `${lat}, ${lng}`;

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
