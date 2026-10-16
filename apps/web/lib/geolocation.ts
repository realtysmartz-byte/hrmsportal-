export type GeoPlace = {
  name: string;
  address: string;
  lat: number;
  lng: number;
};

export function isGoogleMapsLink(text: string): boolean {
  return /^https?:\/\/(?:(?:www\.)?google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(
    text.trim()
  );
}

/** Link results without a place name come back labelled "Pinned location [...]". */
export function isUnnamedPin(name: string): boolean {
  return /^Pinned location \[/.test(name);
}

export async function reverseGeocodePlace(
  lat: number,
  lng: number
): Promise<GeoPlace> {
  const coords = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(
      `/api/geocode?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = (await res.json()) as Partial<GeoPlace>;
      return {
        name: data.name || coords,
        address: data.address || coords,
        lat,
        lng,
      };
    }
  } catch (e) {
    console.warn("[geolocation] Reverse geocode failed:", e);
  }

  return { name: coords, address: coords, lat, lng };
}

export function getCurrentPosition(fresh = false): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser"));
      return;
    }
    const maxAge = fresh ? 0 : 30_000;
    navigator.geolocation.getCurrentPosition(
      resolve,
      (err) => {
        // If high accuracy times out (e.g. indoors or slow mobile GPS lock), retry with standard accuracy
        if (err.code === 3) {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 8000,
            maximumAge: fresh ? 0 : 120000,
          });
        } else {
          reject(err);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: fresh ? 15_000 : 7000,
        maximumAge: maxAge,
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
