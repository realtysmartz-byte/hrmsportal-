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
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(
      `/api/geocode?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = (await res.json()) as GeoPlace;
      let cleanName = data.name || "Realty Smartz Private Limited";
      let cleanAddress = data.address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

      if (/sunbreeze/i.test(cleanName) || cleanName === "Current location" || cleanName === "Location Coordinates") {
        cleanName = "Realty Smartz Private Limited";
      }
      if (/sunbreeze/i.test(cleanAddress)) {
        cleanAddress = cleanAddress.replace(/sunbreeze/gi, "Realty Smartz Private Limited");
      }

      return {
        name: cleanName,
        address: cleanAddress,
        lat,
        lng,
      };
    }
  } catch (e) {
    console.warn("[geolocation] Reverse geocode network fallback:", e);
  }

  // Graceful fallback to GPS coordinates (never blocks employee punch-in)
  return {
    name: "Realty Smartz Private Limited",
    address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
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
    if (typeof window === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      resolve,
      (err) => {
        // If high accuracy times out (e.g. indoors or slow mobile GPS lock), retry with standard accuracy
        if (err.code === 3) {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 15000,
            maximumAge: 60000,
          });
        } else {
          reject(err);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
      }
    );
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
