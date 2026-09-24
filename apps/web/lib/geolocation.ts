/**
 * Reverse geocode via OpenStreetMap Nominatim (free).
 * Rate limit: max ~1 request/second.
 */
export type GeoPlace = {
  name: string;
  address: string;
  lat: number;
  lng: number;
};

export async function reverseGeocodePlace(
  lat: number,
  lng: number
): Promise<GeoPlace> {
  const res = await fetch(
    `/api/geocode?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Failed to reverse-geocode location");
  }
  const data = (await res.json()) as GeoPlace;
  return {
    name: data.name || "Current location",
    address: data.address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    lat,
    lng,
  };
}

/** @deprecated prefer reverseGeocodePlace */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<string> {
  const place = await reverseGeocodePlace(lat, lng);
  return place.address;
}

export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0,
    });
  });
}

export function geolocationErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as GeolocationPositionError).code;
    if (code === 1) {
      return "Location permission denied. Please allow location access in your device or browser settings to check in/out.";
    }
    if (code === 2) {
      return "Location unavailable. Please try again.";
    }
    if (code === 3) {
      return "Location request timed out. Please try again.";
    }
  }
  if (err instanceof Error) return err.message;
  return "Unable to get your location";
}
