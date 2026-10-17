const ADDRESS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const ADDRESS_CACHE_MAX = 5000;

const addressCache = new Map<string, { address: string; at: number }>();

function coordinateKey(lat: number, lng: number) {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

export async function reverseGeocodePunchAddress(
  lat: number,
  lng: number
): Promise<string> {
  const key = coordinateKey(lat, lng);
  const cached = addressCache.get(key);
  if (cached && Date.now() - cached.at < ADDRESS_CACHE_TTL_MS) {
    return cached.address;
  }

  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("addressdetails", "1");

  const response = await fetch(url, {
    signal: AbortSignal.timeout(4500),
    headers: {
      "User-Agent": "RealtySmartzHRMS/1.0 (global-portal; contact@realtysmartz.in)",
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`Reverse geocoding failed with status ${response.status}`);
  }

  const data = (await response.json()) as {
    display_name?: string;
    name?: string;
    address?: Record<string, string>;
  };
  const parts = data.address ?? {};
  const address =
    data.display_name?.trim() ||
    [
      parts.road,
      parts.neighbourhood,
      parts.suburb,
      parts.city || parts.town || parts.village,
      parts.state,
    ]
      .filter(Boolean)
      .join(", ");
  if (!address) {
    throw new Error("Reverse geocoding returned no address");
  }

  if (addressCache.size >= ADDRESS_CACHE_MAX) {
    const oldest = addressCache.keys().next().value;
    if (oldest !== undefined) addressCache.delete(oldest);
  }
  addressCache.set(key, { address: address.slice(0, 500), at: Date.now() });
  return address.slice(0, 500);
}
