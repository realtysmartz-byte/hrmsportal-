import { userFacingErrorMessage } from "@/lib/user-facing-error";

export type GeoPlace = {
  name: string;
  address: string;
  lat: number;
  lng: number;
};

export type StoredFix = {
  lat: number;
  lng: number;
  accuracy: number | null;
  timestamp: number;
};

export type PunchFix = StoredFix & { accuracy: number };

const FIX_MAX_AGE_MS = 2 * 60_000;
const WATCH_BUDGET_MS = 8_000;
const GOOD_ACCURACY_M = 100;

let latestFix: StoredFix | null = null;
let watchId: number | null = null;
let prewarmStarted = false;
let prewarmUsers = 0;
let permissionStatus: PermissionStatus | null = null;
let permissionChangeHandler: (() => void) | null = null;
let serverClockOffsetMs = 0;
let hasServerClockReference = false;

const geocodeCache = new Map<string, GeoPlace>();

export function setServerTimeReference(serverTime: Date | string) {
  const serverTimestamp = new Date(serverTime).getTime();
  if (!Number.isFinite(serverTimestamp)) return;
  serverClockOffsetMs = serverTimestamp - Date.now();
  hasServerClockReference = true;
}

export function getServerAdjustedFixTimestamp(fixTimestamp: number): Date {
  return new Date(
    fixTimestamp + (hasServerClockReference ? serverClockOffsetMs : 0)
  );
}

export function isGoogleMapsLink(text: string): boolean {
  return /^https?:\/\/(?:(?:www\.)?google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(
    text.trim()
  );
}

/** Link results without a place name come back labelled "Pinned location [...]". */
export function isUnnamedPin(name: string): boolean {
  return /^Pinned location \[/.test(name);
}

function cacheKey(lat: number, lng: number) {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

export async function reverseGeocodePlace(
  lat: number,
  lng: number
): Promise<GeoPlace> {
  const key = cacheKey(lat, lng);
  const hit = geocodeCache.get(key);
  if (hit) return hit;

  const coords = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(
      `/api/geocode?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = (await res.json()) as Partial<GeoPlace>;
      const place = {
        name: data.name || coords,
        address: data.address || coords,
        lat,
        lng,
      };
      geocodeCache.set(key, place);
      return place;
    }
  } catch (e) {
    console.warn("[geolocation] Reverse geocode failed:", e);
  }

  return { name: coords, address: coords, lat, lng };
}

function storeFix(pos: GeolocationPosition) {
  latestFix = {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
    timestamp: pos.timestamp || Date.now(),
  };
}

function isUsablePunchFix(fix: StoredFix | null): fix is PunchFix {
  return Boolean(
    fix &&
      fix.accuracy != null &&
      Number.isFinite(fix.accuracy) &&
      fix.accuracy > 0 &&
      fix.accuracy < 50_000
  );
}

export function getStoredPunchFix(): StoredFix | null {
  if (!latestFix) return null;
  const age = Date.now() - latestFix.timestamp;
  if (age < 0 || age > FIX_MAX_AGE_MS) return null;
  return latestFix;
}

function startPrewarmWatch() {
  if (
    prewarmStarted ||
    prewarmUsers === 0 ||
    permissionStatus?.state !== "granted" ||
    typeof navigator === "undefined" ||
    !navigator.geolocation
  ) {
    return;
  }
  prewarmStarted = true;

  navigator.geolocation.getCurrentPosition(
    storeFix,
    () => {},
    { enableHighAccuracy: false, maximumAge: 120_000, timeout: 5_000 }
  );

  watchId = navigator.geolocation.watchPosition(
    storeFix,
    () => {},
    { enableHighAccuracy: false, maximumAge: 120_000, timeout: 8_000 }
  );
}

/** Pre-warm GPS only after permission is already granted. Clear on unmount. */
export function startPunchLocationPrewarm() {
  if (typeof window === "undefined" || !navigator.geolocation) return;
  prewarmUsers += 1;
  if (prewarmUsers > 1 || permissionStatus) return;

  if (!navigator.permissions?.query) return;
  void navigator.permissions
    .query({ name: "geolocation" })
    .then((status) => {
      if (prewarmUsers === 0) return;
      permissionStatus = status;
      permissionChangeHandler = () => {
        if (permissionStatus?.state === "granted") {
          startPrewarmWatch();
        } else {
          stopPrewarmWatch();
        }
      };
      status.addEventListener("change", permissionChangeHandler);
      startPrewarmWatch();
    })
    .catch(() => {
      // Do not trigger a permission prompt before the user taps a punch button.
    });
}

function stopPrewarmWatch() {
  prewarmStarted = false;
  if (watchId != null && typeof navigator !== "undefined" && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId);
  }
  watchId = null;
}

export function stopPunchLocationPrewarm() {
  prewarmUsers = Math.max(0, prewarmUsers - 1);
  if (prewarmUsers > 0) return;
  stopPrewarmWatch();
  if (permissionStatus && permissionChangeHandler) {
    permissionStatus.removeEventListener("change", permissionChangeHandler);
  }
  permissionStatus = null;
  permissionChangeHandler = null;
}

/**
 * Punch tap: use ≤2min cached fix, else watch ≤8s for accuracy≤100m
 * (or best fix at timeout). Never uses enableHighAccuracy+maximumAge:0 alone.
 */
export function acquirePunchFix(): Promise<PunchFix> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser"));
      return;
    }

    const cached = getStoredPunchFix();
    if (isUsablePunchFix(cached)) {
      resolve(cached);
      return;
    }

    let best: PunchFix | null = null;
    let settled = false;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const fix: StoredFix = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
          timestamp: pos.timestamp || Date.now(),
        };
        storeFix(pos);
        if (!isUsablePunchFix(fix)) return;
        if (
          !best ||
          fix.accuracy < best.accuracy
        ) {
          best = fix;
        }
        if (fix.accuracy != null && fix.accuracy <= GOOD_ACCURACY_M) {
          if (settled) return;
          settled = true;
          navigator.geolocation.clearWatch(id);
          clearTimeout(timer);
          resolve(fix);
        }
      },
      (err) => {
        if (settled) return;
        if (err.code === 1) {
          settled = true;
          navigator.geolocation.clearWatch(id);
          clearTimeout(timer);
          reject(err);
        }
      },
      { enableHighAccuracy: false, maximumAge: 30_000, timeout: WATCH_BUDGET_MS }
    );

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      navigator.geolocation.clearWatch(id);
      if (best) resolve(best);
      else {
        reject(
          Object.assign(new Error("Location unavailable. Please try again."), { code: 2 })
        );
      }
    }, WATCH_BUDGET_MS);
  });
}

/** @deprecated Prefer acquirePunchFix — kept for non-punch soft GPS reads */
export function getPunchPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 5000,
      maximumAge: 120_000,
    });
  });
}

/** Soft GPS for badges/pings — never use fresh=true on punch screens. */
export function getCurrentPosition(fresh = false): Promise<GeolocationPosition> {
  if (!fresh) {
    return getPunchPosition();
  }
  // Balanced fallback only (never high-accuracy + maximumAge:0 alone)
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 8000,
      maximumAge: 60_000,
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
  if (err instanceof Error) return userFacingErrorMessage(err);
  return "Unable to get your location";
}
