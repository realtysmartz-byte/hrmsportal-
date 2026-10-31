import { Capacitor, registerPlugin } from "@capacitor/core";
import { haversineDistanceM } from "@realty-smartz/shared";
import type { StoredFix } from "@/lib/geolocation";

interface DutyTrackingPlugin {
  start(options: { intervalMs?: number; apiUrl?: string }): Promise<{ started: boolean }>;
  stop(): Promise<{ stopped: boolean }>;
  showNotification(options: { title: string; body: string }): Promise<{ shown?: boolean }>;
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
    async showNotification() {
      return {};
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
    const distM = haversineDistanceM(
      referenceFix.lat,
      referenceFix.lng,
      fix.lat,
      fix.lng
    );
    if (distM > 100) return false;
    return Boolean(fix.isMockLocation);
  } catch (err) {
    console.warn("[duty-tracking] could not read native fix:", err);
    return false;
  }
}

/** Start Android foreground location tracking (every 1 hour while on duty). */
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

/** Trigger native notification if on Android app */
export async function showNativeNotification(title: string, body: string): Promise<boolean> {
  if (!isNativeAndroidApp()) return false;
  try {
    const res = await DutyTracking.showNotification({ title, body });
    return Boolean(res.shown);
  } catch (err) {
    console.warn("[duty-tracking] native notification error:", err);
    return false;
  }
}
