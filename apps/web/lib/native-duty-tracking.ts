import { Capacitor, registerPlugin } from "@capacitor/core";
import { haversineDistanceM } from "@realty-smartz/shared";
import type { StoredFix } from "@/lib/geolocation";

interface DutyTrackingPlugin {
  start(options: { intervalMs?: number; apiUrl?: string }): Promise<{ started: boolean }>;
  stop(): Promise<{ stopped: boolean }>;
  lastKnownFix(): Promise<{
    lat?: number;
    lng?: number;
    accuracy?: number | null;
    timestamp?: number;
    isMockLocation?: boolean;
  }>;
}

const DutyTracking = registerPlugin<DutyTrackingPlugin>("DutyTracking", {
  web: () => ({
    async start() {
      return { started: false };
    },
    async stop() {
      return { stopped: false };
    },
    async lastKnownFix() {
      return {};
    },
  }),
});

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/** Avoid restarting the native service on every page navigation. */
let nativeTrackingStarted = false;

export function isNativeAndroidApp() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export async function getNativeMockLocationFlag(referenceFix: StoredFix): Promise<boolean> {
  if (!isNativeAndroidApp()) return false;
  try {
    const fix = await DutyTracking.lastKnownFix();
    if (
      fix.lat == null ||
      fix.lng == null ||
      fix.timestamp == null ||
      Date.now() - fix.timestamp < 0 ||
      Date.now() - fix.timestamp > 2 * 60_000 ||
      Math.abs(referenceFix.timestamp - fix.timestamp) > 2 * 60_000
    ) {
      return false;
    }
    const distanceM = haversineDistanceM(
      referenceFix.lat,
      referenceFix.lng,
      fix.lat,
      fix.lng
    );
    const accuracyRadiusM =
      Math.min(referenceFix.accuracy ?? 100, 100) +
      Math.min(fix.accuracy ?? 100, 100) +
      25;
    return Boolean(fix.isMockLocation && distanceM <= accuracyRadiusM);
  } catch (err) {
    console.error(
      "[duty-tracking] mock location lookup failed:",
      err instanceof Error ? err.name : "Unknown error"
    );
    return false;
  }
}

/** Start Android foreground location tracking (every 30 min while on duty). */
export async function startNativeDutyTracking() {
  if (!isNativeAndroidApp()) return;
  if (nativeTrackingStarted) return;
  try {
    await DutyTracking.start({
      intervalMs: DEFAULT_INTERVAL_MS,
      apiUrl: `${window.location.origin}/api/native/location-ping`,
    });
    nativeTrackingStarted = true;
  } catch (err) {
    console.error("[duty-tracking] start failed:", err);
  }
}

/** Stop Android foreground location tracking (on clock-out). */
export async function stopNativeDutyTracking() {
  if (!isNativeAndroidApp()) return;
  nativeTrackingStarted = false;
  try {
    await DutyTracking.stop();
  } catch (err) {
    console.error("[duty-tracking] stop failed:", err);
  }
}
